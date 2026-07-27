import { env } from "@/lib/env";
import { quoStatus } from "@/lib/quo/config";
import { drainJobs } from "@/lib/quo/jobs";
import { enqueue, queueStats } from "@/lib/quo/queue";
import { reconcileRecentCalls } from "@/lib/quo/reconcile";
import { getState, STATE_KEYS } from "@/lib/quo/observability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Draining a batch can involve several Quo round-trips.
export const maxDuration = 60;

/**
 * GET /api/cron/quo-drain — the safety net.
 *
 * The normal path is the webhook itself: it enqueues, acknowledges, and
 * drains in an `after()` callback, so calls appear in the CRM within a
 * second or two. This route exists for the cases that path cannot cover:
 *
 *   - jobs whose backoff had not elapsed when the webhook drained
 *   - jobs abandoned mid-flight when an instance was recycled
 *   - artifacts Quo produced later than the event that announced them
 *   - webhooks that never arrived at all (reconciliation)
 *
 * Auth mirrors the existing check-balances cron: Vercel's CRON_SECRET,
 * the agent bearer token, or — when neither secret is configured, i.e.
 * local dev — an open call.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;
  const agentKey = env.AGENT_API_KEY;

  const authorized =
    (!cronSecret && !agentKey) ||
    (cronSecret && auth === `Bearer ${cronSecret}`) ||
    (agentKey && auth === `Bearer ${agentKey}`);

  if (!authorized) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = quoStatus();
  if (!status.enabled) {
    return Response.json({ ok: true, skipped: "integration_disabled" });
  }

  // Drain first — clearing the backlog is more urgent than looking for
  // new gaps, and a reconcile enqueues work this pass would have run.
  const drained = await drainJobs(25);

  // Reconcile at most hourly, regardless of how often cron fires.
  let reconcileQueued = false;
  if (status.canCallApi) {
    const last = await getState<{ at?: string }>(STATE_KEYS.lastReconcile);
    const lastAt = last?.value?.at ? new Date(last.value.at).getTime() : 0;
    if (Date.now() - lastAt > 60 * 60 * 1000) {
      await enqueue(
        "quo.reconcile",
        {},
        { dedupeKey: `quo.reconcile:${new Date().toISOString().slice(0, 13)}` },
      );
      reconcileQueued = true;
    }
  }

  // Pick up anything the reconcile enqueue just added.
  const second = reconcileQueued ? await drainJobs(10) : null;

  return Response.json({
    ok: true,
    drained,
    reconcileQueued,
    second,
    queue: await queueStats(),
  });
}

/**
 * POST — same work, triggered by an administrator from the integration
 * settings page ("Run now"). Kept separate from GET so a browser
 * prefetch can never start a drain.
 */
export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const agentKey = env.AGENT_API_KEY;
  if (agentKey && auth !== `Bearer ${agentKey}` && !auth.startsWith("Basic ")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!quoStatus().enabled) {
    return Response.json({ ok: true, skipped: "integration_disabled" });
  }
  const drained = await drainJobs(25);
  const reconciled = await reconcileRecentCalls({ sinceHours: 6 });
  return Response.json({ ok: true, drained, reconciled });
}
