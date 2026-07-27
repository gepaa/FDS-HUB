import { prisma } from "@/lib/prisma";
import { quoClient } from "@/lib/quo/client";
import { QuoApiError } from "@/lib/quo/errors";
import { QUO_PROVIDER, quoStatus } from "@/lib/quo/config";
import { parseEnvelope, callIdOf, artifactKindFor } from "@/lib/quo/events";
import {
  upsertCallFromEnvelope,
  applyCallDetails,
  storeRecordings,
  storeTranscript,
  storeSummary,
  logCallInteraction,
} from "@/lib/quo/sync";
import { runExtraction } from "@/lib/quo/extraction";
import { enqueue, claimDue, completeJob, failJob } from "@/lib/quo/queue";
import { recordMetric, logIntegration } from "@/lib/quo/observability";

/**
 * Job handlers and the drain loop.
 *
 * Ordering is not assumed anywhere. Each handler is safe to run first,
 * last, twice, or a week late. That is what makes duplicate webhook
 * delivery and out-of-order events non-events rather than incidents.
 */

type Handler = (payload: Record<string, unknown>) => Promise<void>;

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v : null;

/**
 * Process a stored webhook event: update the call, then queue whatever
 * artifact this event says is now available.
 */
const processWebhook: Handler = async (payload) => {
  const eventId = str(payload.webhookEventId);
  if (!eventId) return;

  const event = await prisma.webhookEvent.findUnique({ where: { id: eventId } });
  if (!event) return;
  if (event.status === "processed") return; // idempotent replay

  await prisma.webhookEvent.update({
    where: { id: eventId },
    data: { status: "processing", attempts: { increment: 1 } },
  });

  try {
    const envelope = parseEnvelope(JSON.parse(event.payload));
    if (!envelope) throw new Error("unparseable_payload");

    const eventType = event.eventType;
    const result = await upsertCallFromEnvelope(envelope, eventType);

    if (!result) {
      await prisma.webhookEvent.update({
        where: { id: eventId },
        data: {
          status: "skipped",
          processedAt: new Date(),
          lastError: "no_call_id",
        },
      });
      return;
    }

    const { activity, leadCreated } = result;
    const callId = callIdOf(envelope) ?? activity.providerActivityId;

    if (leadCreated) recordMetric("quo.lead.created");
    recordMetric(
      activity.recordId ? "quo.call.matched" : "quo.call.unmatched",
    );

    // Ask Quo for the authoritative call record once it has ended —
    // webhook payloads are a notification, not a source of truth.
    if (eventType === "call.completed" || eventType === "call.missed") {
      await enqueue(
        "quo.fetch_call",
        { activityId: activity.id, callId },
        { dedupeKey: `quo.fetch_call:${callId}` },
      );
    }

    // Artifact events tell us something is ready to collect.
    const kind = artifactKindFor(eventType);
    if (kind === "recording") {
      await enqueue(
        "quo.fetch_recording",
        { activityId: activity.id, callId },
        { dedupeKey: `quo.fetch_recording:${callId}` },
      );
    } else if (kind === "transcript") {
      await enqueue(
        "quo.fetch_transcript",
        { activityId: activity.id, callId },
        { dedupeKey: `quo.fetch_transcript:${callId}` },
      );
    } else if (kind === "summary") {
      await enqueue(
        "quo.fetch_summary",
        { activityId: activity.id, callId },
        { dedupeKey: `quo.fetch_summary:${callId}` },
      );
    }

    await logCallInteraction(activity);

    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: { status: "processed", processedAt: new Date(), lastError: null },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: { status: "failed", lastError: message.slice(0, 500) },
    });
    throw err;
  }
};

const fetchCall: Handler = async (payload) => {
  const activityId = str(payload.activityId);
  const callId = str(payload.callId);
  if (!activityId || !callId) return;

  const call = await quoClient.getCall(callId);
  await applyCallDetails(activityId, call);

  const activity = await prisma.commsActivity.findUnique({
    where: { id: activityId },
  });
  if (activity) await logCallInteraction(activity);
};

const fetchRecording: Handler = async (payload) => {
  const activityId = str(payload.activityId);
  const callId = str(payload.callId);
  if (!activityId || !callId) return;

  const recordings = await quoClient.getRecordings(callId);
  // An empty array right after the event is normal — Quo is still
  // finishing the file. Ask again rather than recording "no recording".
  if (recordings.length === 0) {
    throw new QuoApiError({
      message: "recording not ready",
      kind: "not_ready",
      path: `/call-recordings/${callId}`,
    });
  }

  const { stored } = await storeRecordings(activityId, recordings);
  recordMetric("quo.recording.fetched", stored);
};

