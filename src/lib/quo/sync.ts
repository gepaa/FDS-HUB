import { prisma } from "@/lib/prisma";
import { QUO_PROVIDER } from "@/lib/quo/config";
import {
  type QuoEnvelope,
  callIdOf,
  externalNumberOf,
  isMissed,
  hasVoicemail,
  isForwardProgress,
} from "@/lib/quo/events";
import { matchLead } from "@/lib/quo/matching";
import { displayPhone } from "@/lib/quo/phone";
import { env } from "@/lib/env";
import type {
  QuoCall,
  QuoRecording,
  QuoTranscript,
  QuoSummary,
} from "@/lib/quo/client";
import type { CommsActivity } from "@/generated/prisma/client";

/**
 * Writing Quo call data into the CRM.
 *
 * Every function here is an UPSERT, never an insert-and-hope. Quo makes
 * no ordering guarantee between webhooks: a recording can arrive before
 * the call.completed that produced it, a transcript can beat a summary,
 * and a completed call can turn up before we ever saw it ring. Each
 * handler therefore has to be correct as the FIRST thing we learn about
 * a call as well as the last.
 *
 * Two rules hold throughout:
 *   - a later status never loses to an earlier one (`isForwardProgress`)
 *   - a known value is never overwritten with null
 */

const nullableDate = (v: string | null | undefined): Date | null =>
  v ? new Date(v) : null;

/** Keep an existing value when the incoming one is empty. */
function keep<T>(incoming: T | null | undefined, existing: T | null): T | null {
  return incoming === null || incoming === undefined ? existing : incoming;
}

export interface UpsertResult {
  activity: CommsActivity;
  created: boolean;
  leadCreated: boolean;
}

/**
 * Create or update the call this webhook is about.
 *
 * Lead matching runs only when the activity has no lead yet, so a
 * re-delivered `call.ringing` cannot move a call that a human has since
 * re-assigned to the correct customer.
 */
export async function upsertCallFromEnvelope(
  envelope: QuoEnvelope,
  eventType: string | null,
): Promise<UpsertResult | null> {
  const callId = callIdOf(envelope);
  if (!callId) return null;

  const existing = await prisma.commsActivity.findUnique({
    where: {
      provider_providerActivityId: {
        provider: QUO_PROVIDER,
        providerActivityId: callId,
      },
    },
  });

  const r = envelope.resource;
  const ctx = envelope.context;
  const externalNumber = externalNumberOf(envelope);
  const incomingStatus = (r.status as string | null) ?? null;

  // Artifact events carry a thin resource (they describe the recording,
  // not the call) — they must not drag call status backwards.
  const statusWins =
    incomingStatus !== null &&
    isForwardProgress(existing?.status ?? null, incomingStatus);

  const base = {
    type: "call",
    direction: keep(r.direction as string | null, existing?.direction ?? null) ?? "incoming",
    providerPhoneNumberId: keep(
      (ctx.phoneNumberId as string | null) ?? (r.phoneNumberId as string | null),
      existing?.providerPhoneNumberId ?? null,
    ),
    providerConversationId: keep(
      ctx.conversationId as string | null,
      existing?.providerConversationId ?? null,
    ),
    providerUserId: keep(
      (r.userId as string | null) ?? (ctx.userId as string | null),
      existing?.providerUserId ?? null,
    ),
    answeredByUserId: keep(
      r.answeredBy as string | null,
      existing?.answeredByUserId ?? null,
    ),
    externalNumber: keep(externalNumber, existing?.externalNumber ?? null),
    externalNumberE164: keep(
      externalNumber,
      existing?.externalNumberE164 ?? null,
    ),
    startedAt: keep(nullableDate(r.createdAt), existing?.startedAt ?? null),
    answeredAt: keep(nullableDate(r.answeredAt), existing?.answeredAt ?? null),
    completedAt: keep(
      nullableDate(r.completedAt),
      existing?.completedAt ?? null,
    ),
    durationSec: keep(r.duration as number | null, existing?.durationSec ?? null),
    aiHandled: keep(r.aiHandled as string | null, existing?.aiHandled ?? null),
    forwardedFrom: keep(
      typeof r.forwardedFrom === "string" ? r.forwardedFrom : null,
      existing?.forwardedFrom ?? null,
    ),
    forwardedTo: keep(
      typeof r.forwardedTo === "string" ? r.forwardedTo : null,
      existing?.forwardedTo ?? null,
    ),
    providerLink: keep(
      envelope.links?.quo ?? null,
      existing?.providerLink ?? null,
    ),
    // Once true, these stay true — a later generic event must not clear
    // the missed flag that call.missed set.
    missed: existing?.missed || isMissed(envelope, eventType),
    voicemail: existing?.voicemail || hasVoicemail(envelope, eventType),
    raw: JSON.stringify({
      resource: envelope.resource,
      context: envelope.context,
      links: envelope.links,
    }).slice(0, 20_000),
    ...(statusWins ? { status: incomingStatus } : {}),
  };

  if (existing) {
    const updated = await prisma.commsActivity.update({
      where: { id: existing.id },
      data: base,
    });
    // A call we already knew about but could not attach gets another
    // chance — later events carry participant data the first one lacked.
    let leadCreated = false;
    if (!updated.recordId) {
      const match = await attachLead(updated, envelope);
      leadCreated = match.leadCreated;
      return { activity: match.activity, created: false, leadCreated };
    }
    await touchRecord(updated);
    return { activity: updated, created: false, leadCreated: false };
  }

  const createdActivity = await prisma.commsActivity.create({
    data: {
      provider: QUO_PROVIDER,
      providerActivityId: callId,
      status: incomingStatus ?? "ringing",
      ...base,
    },
  });

  const match = await attachLead(createdActivity, envelope);
  return {
    activity: match.activity,
    created: true,
    leadCreated: match.leadCreated,
  };
}

