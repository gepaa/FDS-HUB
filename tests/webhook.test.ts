import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildDelivery, resetDb } from "./helpers";
import { prisma } from "@/lib/prisma";

/**
 * End-to-end webhook behaviour, against a real database.
 *
 * These are the guarantees the integration lives or dies on: an unknown
 * caller produces exactly one lead, a redelivered event changes nothing,
 * and events arriving in the wrong order still leave the call correct.
 */

// `after()` needs a request scope that does not exist in a test runner.
// Collect the callbacks instead so tests can run them deliberately.
const hoisted = vi.hoisted(() => ({ callbacks: [] as (() => unknown)[] }));

vi.mock("next/server", () => ({
  after: (cb: () => unknown) => {
    hoisted.callbacks.push(cb);
  },
}));

// Quo's HTTP API is never called for real.
const quoFixtures = vi.hoisted(() => ({
  call: {
    id: "ACtest001",
    direction: "incoming",
    status: "completed",
    duration: 184,
    phoneNumberId: "PNtest0000000000",
    userId: "UStest0001",
    answeredBy: "UStest0001",
    initiatedBy: null,
    participants: ["+14155550123"],
    aiHandled: null,
    forwardedFrom: null,
    forwardedTo: null,
    createdAt: "2026-07-27T10:00:00.000Z",
    answeredAt: "2026-07-27T10:00:06.000Z",
    completedAt: "2026-07-27T10:03:10.000Z",
    updatedAt: "2026-07-27T10:03:11.000Z",
  },
  recordings: [
    {
      id: "CRseg1",
      url: "https://storage.example/one.mp3",
      type: "audio/mpeg",
      duration: 90,
      startTime: "2026-07-27T10:00:06.000Z",
      status: "completed",
    },
    {
      id: "CRseg2",
      url: "https://storage.example/two.mp3",
      type: "audio/mpeg",
      duration: 94,
      startTime: "2026-07-27T10:01:40.000Z",
      status: "completed",
    },
  ],
  transcript: {
    callId: "ACtest001",
    createdAt: "2026-07-27T10:03:30.000Z",
    duration: 184,
    status: "completed",
    dialogue: [
      {
        content: "Hi, I'm after a rotary cutter for a 40 horsepower Kubota.",
        start: 1.2,
        end: 5.4,
        identifier: "+14155550123",
        userId: null,
      },
      {
        content: "We have a six foot unit — I'll confirm freight and call back.",
        start: 5.9,
        end: 11.2,
        identifier: null,
        userId: "UStest0001",
      },
    ],
  },
  summary: {
    callId: "ACtest001",
    status: "completed",
    summary: ["Customer wants a 6ft rotary cutter", "Freight to be confirmed"],
    nextSteps: null, // Business plan: Quo supplies no action items
  },
}));

vi.mock("@/lib/quo/client", () => ({
  quoClient: {
    getCall: vi.fn(async () => quoFixtures.call),
    getRecordings: vi.fn(async () => quoFixtures.recordings),
    getTranscript: vi.fn(async () => quoFixtures.transcript),
    getSummary: vi.fn(async () => quoFixtures.summary),
    listConversations: vi.fn(async () => ({ data: [], nextPageToken: null })),
    listCalls: vi.fn(async () => ({ data: [], nextPageToken: null })),
  },
  paginate: vi.fn(async () => ({ items: [], truncated: false })),
}));

const { POST } = await import("@/app/api/integrations/quo/webhooks/route");

/** Run whatever the route scheduled with after(). */
async function flushAfter() {
  const pending = [...hoisted.callbacks];
  hoisted.callbacks.length = 0;
  for (const cb of pending) await cb();
}

/** Drain until the queue stops producing new work (jobs chain). */
async function drainAll() {
  const { drainJobs } = await import("@/lib/quo/jobs");
  for (let i = 0; i < 8; i++) {
    const result = await drainJobs(25);
    if (result.claimed === 0) break;
  }
}

beforeEach(async () => {
  hoisted.callbacks.length = 0;
  await resetDb();
});

describe("signature enforcement", () => {
  it("rejects a delivery whose body was altered in transit", async () => {
    const { rawBody, request } = buildDelivery({
      eventType: "call.ringing",
      callId: "ACtamper",
    });
    const tampered = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: rawBody.replace("ACtamper", "ACevil"),
    });

    const res = await POST(tampered);
    expect(res.status).toBe(401);
    // Nothing is recorded from an unverified payload.
    expect(await prisma.webhookEvent.count()).toBe(0);
    expect(await prisma.commsActivity.count()).toBe(0);
  });
});

