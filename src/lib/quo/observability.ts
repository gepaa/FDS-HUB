import { prisma } from "@/lib/prisma";

/**
 * Integration logging and metrics.
 *
 * WHAT IS NEVER LOGGED: transcript text, summary text, recording URLs,
 * API keys, webhook secrets, signature values, or full webhook
 * payloads. A customer discussing their finances on a recorded call
 * must not end up in a log aggregator. Identifiers and outcomes are
 * enough to diagnose every failure this integration can have.
 *
 * Metrics are DERIVED from rows rather than kept in counters. Counters
 * would need read-modify-write on every event, which races across
 * serverless instances and quietly under-reports. Counting the rows we
 * already store is race-free and cannot drift from reality.
 */

export interface IntegrationLog {
  stage: string;
  outcome: "success" | "failure" | "skipped";
  durationMs?: number;
  attempt?: number;
  errorCode?: string;
  eventType?: string;
  /** Quo call id — an opaque identifier, safe to log. */
  callId?: string;
  activityId?: string;
  recordId?: string;
}

export function logIntegration(entry: IntegrationLog): void {
  // Single-line JSON so it greps and parses in Vercel's log viewer.
  console.log(
    JSON.stringify({
      scope: "quo",
      ts: new Date().toISOString(),
      ...entry,
    }),
  );
}

/**
 * A named occurrence. Emitted as a log line only — the settings page
 * reads real counts from the database instead of trusting a counter.
 */
export function recordMetric(name: string, count = 1): void {
  console.log(
    JSON.stringify({ scope: "quo", metric: name, count, ts: new Date().toISOString() }),
  );
}

// ---------------- integration state ----------------

export async function setState(
  key: string,
  value: Record<string, unknown>,
): Promise<void> {
  const payload = JSON.stringify(value);
  await prisma.integrationState.upsert({
    where: { key },
    create: { key, value: payload },
    update: { value: payload },
  });
}

export async function getState<T = Record<string, unknown>>(
  key: string,
): Promise<{ value: T; updatedAt: Date } | null> {
  const row = await prisma.integrationState.findUnique({ where: { key } });
  if (!row) return null;
  try {
    return { value: JSON.parse(row.value) as T, updatedAt: row.updatedAt };
  } catch {
    return null;
  }
}

export const STATE_KEYS = {
  lastWebhook: "quo:last_webhook",
  lastReconcile: "quo:last_reconcile",
  lastBackfill: "quo:last_backfill",
  lastApiCheck: "quo:last_api_check",
} as const;

// ---------------- derived metrics ----------------

export interface QuoMetrics {
  webhooksReceived: number;
  invalidSignatures: number;
  duplicatesIgnored: number;
  eventsFailed: number;
  callsTotal: number;
  callsMatched: number;
  callsUnmatched: number;
  missedCalls: number;
  leadsCreated: number;
  recordings: number;
  transcripts: number;
  summaries: number;
  extractionsCompleted: number;
  extractionsNeedingReview: number;
  followUpsProposed: number;
  jobsQueued: number;
  jobsDead: number;
}

export async function getMetrics(): Promise<QuoMetrics> {
  const [
    webhooksReceived,
    invalidSignatures,
    duplicatesIgnored,
    eventsFailed,
    callsTotal,
    callsMatched,
    missedCalls,
    leadsCreated,
    recordings,
    transcripts,
    summaries,
    extractionsCompleted,
    extractionsNeedingReview,
    followUpsProposed,
    jobsQueued,
    jobsDead,
  ] = await Promise.all([
    prisma.webhookEvent.count(),
    prisma.webhookEvent.count({ where: { signatureValid: false } }),
    prisma.webhookEvent.count({ where: { status: "skipped" } }),
    prisma.webhookEvent.count({ where: { status: "failed" } }),
    prisma.commsActivity.count(),
    prisma.commsActivity.count({ where: { NOT: { recordId: null } } }),
    prisma.commsActivity.count({ where: { missed: true } }),
    prisma.crmRecord.count({ where: { source: "Inbound Quo Call" } }),
    prisma.callArtifact.count({
      where: { kind: "recording", status: "completed" },
    }),
    prisma.callArtifact.count({
      where: { kind: "transcript", status: "completed" },
    }),
    prisma.callArtifact.count({
      where: { kind: "summary", status: "completed" },
    }),
    prisma.callExtraction.count({ where: { status: "completed" } }),
    prisma.callExtraction.count({ where: { needsHumanReview: true } }),
    prisma.hqTask.count({ where: { source: "quo_call" } }),
    prisma.jobQueue.count({ where: { status: "queued" } }),
    prisma.jobQueue.count({ where: { status: "dead" } }),
  ]);

  return {
    webhooksReceived,
    invalidSignatures,
    duplicatesIgnored,
    eventsFailed,
    callsTotal,
    callsMatched,
    callsUnmatched: callsTotal - callsMatched,
    missedCalls,
    leadsCreated,
    recordings,
    transcripts,
    summaries,
    extractionsCompleted,
    extractionsNeedingReview,
    followUpsProposed,
    jobsQueued,
    jobsDead,
  };
}

/** Most recent integration failures, for the settings page. */
export async function recentErrors(limit = 10) {
  const [events, jobs] = await Promise.all([
    prisma.webhookEvent.findMany({
      where: { status: "failed" },
      orderBy: { receivedAt: "desc" },
      take: limit,
      select: {
        id: true,
        eventType: true,
        lastError: true,
        receivedAt: true,
        attempts: true,
      },
    }),
    prisma.jobQueue.findMany({
      where: { status: "dead" },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: {
        id: true,
        kind: true,
        lastError: true,
        updatedAt: true,
        attempts: true,
      },
    }),
  ]);

  return { events, jobs };
}