async function attachLead(
  activity: CommsActivity,
  envelope: QuoEnvelope,
): Promise<{ activity: CommsActivity; leadCreated: boolean }> {
  const match = await matchLead({
    externalNumber: activity.externalNumberE164 ?? activity.externalNumber,
    direction: activity.direction,
    quoContactIds: envelope.context.contacts?.ids ?? [],
    occurredAt: activity.startedAt ?? new Date(),
  });

  if (!match.record) return { activity, leadCreated: false };

  const updated = await prisma.commsActivity.update({
    where: { id: activity.id },
    data: { recordId: match.record.id },
  });
  await touchRecord(updated);
  return { activity: updated, leadCreated: match.created };
}

/**
 * Keep the lead's "last contacted" honest. Only completed calls count —
 * a ringing phone is not a conversation.
 */
async function touchRecord(activity: CommsActivity): Promise<void> {
  if (!activity.recordId) return;
  const when = activity.completedAt ?? activity.startedAt;
  if (!when || activity.status !== "completed") return;

  const record = await prisma.crmRecord.findUnique({
    where: { id: activity.recordId },
    select: { lastContactDate: true },
  });
  if (!record) return;
  if (record.lastContactDate && record.lastContactDate >= when) return;

  await prisma.crmRecord.update({
    where: { id: activity.recordId },
    data: { lastContactDate: when },
  });
}

/** Merge authoritative call details fetched from the REST API. */
export async function applyCallDetails(
  activityId: string,
  call: QuoCall,
): Promise<void> {
  const existing = await prisma.commsActivity.findUnique({
    where: { id: activityId },
  });
  if (!existing) return;

  const statusWins = isForwardProgress(existing.status, call.status);
  const external =
    (call.participants ?? []).find((p) => typeof p === "string" && p.trim()) ??
    null;

  await prisma.commsActivity.update({
    where: { id: activityId },
    data: {
      ...(statusWins ? { status: call.status } : {}),
      direction: call.direction ?? existing.direction,
      durationSec: keep(call.duration, existing.durationSec),
      providerPhoneNumberId: keep(
        call.phoneNumberId,
        existing.providerPhoneNumberId,
      ),
      providerUserId: keep(call.userId, existing.providerUserId),
      answeredByUserId: keep(call.answeredBy, existing.answeredByUserId),
      externalNumber: keep(external, existing.externalNumber),
      externalNumberE164: keep(external, existing.externalNumberE164),
      startedAt: keep(nullableDate(call.createdAt), existing.startedAt),
      answeredAt: keep(nullableDate(call.answeredAt), existing.answeredAt),
      completedAt: keep(nullableDate(call.completedAt), existing.completedAt),
      aiHandled: keep(call.aiHandled, existing.aiHandled),
      missed:
        existing.missed ||
        call.status === "missed" ||
        call.status === "no-answer" ||
        (call.direction === "incoming" &&
          call.status === "completed" &&
          !call.answeredAt),
    },
  });
}

// ---------------- artifacts ----------------

/**
 * Store recording segments. Keyed by segment index, and matched on
 * Quo's own recording id first, so a redelivered webhook updates the
 * same rows instead of appending a second copy of the same audio.
 */
