import { z } from "zod";

/**
 * Quo webhook event vocabulary and payload parsing.
 *
 * Event names are taken verbatim from Quo's published OpenAPI document
 * for payload version 2026-03-30 (the unified webhook API). They are
 * NOT guesses, and they are NOT the legacy OpenPhone set — the legacy
 * webhooks only ever emitted call.ringing / call.completed /
 * call.recording.completed.
 *
 * Client-safe: pure parsing, no secrets, no database.
 */

export const CALL_EVENTS = [
  "call.ringing",
  "call.answered",
  "call.completed",
  "call.missed",
  "call.forwarded",
  "call.menu.selected",
  "call.recording.completed",
  "call.summary.completed",
  "call.transcript.completed",
  "call.voicemail.completed",
] as const;

export const MESSAGE_EVENTS = [
  "message.received",
  "message.delivered",
  "message.failed",
  "message.undelivered",
] as const;

export const CONTACT_EVENTS = ["contact.updated", "contact.deleted"] as const;

/** Everything Quo can send. Task events exist but this MVP ignores them. */
export const ALL_EVENTS = [
  ...CALL_EVENTS,
  ...MESSAGE_EVENTS,
  ...CONTACT_EVENTS,
] as const;

export type QuoEventType = (typeof ALL_EVENTS)[number];

/** Events this integration subscribes to and acts on. */
export const SUBSCRIBED_EVENTS: QuoEventType[] = [...CALL_EVENTS];

export function isCallEvent(type: string): boolean {
  return (CALL_EVENTS as readonly string[]).includes(type);
}

// ---------------- payload parsing ----------------

/**
 * Quo's own contact-lookup result for the caller. "matched" means Quo
 * recognised the number in its address book — useful as a secondary
 * matching hint, never as the primary one (the CRM is authoritative).
 */
const contextSchema = z
  .object({
    phoneNumberId: z.string().nullish(),
    phoneNumberType: z.string().nullish(),
    conversationId: z.string().nullish(),
    userId: z.string().nullish(),
    participants: z
      .object({
        external: z.array(z.string()).nullish(),
        workspace: z.array(z.string()).nullish(),
        // Quo tells us when it could not resolve participants at all.
        resolution: z.string().nullish(),
      })
      .nullish(),
    contacts: z
      .object({
        ids: z.array(z.string()).nullish(),
        lookupStatus: z.string().nullish(),
      })
      .nullish(),
  })
  .passthrough();

const resourceSchema = z
  .object({
    id: z.string().nullish(),
    callId: z.string().nullish(),
    direction: z.string().nullish(),
    status: z.string().nullish(),
    duration: z.number().nullish(),
    hasVoicemail: z.boolean().nullish(),
    aiHandled: z.string().nullish(),
    answeredBy: z.string().nullish(),
    initiatedBy: z.string().nullish(),
    userId: z.string().nullish(),
    phoneNumberId: z.string().nullish(),
    forwardedFrom: z.unknown().nullish(),
    forwardedTo: z.unknown().nullish(),
    createdAt: z.string().nullish(),
    answeredAt: z.string().nullish(),
    completedAt: z.string().nullish(),
    updatedAt: z.string().nullish(),
  })
  .passthrough();

const bodySchema = z
  .object({
    // Envelope identity. Quo's documentation is inconsistent about
    // whether these sit at the top level or inside `data`, so both are
    // accepted — see normaliseEnvelope below.
    id: z.string().nullish(),
    type: z.string().nullish(),
    eventType: z.string().nullish(),
    apiVersion: z.string().nullish(),
    createdAt: z.string().nullish(),
    resource: resourceSchema.nullish(),
    context: contextSchema.nullish(),
    links: z.record(z.string(), z.string()).nullish(),
    data: z
      .object({
        type: z.string().nullish(),
        resource: resourceSchema.nullish(),
        context: contextSchema.nullish(),
        links: z.record(z.string(), z.string()).nullish(),
      })
      .passthrough()
      .nullish(),
  })
  .passthrough();

export interface QuoEnvelope {
  eventId: string | null;
  eventType: string | null;
  apiVersion: string | null;
  createdAt: string | null;
  resource: z.infer<typeof resourceSchema>;
  context: z.infer<typeof contextSchema>;
  links: Record<string, string>;
}

