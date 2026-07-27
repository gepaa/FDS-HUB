import { prisma } from "@/lib/prisma";
import { backoffMs } from "@/lib/quo/errors";

/**
 * A database-backed job queue.
 *
 * WHY THIS AND NOT A REAL QUEUE: the hub runs on Vercel serverless.
 * There is no long-lived process to host a worker, and adding Redis +
 * BullMQ (or an external queue service) for a few dozen jobs a day
 * would be a bigger operational commitment than the problem deserves.
 *
 * So jobs are rows. Three things drive them:
 *   1. The webhook route enqueues, returns 2xx immediately, and drains
 *      in the background via waitUntil — the normal path, sub-second.
 *   2. A cron route drains anything left behind — the safety net for
 *      retries and for work whose backoff hadn't elapsed.
 *   3. A stuck-job sweep re-queues rows abandoned mid-flight, which is
 *      what happens when a serverless instance is killed mid-run.
 *
 * Claiming is a conditional UPDATE, so two instances draining at the
 * same time cannot run the same job twice.
 */

export type JobKind =
  | "quo.process_webhook"
  | "quo.fetch_call"
  | "quo.fetch_recording"
  | "quo.fetch_transcript"
  | "quo.fetch_summary"
  | "quo.extract"
  | "quo.reconcile";

export interface EnqueueOptions {
  /**
   * Makes enqueueing idempotent. A second enqueue with the same key is
   * a no-op while the first is still outstanding — this is what stops a
   * redelivered webhook from queueing a second transcript fetch.
   */
  dedupeKey?: string;
  /** Earliest time this may run. */
  runAfter?: Date;
  maxAttempts?: number;
}

/** A job stuck in `running` longer than this is presumed dead. */
const STUCK_AFTER_MS = 10 * 60 * 1000;

export async function enqueue(
  kind: JobKind,
  payload: Record<string, unknown>,
  opts: EnqueueOptions = {},
): Promise<{ enqueued: boolean; id: string | null }> {
  const dedupeKey = opts.dedupeKey ?? null;

  if (dedupeKey) {
    const existing = await prisma.jobQueue.findUnique({ where: { dedupeKey } });
    if (existing) {
      // Outstanding work already covers this. Done/dead rows are
      // replaced so the same job can legitimately run again later
      // (e.g. a retry requested by an administrator).
      if (existing.status === "queued" || existing.status === "running") {
        return { enqueued: false, id: existing.id };
      }
      await prisma.jobQueue.delete({ where: { id: existing.id } });
    }
  }

  const job = await prisma.jobQueue.create({
    data: {
      kind,
      payload: JSON.stringify(payload),
      dedupeKey,
      runAfter: opts.runAfter ?? new Date(),
      maxAttempts: opts.maxAttempts ?? 5,
    },
  });
  return { enqueued: true, id: job.id };
}

export interface ClaimedJob {
  id: string;
  kind: JobKind;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
}

/**
 * Atomically take up to `limit` due jobs. The conditional update is the
 * lock: whoever flips `queued` → `running` owns the row.
 */
export async function claimDue(limit = 10): Promise<ClaimedJob[]> {
  await requeueStuck();

  const candidates = await prisma.jobQueue.findMany({
    where: { status: "queued", runAfter: { lte: new Date() } },
    orderBy: { runAfter: "asc" },
    take: limit,
    select: { id: true },
  });

  const claimed: ClaimedJob[] = [];
  for (const { id } of candidates) {
    const result = await prisma.jobQueue.updateMany({
      where: { id, status: "queued" },
      data: { status: "running", startedAt: new Date() },
    });
    if (result.count !== 1) continue; // someone else got it

    const job = await prisma.jobQueue.findUnique({ where: { id } });
    if (!job) continue;
    claimed.push({
      id: job.id,
      kind: job.kind as JobKind,
      payload: safeParse(job.payload),
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
    });
  }
  return claimed;
}

export async function completeJob(id: string): Promise<void> {
  await prisma.jobQueue.update({
    where: { id },
    data: { status: "done", finishedAt: new Date(), lastError: null },
  });
}

/**
 * Record a failure. Retryable failures go back to `queued` with
 * backoff; anything else — or anything out of attempts — is parked as
 * `dead` for a human. We never retry forever.
 */
export async function failJob(
  id: string,
  error: string,
  opts: { retryable: boolean; retryAfterSeconds?: number | null } = {
    retryable: true,
  },
): Promise<void> {
  const job = await prisma.jobQueue.findUnique({ where: { id } });
  if (!job) return;

  const attempts = job.attempts + 1;
  const exhausted = attempts >= job.maxAttempts;
  const safeError = error.slice(0, 500);

  if (!opts.retryable || exhausted) {
    await prisma.jobQueue.update({
      where: { id },
      data: {
        status: "dead",
        attempts,
        finishedAt: new Date(),
        lastError: safeError,
      },
    });
    return;
  }

  const delay =
    opts.retryAfterSeconds != null
      ? opts.retryAfterSeconds * 1000
      : backoffMs(attempts);

  await prisma.jobQueue.update({
    where: { id },
    data: {
      status: "queued",
      attempts,
      runAfter: new Date(Date.now() + delay),
      lastError: safeError,
      startedAt: null,
    },
  });
}

/** Return abandoned `running` rows to the queue. */
async function requeueStuck(): Promise<number> {
  const cutoff = new Date(Date.now() - STUCK_AFTER_MS);
  const result = await prisma.jobQueue.updateMany({
    where: { status: "running", startedAt: { lt: cutoff } },
    data: { status: "queued", startedAt: null },
  });
  return result.count;
}

export async function queueStats() {
  const rows = await prisma.jobQueue.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const out: Record<string, number> = {
    queued: 0,
    running: 0,
    done: 0,
    failed: 0,
    dead: 0,
  };
  for (const r of rows) out[r.status] = r._count._all;
  return out;
}

function safeParse(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
