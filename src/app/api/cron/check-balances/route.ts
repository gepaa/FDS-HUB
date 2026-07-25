import { env } from "@/lib/env";
import { checkAndAlert } from "@/lib/ad-budget-alerts";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/check-balances — the daily budget sweep.
 *
 * Vercel Cron hits this on a schedule (see vercel.json). It projects
 * runout for every active ad account and pushes a Discord alert for any
 * that need a top-up, deduped so it nudges once per crossing.
 *
 * Auth: Vercel sends `Authorization: Bearer <CRON_SECRET>` when
 * CRON_SECRET is set. We accept that, or the agent bearer token, or —
 * when neither secret is configured (local dev) — an open call.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;
  const agentKey = env.AGENT_API_KEY;

  const authorized =
    (!cronSecret && !agentKey) || // local dev, nothing to check against
    (cronSecret && auth === `Bearer ${cronSecret}`) ||
    (agentKey && auth === `Bearer ${agentKey}`);

  if (!authorized) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await checkAndAlert();
  return Response.json({ ok: true, ...result });
}