export async function storeRecordings(
  activityId: string,
  recordings: QuoRecording[],
): Promise<{ stored: number }> {
  let stored = 0;

  for (const [index, rec] of recordings.entries()) {
    const existing = rec.id
      ? await prisma.callArtifact.findFirst({
          where: { activityId, kind: "recording", providerArtifactId: rec.id },
        })
      : null;

    const data = {
      status: rec.status ?? "completed",
      durationSec: rec.duration ?? null,
      mimeType: rec.type ?? null,
      providerUrl: rec.url ?? null,
      startedAt: nullableDate(rec.startTime),
      providerArtifactId: rec.id ?? null,
      fetchedAt: new Date(),
      error: null,
    };

    if (existing) {
      await prisma.callArtifact.update({ where: { id: existing.id }, data });
    } else {
      await prisma.callArtifact.upsert({
        where: {
          activityId_kind_segmentIndex: {
            activityId,
            kind: "recording",
            segmentIndex: index,
          },
        },
        create: {
          activityId,
          kind: "recording",
          segmentIndex: index,
          ...data,
        },
        update: data,
      });
    }
    stored += 1;
  }

  return { stored };
}

/**
 * Store a transcript, preserving Quo's speaker-separated dialogue and
 * building a flat searchable version alongside it.
 */
export async function storeTranscript(
  activityId: string,
  transcript: QuoTranscript,
): Promise<{ ready: boolean }> {
  const dialogue = transcript.dialogue ?? [];
  const ready = transcript.status === "completed" && dialogue.length > 0;

  const text = dialogue
    .map((seg) => seg.content?.trim())
    .filter(Boolean)
    .join("\n");

  const data = {
    status: transcript.status,
    durationSec: transcript.duration ?? null,
    text: text || null,
    dialogue: dialogue.length ? JSON.stringify(dialogue) : null,
    fetchedAt: new Date(),
    error: null,
  };

  await prisma.callArtifact.upsert({
    where: {
      activityId_kind_segmentIndex: {
        activityId,
        kind: "transcript",
        segmentIndex: 0,
      },
    },
    create: { activityId, kind: "transcript", segmentIndex: 0, ...data },
    update: data,
  });

  return { ready };
}

/**
 * Store Quo's summary. Note `summary` and `nextSteps` are arrays of
 * strings, and `nextSteps` is empty on the Business plan — Quo's action
 * items are a Scale-plan feature. Our own extraction fills that gap.
 */
export async function storeSummary(
  activityId: string,
  summary: QuoSummary,
): Promise<{ ready: boolean }> {
  const bullets = summary.summary ?? [];
  const ready = summary.status === "completed" && bullets.length > 0;

  const data = {
    status: summary.status,
    bullets: bullets.length ? JSON.stringify(bullets) : null,
    nextSteps: summary.nextSteps?.length
      ? JSON.stringify(summary.nextSteps)
      : null,
    text: bullets.length ? bullets.join("\n") : null,
    fetchedAt: new Date(),
    error: null,
  };

  await prisma.callArtifact.upsert({
    where: {
      activityId_kind_segmentIndex: {
        activityId,
        kind: "summary",
        segmentIndex: 0,
      },
    },
    create: { activityId, kind: "summary", segmentIndex: 0, ...data },
    update: data,
  });

  return { ready };
}

/**
 * Mirror a finished call into the existing Interaction activity log, so
 * the record drawer that salespeople already use shows calls next to
 * emails and notes. Written once per call.
 */
export async function logCallInteraction(
  activity: CommsActivity,
): Promise<void> {
  if (!activity.recordId || activity.status !== "completed") return;

  const marker = `[quo:${activity.providerActivityId}]`;
  const already = await prisma.interaction.findFirst({
    where: { recordId: activity.recordId, body: { contains: marker } },
  });
  if (already) return;

  const who = displayPhone(
    activity.externalNumber ?? "",
    env.QUO_DEFAULT_REGION,
  );
  const direction = activity.direction === "incoming" ? "Inbound" : "Outbound";
  const outcome = activity.missed
    ? "missed"
    : activity.voicemail
      ? "voicemail"
      : `${Math.round((activity.durationSec ?? 0) / 60)} min`;

  await prisma.interaction.create({
    data: {
      recordId: activity.recordId,
      type: "call",
      date: activity.completedAt ?? activity.startedAt ?? new Date(),
      actor: "system",
      body: `${direction} call (${outcome})${who ? ` with ${who}` : ""} ${marker}`,
    },
  });
}
