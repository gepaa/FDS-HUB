import { z } from "zod";
import { resolveActor } from "@/lib/agent-auth";
import { sendDueReminders, sendTestReminder } from "@/lib/reminder-alerts";

export const dynamic = "force-dynamic";

const sendInput = z.object({
  /** When set, push this one reminder immediately as a test. */
  reminderId: z.string().trim().min(1).optional(),
});

/**
 * POST /api/reminders/send — the manual trigger behind the UI buttons.
 *
 * With `reminderId` it sends that single reminder as a test push
 * (schedule untouched). Without it, it runs the same sweep the daily
 * cron runs: every due reminder fires, repeats roll forward, one-offs
 * complete.
 */
export async function POST(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;

  const body = await request.json().catch(() => ({}));
  const parsed = sendInput.safeParse(body ?? {});
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  if (parsed.data.reminderId) {
    const result = await sendTestReminder(parsed.data.reminderId);
    if (result.error === "Reminder not found") {
      return Response.json({ error: result.error }, { status: 404 });
    }
    return Response.json({ ok: true, test: true, ...result });
  }

  const result = await sendDueReminders();
  return Response.json({ ok: true, test: false, ...result });
}