describe("unknown caller", () => {
  it("creates exactly one lead and attaches the call", async () => {
    const { request } = buildDelivery({
      eventType: "call.ringing",
      callId: "ACtest001",
      externalNumber: "+14155550123",
    });

    const res = await POST(request);
    expect(res.status).toBe(200);
    await flushAfter();

    const leads = await prisma.crmRecord.findMany({ where: { type: "lead" } });
    expect(leads).toHaveLength(1);
    expect(leads[0].phoneE164).toBe("+14155550123");
    expect(leads[0].source).toBe("Inbound Quo Call");
    expect(leads[0].status).toBe("NEW");
    expect(leads[0].needsEnrichment).toBe(true);
    expect(leads[0].owner).toBe("unassigned");

    const activity = await prisma.commsActivity.findFirst();
    expect(activity?.recordId).toBe(leads[0].id);
    expect(activity?.direction).toBe("incoming");
    expect(activity?.providerLink).toContain("my.quo.com");
  });

  it("does not create a second lead when the same number rings again", async () => {
    for (const callId of ["ACfirst", "ACsecond", "ACthird"]) {
      const { request } = buildDelivery({
        eventType: "call.ringing",
        callId,
        externalNumber: "+14155550123",
      });
      await POST(request);
      await flushAfter();
    }

    expect(await prisma.crmRecord.count({ where: { type: "lead" } })).toBe(1);
    expect(await prisma.commsActivity.count()).toBe(3);
  });
});

describe("existing lead", () => {
  it("attaches the call to the lead that already owns that number", async () => {
    const existing = await prisma.crmRecord.create({
      data: {
        recordId: "FDS-LEAD-0900",
        type: "lead",
        name: "Dale Whitcombe",
        phone: "(415) 555-0123",
        phoneE164: "+14155550123",
        status: "ENGAGED",
        owner: "you",
      },
    });

    const { request } = buildDelivery({
      eventType: "call.ringing",
      callId: "ACmatch",
      externalNumber: "+14155550123",
    });
    await POST(request);
    await flushAfter();

    const activity = await prisma.commsActivity.findFirst();
    expect(activity?.recordId).toBe(existing.id);
    // No new lead invented alongside the real one.
    expect(await prisma.crmRecord.count()).toBe(1);
  });
});

describe("duplicate delivery", () => {
  it("is a no-op when Quo retries the same event", async () => {
    const delivery = buildDelivery({
      eventType: "call.ringing",
      callId: "ACdupe",
    });

    const first = await POST(delivery.request);
    await flushAfter();
    expect(await first.json()).toMatchObject({ ok: true });

    // Same webhook-id and body — exactly what a Quo retry looks like.
    const retry = buildDelivery({
      eventType: "call.ringing",
      callId: "ACdupe",
      webhookId: delivery.webhookId,
    });
    const second = await POST(retry.request);
    await flushAfter();

    expect(await second.json()).toMatchObject({ duplicate: true });
    expect(await prisma.webhookEvent.count()).toBe(1);
    expect(await prisma.commsActivity.count()).toBe(1);
    expect(await prisma.crmRecord.count()).toBe(1);
    expect(await prisma.hqTask.count()).toBe(0);
  });
});

describe("out-of-order events", () => {
  it("does not let a late 'ringing' undo a completed call", async () => {
    const completed = buildDelivery({
      eventType: "call.completed",
      callId: "ACorder",
      status: "completed",
      answeredAt: "2026-07-27T10:00:06.000Z",
      completedAt: "2026-07-27T10:03:10.000Z",
      duration: 184,
    });
    await POST(completed.request);
    await flushAfter();

    const late = buildDelivery({
      eventType: "call.ringing",
      callId: "ACorder",
      status: "ringing",
    });
    await POST(late.request);
    await flushAfter();

    const activity = await prisma.commsActivity.findFirst({
      where: { providerActivityId: "ACorder" },
    });
    expect(activity?.status).toBe("completed");
    expect(activity?.durationSec).toBe(184);
    expect(activity?.completedAt).not.toBeNull();
    expect(await prisma.commsActivity.count()).toBe(1);
  });

  it("accepts a recording that arrives before the call is known", async () => {
    const { request } = buildDelivery({
      eventType: "call.recording.completed",
      callId: "ACearly",
      status: "completed",
    });
    await POST(request);
    await flushAfter();
    await drainAll();

    const activity = await prisma.commsActivity.findFirst({
      where: { providerActivityId: "ACearly" },
    });
    expect(activity).not.toBeNull();

    const recordings = await prisma.callArtifact.findMany({
      where: { activityId: activity!.id, kind: "recording" },
    });
    expect(recordings).toHaveLength(2);
  });
});

