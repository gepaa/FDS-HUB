import { prisma } from "@/lib/prisma";
import { quoClient, paginate, type QuoCall } from "@/lib/quo/client";
import { QUO_PROVIDER, quoStatus, syncedPhoneNumberIds } from "@/lib/quo/config";
import { matchLead } from "@/lib/quo/matching";
import { applyCallDetails, logCallInteraction } from "@/lib/quo/sync";
import { enqueueArtifactFetches } from "@/lib/quo/jobs";
import {
  setState,
  STATE_KEYS,
  logIntegration,
  recordMetric,
} from "@/lib/quo/observability";

/**
 * Repairing gaps: calls that happened but never reached the CRM.
 *
 * THE AWKWARD BIT. Quo has no "list recent calls on this number"
 * endpoint. `GET /v1/calls` requires BOTH a phoneNumberId AND the
 * participant's number, and only supports 1:1 conversations — so you
 * cannot enumerate calls without already knowing who was on them.
 *
 * The way through is two-stage:
 *   1. `GET /v1/conversations` lists conversations for our numbers and
 *      tells us who the participants are and when they were last
 *      active. This is the index Quo doesn't provide for calls.
 *   2. For each recently-active conversation, ask `GET /v1/calls` for
 *      that specific participant.
 *
 * That is more requests than a single "list calls" would be, so both
 * entry points are bounded: a small rolling window for the periodic
 * job, and explicit limits with a dry-run mode for the administrative
 * backfill. Nothing here ever runs unbounded against production.
 *
 * Pagination follows `nextPageToken` only. Quo documents `totalItems`
 * as inaccurate, so it is never used to decide when to stop.
 */

