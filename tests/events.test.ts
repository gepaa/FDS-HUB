import { describe, it, expect } from "vitest";
import {
  parseEnvelope,
  callIdOf,
  externalNumberOf,
  isMissed,
  hasVoicemail,
  artifactKindFor,
  isForwardProgress,
  isCallEvent,
  SUBSCRIBED_EVENTS,
} from "@/lib/quo/events";

const nested = {
  id: "msg_1",
  type: "call.completed",
  apiVersion: "2026-03-30",
  data: {
    resource: {
      id: "ACabc",
      direction: "incoming",
      status: "completed",
      duration: 42,
      answeredAt: "2026-07-27T10:00:06.000Z",
    },
    context: {
      phoneNumberId: "PN1",
      conversationId: "CN1",
      participants: { external: ["+14155550123"], workspace: ["+14155550999"] },
      contacts: { ids: ["CT1"], lookupStatus: "matched" },
    },
    links: { quo: "https://my.quo.com/inbox/PN1/c/CN1?at=ACabc" },
  },
};

// Quo's own delivery-inspection example shows these at the top level
// rather than under `data`, so both shapes must work.
const flat = {
  id: "msg_2",
  type: "call.completed",
  resource: nested.data.resource,
  context: nested.data.context,
  links: nested.data.links,
};

describe("parseEnvelope", () => {
  it("reads the documented nested shape", () => {
    const env = parseEnvelope(nested)!;
    expect(env.eventType).toBe("call.completed");
    expect(callIdOf(env)).toBe("ACabc");
    expect(externalNumberOf(env)).toBe("+14155550123");
    expect(env.links.quo).toContain("my.quo.com");
  });

  it("reads the flat shape too", () => {
    const env = parseEnvelope(flat)!;
    expect(env.eventType).toBe("call.completed");
    expect(callIdOf(env)).toBe("ACabc");
    expect(externalNumberOf(env)).toBe("+14155550123");
  });

  it("keeps unknown fields rather than rejecting the payload", () => {
    const env = parseEnvelope({
      ...nested,
      somethingNew: true,
      data: { ...nested.data, alsoNew: 1 },
    });
    expect(env).not.toBeNull();
    expect(env!.eventType).toBe("call.completed");
  });

  it("returns null only for something that is not an object", () => {
    expect(parseEnvelope("nope")).toBeNull();
    expect(parseEnvelope(42)).toBeNull();
  });

  it("survives a payload with no participants", () => {
    const env = parseEnvelope({
      id: "m",
      type: "call.ringing",
      data: { resource: { id: "ACx" }, context: {} },
    })!;
    expect(externalNumberOf(env)).toBeNull();
    expect(callIdOf(env)).toBe("ACx");
  });

  it("prefers callId over id on artifact events", () => {
    // Recording/transcript events describe the artifact and point at
    // their source call through callId.
    const env = parseEnvelope({
      type: "call.recording.completed",
      data: { resource: { id: "CRrecording", callId: "ACsource" }, context: {} },
    })!;
    expect(callIdOf(env)).toBe("ACsource");
  });
});

describe("isMissed", () => {
  const make = (resource: Record<string, unknown>) =>
    parseEnvelope({ type: "x", data: { resource, context: {} } })!;

  it("is true for the dedicated missed event", () => {
    expect(isMissed(make({ status: "completed" }), "call.missed")).toBe(true);
  });

  it("is true for an inbound call that completed unanswered", () => {
    const env = make({
      direction: "incoming",
      status: "completed",
      answeredAt: null,
    });
    expect(isMissed(env, "call.completed")).toBe(true);
  });

  it("is false for an inbound call that was answered", () => {
    const env = make({
      direction: "incoming",
      status: "completed",
      answeredAt: "2026-07-27T10:00:06.000Z",
    });
    expect(isMissed(env, "call.completed")).toBe(false);
  });

  it("is false for an unanswered OUTBOUND call", () => {
    // We rang them and they didn't pick up — that is not a missed call
    // in the sense the dashboard means (someone tried to reach us).
    const env = make({
      direction: "outgoing",
      status: "completed",
      answeredAt: null,
    });
    expect(isMissed(env, "call.completed")).toBe(false);
  });

  it("recognises the no-answer style statuses", () => {
    for (const status of ["missed", "no-answer", "abandoned", "busy"]) {
      expect(isMissed(make({ status }), "call.completed")).toBe(true);
    }
  });
});

describe("hasVoicemail", () => {
  it("is true from the event type", () => {
    const env = parseEnvelope({ data: { resource: {}, context: {} } })!;
    expect(hasVoicemail(env, "call.voicemail.completed")).toBe(true);
  });

  it("is true from the resource flag", () => {
    const env = parseEnvelope({
      data: { resource: { hasVoicemail: true }, context: {} },
    })!;
    expect(hasVoicemail(env, "call.completed")).toBe(true);
  });
});

describe("artifactKindFor", () => {
  it("maps artifact events to what must be fetched", () => {
    expect(artifactKindFor("call.recording.completed")).toBe("recording");
    expect(artifactKindFor("call.transcript.completed")).toBe("transcript");
    expect(artifactKindFor("call.summary.completed")).toBe("summary");
    expect(artifactKindFor("call.voicemail.completed")).toBe("voicemail");
  });

  it("is null for lifecycle events", () => {
    expect(artifactKindFor("call.ringing")).toBeNull();
    expect(artifactKindFor("call.completed")).toBeNull();
    expect(artifactKindFor(null)).toBeNull();
  });
});

describe("isForwardProgress", () => {
  it("allows a call to advance", () => {
    expect(isForwardProgress("ringing", "completed")).toBe(true);
    expect(isForwardProgress(null, "ringing")).toBe(true);
  });

  it("refuses to move a completed call backwards", () => {
    // The out-of-order guarantee, in one assertion.
    expect(isForwardProgress("completed", "ringing")).toBe(false);
    expect(isForwardProgress("answered", "ringing")).toBe(false);
  });

  it("allows a same-status refresh", () => {
    expect(isForwardProgress("completed", "completed")).toBe(true);
  });
});

describe("subscription surface", () => {
  it("subscribes to every call event and nothing else", () => {
    expect(SUBSCRIBED_EVENTS).toContain("call.ringing");
    expect(SUBSCRIBED_EVENTS).toContain("call.missed");
    expect(SUBSCRIBED_EVENTS).toContain("call.transcript.completed");
    expect(SUBSCRIBED_EVENTS.every(isCallEvent)).toBe(true);
    expect(SUBSCRIBED_EVENTS).not.toContain("message.received");
  });
});