describe("call artifacts", () => {
  it("stores every recording segment once, even on redelivery", async () => {
    const first = buildDelivery({
      eventType: "call.recording.completed",
      callId: "ACtest001",
      status: "completed",
    });
    await POST(first.request);
    await flushAfter();
    await drainAll();

    const second = buildDelivery({
      eventType: "call.recording.completed",
      callId: "ACtest001",
      status: "completed",
    });
    await POST(second.request);
    await flushAfter();
    await drainAll();

    const activity = await prisma.commsActivity.findFirst({
      where: { providerActivityId: "ACtest001" },
    });
    const recordings = await prisma.callArtifact.findMany({
      where: { activityId: activity!.id, kind: "recording" },
      orderBy: { segmentIndex: "asc" },
    });

    expect(recordings).toHaveLength(2);
    expect(recordings.map((r) => r.providerArtifactId)).toEqual([
      "CRseg1",
      "CRseg2",
    ]);
    expect(recordings[0].mimeType).toBe("audio/mpeg");
    expect(recordings[0].providerUrl).toBe("https://storage.example/one.mp3");
  });

  it("stores the transcript with speaker separation preserved", async () => {
    const { request } = buildDelivery({
      eventType: "call.transcript.completed",
      callId: "ACtest001",
      status: "completed",
    });
    await POST(request);
    await flushAfter();
    await drainAll();

    const activity = await prisma.commsActivity.findFirst({
      where: { providerActivityId: "ACtest001" },
    });
    const transcript = await prisma.callArtifact.findFirst({
      where: { activityId: activity!.id, kind: "transcript" },
    });

    expect(transcript?.status).toBe("completed");
    // Flattened text exists for searching...
    expect(transcript?.text).toContain("rotary cutter");
    // ...and the per-speaker structure survives intact.
    const dialogue = JSON.parse(transcript!.dialogue!);
    expect(dialogue).toHaveLength(2);
    expect(dialogue[0].identifier).toBe("+14155550123");
    expect(dialogue[1].userId).toBe("UStest0001");
  });

  it("stores Quo's summary as its own record, with no next steps on Business", async () => {
    const { request } = buildDelivery({
      eventType: "call.summary.completed",
      callId: "ACtest001",
      status: "completed",
    });
    await POST(request);
    await flushAfter();
    await drainAll();

    const activity = await prisma.commsActivity.findFirst({
      where: { providerActivityId: "ACtest001" },
    });
    const summary = await prisma.callArtifact.findFirst({
      where: { activityId: activity!.id, kind: "summary" },
    });

    const bullets = JSON.parse(summary!.bullets!);
    expect(bullets).toEqual([
      "Customer wants a 6ft rotary cutter",
      "Freight to be confirmed",
    ]);
    // Business plan gives no action items — this must stay empty rather
    // than being quietly filled with something invented.
    expect(summary?.nextSteps).toBeNull();
  });
});

describe("missed calls", () => {
  it("flags an unanswered inbound call", async () => {
    const { request } = buildDelivery({
      eventType: "call.missed",
      callId: "ACmissed",
      status: "missed",
      answeredAt: null,
      completedAt: "2026-07-27T11:00:20.000Z",
    });
    await POST(request);
    await flushAfter();

    const activity = await prisma.commsActivity.findFirst({
      where: { providerActivityId: "ACmissed" },
    });
    expect(activity?.missed).toBe(true);
  });

  it("keeps the missed flag when a later event omits it", async () => {
    await POST(
      buildDelivery({
        eventType: "call.missed",
        callId: "ACsticky",
        status: "missed",
      }).request,
    );
    await flushAfter();

    await POST(
      buildDelivery({
        eventType: "call.recording.completed",
        callId: "ACsticky",
        status: "completed",
      }).request,
    );
    await flushAfter();

    const activity = await prisma.commsActivity.findFirst({
      where: { providerActivityId: "ACsticky" },
    });
    expect(activity?.missed).toBe(true);
  });
});

describe("activity log", () => {
  it("writes one call entry into the existing interaction log", async () => {
    const delivery = buildDelivery({
      eventType: "call.completed",
      callId: "ACtest001",
      status: "completed",
      answeredAt: "2026-07-27T10:00:06.000Z",
      completedAt: "2026-07-27T10:03:10.000Z",
      duration: 184,
    });
    await POST(delivery.request);
    await flushAfter();
    await drainAll();

    const interactions = await prisma.interaction.findMany({
      where: { type: "call" },
    });
    expect(interactions).toHaveLength(1);
    expect(interactions[0].body).toContain("Inbound call");
    expect(interactions[0].actor).toBe("system");

    // And the lead's last-contact date moved.
    const lead = await prisma.crmRecord.findFirst({ where: { type: "lead" } });
    expect(lead?.lastContactDate).not.toBeNull();
  });
});
