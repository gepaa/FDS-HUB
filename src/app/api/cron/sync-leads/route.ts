import { env } from "@/lib/env";
import { syncShopifyLeads } from "@/lib/lead-sync";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/sync-leads — the daily Shopify → Leads pull.
 *
 * Vercel Cron hits this each morning (see vercel.json) so new customers
 * show up in the Leads CRM without anyone pressing a button. The sync is
 * idempotent, so a retry is harmless.
 *
 * Auth mirrors the other cron routes: Vercel's `Bearer <CRON_SECRET>`,
 * the agent bearer token, or — when neither is configured (local dev) —
 * an open call.
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

  const result = await syncShopifyLeads();
  return Response.json({ ok: true, ...result });
}
