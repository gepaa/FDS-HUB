import { env } from "@/lib/env";
import { checkSupplierFollowUps } from "@/lib/supplier-follow-ups";

export const dynamic = "force-dynamic";

/** Daily Discord reminders for due supplier follow-ups. */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const cronSecret = env.CRON_SECRET;
  const agentKey = env.AGENT_API_KEY;
  const authorized =
    (!cronSecret && !agentKey) ||
    (cronSecret && auth === `Bearer ${cronSecret}`) ||
    (agentKey && auth === `Bearer ${agentKey}`);

  if (!authorized) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await checkSupplierFollowUps();
  return Response.json({ ok: true, ...result });
}
