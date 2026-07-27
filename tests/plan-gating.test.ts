import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb } from "./helpers";
import { QuoApiError } from "@/lib/quo/errors";

/**
 * Quo's Starter plan has no call transcripts or summaries — the
 * endpoints refuse with a 403. That is a settled fact about the
 * workspace, not a transient fault, so it must resolve cleanly rather
 * than leaving a failed job against every single call.
 */

vi.mock("@/lib/quo/client", () => ({
  quoClient: {
    getTranscript: vi.fn(async () => {
      throw new QuoApiError({
        message: "Quo 403 on /call-transcripts",
        kind: "permission",
        status: 403,
        path: "/call-transcripts/ACstarter",
      });
    }),
    getSummary: vi.fn(async () => {
      throw new QuoApiError({
        message: "Quo 403 on /call-summaries",
        kind: "permission",
        status: 403,
        path: "/call-summaries/ACstarter",
      });
    }),
    getCall: vi.fn(),
    getRecordings: vi.fn(async () => []),
  },
  paginate: vi.fn(async () => ({ items: [], truncated: false })),
}));

const { drainJobs } = await import("@/lib/quo/jobs");
const { enqueue } = await import("@/lib/quo/queue");

beforeEach(async () => {
  await resetDb();
});

async function makeCall() {
  return prisma.commsActivity.create({
    data: {
      provider: "quo",
      providerActivityId: "ACstarter",
      direction: "incoming",
      status: "completed",
      externalNumberE164: "+14155550123",
    },
  });
}

describe("plan-gated transcripts (Starter)", () => {
  it("records the transcript as absent instead of failing forever", async () => {
    const activity = await makeCall();
    await enqueue("quo.fetch_transcript", {
      activityId: activity.id,
      callId: "ACstarter",
    });

    const result = await drainJobs(5);

    // The job SUCCEEDS — there is nothing to retry.
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);

    const artifact = await prisma.callArtifact.findFirst({
      where: { activityId: activity.id, kind: "transcript" },
    });
    expect(artifact?.status).toBe("absent");
    expect(artifact?.error).toBe("plan_not_entitled");
    expect(artifact?.text).toBeNull();

    // Nothing is left in the queue nagging about it.
    const dead = await prisma.jobQueue.count({ where: { status: "dead" } });
    expect(dead).toBe(0);
  });

  it("does the same for summaries", async () => {
    const activity = await makeCall();
    await enqueue("quo.fetch_summary", {
      activityId: activity.id,
      callId: "ACstarter",
    });

    const result = await drainJobs(5);
    expect(result.succeeded).toBe(1);

    const artifact = await prisma.callArtifact.findFirst({
      where: { activityId: activity.id, kind: "summary" },
    });
    expect(artifact?.status).toBe("absent");
    expect(artifact?.bullets).toBeNull();
    // Critically: no invented summary text.
    expect(artifact?.text).toBeNull();
  });

  it("never queues an AI extraction with nothing to read", async () => {
    const activity = await makeCall();
    await enqueue("quo.fetch_transcript", {
      activityId: activity.id,
      callId: "ACstarter",
    });
    await drainJobs(5);

    const extractionJobs = await prisma.jobQueue.count({
      where: { kind: "quo.extract" },
    });
    expect(extractionJobs).toBe(0);
    expect(await prisma.callExtraction.count()).toBe(0);
    // And so no follow-up task is invented from a call nobody read.
    expect(await prisma.hqTask.count()).toBe(0);
  });

  it("still keeps the call itself on the lead", async () => {
    // The whole point: everything except the AI half works on Starter.
    const activity = await makeCall();
    await enqueue("quo.fetch_transcript", {
      activityId: activity.id,
      callId: "ACstarter",
    });
    await drainJobs(5);

    const call = await prisma.commsActivity.findUnique({
      where: { id: activity.id },
    });
    expect(call).not.toBeNull();
    expect(call?.status).toBe("completed");
    expect(call?.externalNumberE164).toBe("+14155550123");
  });
});