const fetchTranscript: Handler = async (payload) => {
  const activityId = str(payload.activityId);
  const callId = str(payload.callId);
  if (!activityId || !callId) return;

  const transcript = await quoClient.getTranscript(callId);
  const { ready } = await storeTranscript(activityId, transcript);

  if (transcript.status === "in-progress") {
    throw new QuoApiError({
      message: "transcript still processing",
      kind: "not_ready",
      path: `/call-transcripts/${callId}`,
    });
  }

  if (ready) {
    recordMetric("quo.transcript.fetched");
    await enqueue(
      "quo.extract",
      { activityId },
      { dedupeKey: `quo.extract:${activityId}` },
    );
  }
};

const fetchSummary: Handler = async (payload) => {
  const activityId = str(payload.activityId);
  const callId = str(payload.callId);
  if (!activityId || !callId) return;

  const summary = await quoClient.getSummary(callId);
  const { ready } = await storeSummary(activityId, summary);

  if (summary.status === "in-progress") {
    throw new QuoApiError({
      message: "summary still processing",
      kind: "not_ready",
      path: `/call-summaries/${callId}`,
    });
  }

  if (ready) {
    recordMetric("quo.summary.fetched");
    await enqueue(
      "quo.extract",
      { activityId },
      { dedupeKey: `quo.extract:${activityId}` },
    );
  }
};

const extract: Handler = async (payload) => {
  const activityId = str(payload.activityId);
  if (!activityId) return;
  const outcome = await runExtraction(activityId);
  if (outcome.status === "completed") recordMetric("quo.extraction.completed");
  if (outcome.status === "failed") recordMetric("quo.extraction.failed");
};

const reconcile: Handler = async () => {
  const { reconcileRecentCalls } = await import("@/lib/quo/reconcile");
  await reconcileRecentCalls();
};

const HANDLERS: Record<string, Handler> = {
  "quo.process_webhook": processWebhook,
  "quo.fetch_call": fetchCall,
  "quo.fetch_recording": fetchRecording,
  "quo.fetch_transcript": fetchTranscript,
  "quo.fetch_summary": fetchSummary,
  "quo.extract": extract,
  "quo.reconcile": reconcile,
};

export interface DrainResult {
  claimed: number;
  succeeded: number;
  failed: number;
}

/**
 * Run due jobs. Called twice: right after a webhook is acknowledged
 * (via waitUntil, so the caller never waits) and from cron.
 *
 * Every job is individually try/caught — one poisoned job must not stop
 * the rest of the queue moving.
 */
export async function drainJobs(limit = 10): Promise<DrainResult> {
  if (!quoStatus().enabled) return { claimed: 0, succeeded: 0, failed: 0 };

  const jobs = await claimDue(limit);
  let succeeded = 0;
  let failed = 0;

  for (const job of jobs) {
    const handler = HANDLERS[job.kind];
    if (!handler) {
      await failJob(job.id, `unknown job kind: ${job.kind}`, {
        retryable: false,
      });
      failed += 1;
      continue;
    }

    const startedAt = Date.now();
    try {
      await handler(job.payload);
      await completeJob(job.id);
      succeeded += 1;
      logIntegration({
        stage: job.kind,
        outcome: "success",
        durationMs: Date.now() - startedAt,
        attempt: job.attempts,
      });
    } catch (err) {
      failed += 1;
      const isQuo = err instanceof QuoApiError;
      const retryable = isQuo ? err.isRetryable : true;
      const message = err instanceof Error ? err.message : "unknown_error";

      await failJob(job.id, message, {
        retryable,
        retryAfterSeconds: isQuo ? err.retryAfterSeconds : null,
      });

      recordMetric("quo.job.failed");
      logIntegration({
        stage: job.kind,
        outcome: "failure",
        durationMs: Date.now() - startedAt,
        attempt: job.attempts,
        errorCode: isQuo ? err.kind : "unhandled",
      });
    }
  }

  return { claimed: jobs.length, succeeded, failed };
}

/** Queue the first fetch for a call we learned about outside a webhook. */
export async function enqueueArtifactFetches(
  activityId: string,
  callId: string,
): Promise<void> {
  await enqueue(
    "quo.fetch_recording",
    { activityId, callId },
    { dedupeKey: `quo.fetch_recording:${callId}` },
  );
  await enqueue(
    "quo.fetch_transcript",
    { activityId, callId },
    { dedupeKey: `quo.fetch_transcript:${callId}` },
  );
  await enqueue(
    "quo.fetch_summary",
    { activityId, callId },
    { dedupeKey: `quo.fetch_summary:${callId}` },
  );
}

export { QUO_PROVIDER };