/**
 * Normalise a delivered webhook body.
 *
 * Quo's changelog describes the payload as `data.resource` /
 * `data.context` / `data.links`, while the delivery-inspection example
 * in their OpenAPI document shows `resource` / `context` / `links` at
 * the top level. Rather than bet on one, we accept either — the shapes
 * are unambiguous and this costs nothing. If Quo settles on one, this
 * keeps working.
 *
 * Returns null only when the body is not an object at all; a body we
 * can parse but not understand still yields an envelope so the event is
 * recorded (and visible) rather than silently dropped.
 */
export function parseEnvelope(body: unknown): QuoEnvelope | null {
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return null;
  const b = parsed.data;
  const inner = b.data ?? null;

  return {
    eventId: b.id ?? null,
    eventType: b.type ?? b.eventType ?? inner?.type ?? null,
    apiVersion: b.apiVersion ?? null,
    createdAt: b.createdAt ?? null,
    resource: b.resource ?? inner?.resource ?? {},
    context: b.context ?? inner?.context ?? {},
    links: b.links ?? inner?.links ?? {},
  };
}

// ---------------- derived call facts ----------------

/** Quo's call id for this event, wherever it happens to live. */
export function callIdOf(env: QuoEnvelope): string | null {
  const r = env.resource as Record<string, unknown>;
  // Artifact events (recording/transcript/summary/voicemail) reference
  // their source call via `callId`; call lifecycle events use `id`.
  const callId = typeof r.callId === "string" ? r.callId : null;
  const id = typeof r.id === "string" ? r.id : null;
  return callId ?? id;
}

/** The customer's number — the one lead matching uses. */
export function externalNumberOf(env: QuoEnvelope): string | null {
  const list = env.context.participants?.external ?? [];
  const first = list.find((n) => typeof n === "string" && n.trim());
  return first ?? null;
}

const MISSED_STATUSES = new Set([
  "missed",
  "no-answer",
  "abandoned",
  "busy",
  "canceled",
]);

/**
 * Was this an incoming call nobody picked up?
 *
 * `call.missed` is authoritative when present. Otherwise we infer it,
 * because a completed incoming call that was never answered is a missed
 * call as far as a salesperson is concerned — and missed calls are the
 * whole point of the dashboard indicator.
 */
export function isMissed(env: QuoEnvelope, eventType: string | null): boolean {
  if (eventType === "call.missed") return true;
  const status = String(env.resource.status ?? "");
  const direction = String(env.resource.direction ?? "");
  if (MISSED_STATUSES.has(status)) return true;
  return (
    direction === "incoming" &&
    status === "completed" &&
    !env.resource.answeredAt
  );
}

export function hasVoicemail(
  env: QuoEnvelope,
  eventType: string | null,
): boolean {
  if (eventType === "call.voicemail.completed") return true;
  return env.resource.hasVoicemail === true;
}

/**
 * Which artifact a given event is about, or null for lifecycle events.
 * Drives which fetch job gets queued.
 */
export function artifactKindFor(
  eventType: string | null,
): "recording" | "transcript" | "summary" | "voicemail" | null {
  switch (eventType) {
    case "call.recording.completed":
      return "recording";
    case "call.transcript.completed":
      return "transcript";
    case "call.summary.completed":
      return "summary";
    case "call.voicemail.completed":
      return "voicemail";
    default:
      return null;
  }
}

/**
 * Rank of a call status, used to stop an out-of-order event from
 * dragging a call backwards.
 *
 * Quo makes no ordering guarantee, and in practice `call.completed` can
 * land before the `call.ringing` for the same call. Without this, a
 * late-arriving "ringing" would overwrite a finished call and the
 * timeline would show a call that never ended.
 */
const STATUS_RANK: Record<string, number> = {
  queued: 0,
  initiated: 1,
  ringing: 2,
  "in-progress": 3,
  answered: 4,
  forwarded: 5,
  busy: 6,
  "no-answer": 6,
  canceled: 6,
  abandoned: 6,
  failed: 6,
  missed: 6,
  completed: 7,
};

export function statusRank(status: string | null | undefined): number {
  if (!status) return -1;
  return STATUS_RANK[status] ?? 0;
}

/** True when `next` represents a later point in the call's life. */
export function isForwardProgress(
  current: string | null | undefined,
  next: string | null | undefined,
): boolean {
  return statusRank(next) >= statusRank(current);
}