export interface ReconcileOptions {
  /** How far back to look. Keep small for the periodic job. */
  sinceHours?: number;
  /** Report what would happen without writing anything. */
  dryRun?: boolean;
  /** Hard ceiling on conversations examined. */
  maxConversations?: number;
  /** Hard ceiling on calls imported. */
  maxCalls?: number;
  /** Restrict to one Quo number. */
  phoneNumberId?: string;
  /** Explicit window for administrative backfill. */
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface ReconcileResult {
  ok: boolean;
  reason?: string;
  dryRun: boolean;
  conversationsScanned: number;
  callsSeen: number;
  callsImported: number;
  callsAlreadyPresent: number;
  unmatchedCallers: string[];
  truncated: boolean;
  errors: string[];
}

const emptyResult = (dryRun: boolean): ReconcileResult => ({
  ok: true,
  dryRun,
  conversationsScanned: 0,
  callsSeen: 0,
  callsImported: 0,
  callsAlreadyPresent: 0,
  unmatchedCallers: [],
  truncated: false,
  errors: [],
});

export async function reconcileRecentCalls(
  opts: ReconcileOptions = {},
): Promise<ReconcileResult> {
  const dryRun = opts.dryRun ?? false;
  const result = emptyResult(dryRun);

  const status = quoStatus();
  if (!status.canCallApi) {
    return { ...result, ok: false, reason: "integration_not_configured" };
  }

  const sinceHours = opts.sinceHours ?? 24;
  const createdAfter =
    opts.createdAfter ?? new Date(Date.now() - sinceHours * 60 * 60 * 1000);
  const createdBefore = opts.createdBefore ?? null;
  const maxConversations = opts.maxConversations ?? 100;
  const maxCalls = opts.maxCalls ?? 200;

  const phoneNumberIds = opts.phoneNumberId
    ? [opts.phoneNumberId]
    : syncedPhoneNumberIds();

  // Stage 1 — the conversation index.
  let conversations;
  try {
    const page = await paginate(
      (pageToken) =>
        quoClient.listConversations({
          phoneNumbers: phoneNumberIds.length ? phoneNumberIds : undefined,
          updatedAfter: createdAfter.toISOString(),
          maxResults: 50,
          pageToken,
        }),
      { maxPages: 10, maxItems: maxConversations },
    );
    conversations = page.items;
    result.truncated = page.truncated;
  } catch (err) {
    return {
      ...result,
      ok: false,
      reason: "conversation_list_failed",
      errors: [err instanceof Error ? err.message : "unknown"],
    };
  }

  // Stage 2 — calls per participant.
  for (const conversation of conversations) {
    if (result.callsImported >= maxCalls) {
      result.truncated = true;
      break;
    }
    result.conversationsScanned += 1;

    const phoneNumberId = conversation.phoneNumberId;
    const participants = (conversation.participants ?? []).filter(
      (p): p is string => typeof p === "string" && p.trim().length > 0,
    );
    if (!phoneNumberId || participants.length === 0) continue;
    // Quo only supports 1:1 for call listing; group threads are skipped
    // rather than silently half-imported.
    if (participants.length > 1) continue;

    let calls: QuoCall[];
    try {
      const page = await paginate(
        (pageToken) =>
          quoClient.listCalls({
            phoneNumberId,
            participants,
            createdAfter: createdAfter.toISOString(),
            createdBefore: createdBefore?.toISOString(),
            maxResults: 50,
            pageToken,
          }),
        { maxPages: 5, maxItems: 100 },
      );
      calls = page.items;
      if (page.truncated) result.truncated = true;
    } catch (err) {
      result.errors.push(
        `calls(${phoneNumberId}): ${err instanceof Error ? err.message : "unknown"}`,
      );
      continue;
    }

    for (const call of calls) {
      result.callsSeen += 1;
      if (!call.id) continue;

      const existing = await prisma.commsActivity.findUnique({
        where: {
          provider_providerActivityId: {
            provider: QUO_PROVIDER,
            providerActivityId: call.id,
          },
        },
      });

      if (existing) {
        result.callsAlreadyPresent += 1;
        continue;
      }

      if (result.callsImported >= maxCalls) {
        result.truncated = true;
        break;
      }

      if (dryRun) {
        result.callsImported += 1;
        continue;
      }

      try {
        await importCall(call, result);
        result.callsImported += 1;
      } catch (err) {
        result.errors.push(
          `import(${call.id}): ${err instanceof Error ? err.message : "unknown"}`,
        );
      }
    }
  }

  if (!dryRun) {
    await setState(STATE_KEYS.lastReconcile, {
      at: new Date().toISOString(),
      imported: result.callsImported,
      scanned: result.conversationsScanned,
      truncated: result.truncated,
    });
    if (result.callsImported > 0) {
      recordMetric("quo.reconcile.repaired", result.callsImported);
    }
  }

  logIntegration({
    stage: "quo.reconcile",
    outcome: result.errors.length ? "failure" : "success",
    errorCode: result.errors.length ? "partial" : undefined,
  });

  return result;
}

/** Create the CRM activity for a call reconciliation found. */
async function importCall(
  call: QuoCall,
  result: ReconcileResult,
): Promise<void> {
  const external =
    (call.participants ?? []).find(
      (p) => typeof p === "string" && p.trim().length > 0,
    ) ?? null;

  const match = await matchLead({
    externalNumber: external,
    direction: call.direction,
    occurredAt: call.createdAt ? new Date(call.createdAt) : new Date(),
  });

  if (!match.record && external && !result.unmatchedCallers.includes(external)) {
    result.unmatchedCallers.push(external);
  }

  const activity = await prisma.commsActivity.create({
    data: {
      provider: QUO_PROVIDER,
      providerActivityId: call.id,
      recordId: match.record?.id ?? null,
      type: "call",
      direction: call.direction ?? "incoming",
      status: call.status ?? "completed",
      providerPhoneNumberId: call.phoneNumberId ?? null,
      providerUserId: call.userId ?? null,
      answeredByUserId: call.answeredBy ?? null,
      externalNumber: external,
      externalNumberE164: external,
      startedAt: call.createdAt ? new Date(call.createdAt) : null,
      answeredAt: call.answeredAt ? new Date(call.answeredAt) : null,
      completedAt: call.completedAt ? new Date(call.completedAt) : null,
      durationSec: call.duration ?? null,
      aiHandled: call.aiHandled ?? null,
      missed:
        call.status === "missed" ||
        call.status === "no-answer" ||
        (call.direction === "incoming" &&
          call.status === "completed" &&
          !call.answeredAt),
      raw: JSON.stringify(call).slice(0, 20_000),
    },
  });

  await applyCallDetails(activity.id, call);
  await logCallInteraction(activity);
  // Artifacts are collected by the queue, not inline — a backfill must
  // not turn into a long chain of blocking downloads.
  await enqueueArtifactFetches(activity.id, call.id);
}

/**
 * Administrative backfill over an explicit window.
 *
 * Separate entry point from the periodic job on purpose: this one
 * requires a date range, supports a dry run, and is never scheduled.
 * §21 — no unbounded production backfill runs automatically.
 */
export async function backfillCalls(opts: {
  startDate: Date;
  endDate: Date;
  phoneNumberId?: string;
  dryRun?: boolean;
  maxCalls?: number;
}): Promise<ReconcileResult> {
  const result = await reconcileRecentCalls({
    createdAfter: opts.startDate,
    createdBefore: opts.endDate,
    phoneNumberId: opts.phoneNumberId,
    dryRun: opts.dryRun ?? true,
    maxCalls: opts.maxCalls ?? 200,
    maxConversations: 200,
  });

  if (!opts.dryRun) {
    await setState(STATE_KEYS.lastBackfill, {
      at: new Date().toISOString(),
      from: opts.startDate.toISOString(),
      to: opts.endDate.toISOString(),
      imported: result.callsImported,
      truncated: result.truncated,
    });
  }

  return result;
}
