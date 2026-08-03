import { env } from "@/lib/env";
import { sendDueReminders } from "@/lib/reminder-alerts";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/send-reminders — the daily reminder sweep.
 *
 * Vercel Cron hits this at 08:00 UTC (see vercel.json). Everything
 * scheduled for today or earlier pushes to Discord; repeating reminders
 * roll to their next occurrence and one-offs are marked done. The sweep
 * is idempotent — a reminder that already fired today is skipped — so a
 * retry or a manual "Send due now" can't double-buzz the phone.
 *
 * Auth mirrors /api/cron/check-balances: Vercel's `Bearer <CRON_SECRET>`,
 * or the agent bearer token, or — when neither secret is configured
 * (local dev) — an open call.
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

  const result = await sendDueReminders();
  return Response.json({ ok: true, ...result });
}
