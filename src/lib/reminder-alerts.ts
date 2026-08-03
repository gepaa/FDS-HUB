import { prisma } from "@/lib/prisma";
import { notify, reminderWebhookUrl } from "@/lib/notify";
import {
  duePhrase,
  isDue,
  nextOccurrence,
  repeatLabel,
  severityFor,
} from "@/lib/reminders";

/**
 * The reminder delivery engine. Shared by the daily cron
 * (/api/cron/send-reminders) and the manual "Send due now" button so
 * both behave identically.
 *
 * Sweep rule: every `scheduled` reminder dated today or earlier fires.
 * After firing,
 *   - repeating → `dueAt` rolls to the next occurrence, stays scheduled
 *   - one-off   → marked `done`
 * so a reminder can never fire twice for the same occurrence.
 *
 * Dedupe: a reminder that already fired today is skipped. That makes
 * the sweep idempotent — pressing "Send due now" after the cron has run
 * won't double-buzz the phone, and a cron retry is harmless.
 */

const HUB_URL = "/reminders";

export interface ReminderOutcome {
  id: string;
  title: string;
  fired: boolean;
  delivered: boolean;
  reason?: string;
  /** Next due date for repeating reminders, ISO. */
  rescheduledTo?: string;
}

/** Did this reminder already push today? Keeps the sweep idempotent. */
async function firedToday(reminderId: string, now: Date): Promise<boolean> {
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const hit = await prisma.reminderEvent.findFirst({
    where: {
      reminderId,
      kind: "fired",
      createdAt: { gte: startOfToday },
    },
    select: { id: true },
  });
  return Boolean(hit);
}

/** Compose the Discord message body for a reminder. */
function bodyFor(r: {
  detail: string | null;
  dueAt: Date;
  repeat: string;
  category: string | null;
}, now: Date): string {
  const lines: string[] = [];
  if (r.detail) lines.push(r.detail);
  const when = duePhrase(r.dueAt, now);
  const bits = [`Due: ${when}`];
  if (r.repeat !== "none") bits.push(`Repeats: ${repeatLabel(r.repeat)}`);
  if (r.category) bits.push(`Category: ${r.category}`);
  lines.push(bits.join(" · "));
  return lines.join("\n\n");
}

/**
 * Fire every reminder that is due. Returns one outcome per reminder
 * considered, so the caller can report exactly what happened.
 */
export async function sendDueReminders(now: Date = new Date()): Promise<{
  checked: number;
  fired: ReminderOutcome[];
}> {
  // Pull scheduled reminders; filter by calendar day in JS so the
  // date logic lives in exactly one place (lib/reminders.isDue).
  const candidates = await prisma.reminder.findMany({
    where: { status: "scheduled" },
    orderBy: { dueAt: "asc" },
    take: 500,
  });

  const outcomes: ReminderOutcome[] = [];

  for (const r of candidates) {
    const base: ReminderOutcome = {
      id: r.id,
      title: r.title,
      fired: false,
      delivered: false,
    };

    if (!isDue(r, now)) {
      base.reason = "not due yet";
      outcomes.push(base);
      continue;
    }

    if (await firedToday(r.id, now)) {
      base.reason = "already fired today";
      outcomes.push(base);
      continue;
    }

    const result = await notify({
      title: r.title,
      body: bodyFor(r, now),
      severity: severityFor(r.priority),
      url: HUB_URL,
      webhookUrl: reminderWebhookUrl(),
      // Only the urgent ones are allowed to ping the whole channel;
      // routine reminders must not train anyone to mute it.
      mentionEveryone: r.priority === "urgent",
    });

    // Roll the schedule forward BEFORE trusting delivery: an undelivered
    // reminder (no webhook configured) must still advance, or a daily
    // repeat would pile up unsent occurrences forever.
    const next = nextOccurrence(r.dueAt, r.repeat, now);

    await prisma.$transaction([
      prisma.reminder.update({
        where: { id: r.id },
        data: next
          ? {
              dueAt: next,
              lastFiredAt: now,
              fireCount: { increment: 1 },
            }
          : {
              status: "done",
              lastFiredAt: now,
              fireCount: { increment: 1 },
            },
      }),
      prisma.reminderEvent.create({
        data: {
          reminderId: r.id,
          kind: "fired",
          channel: result.channel,
          delivered: result.delivered,
          detail: result.error ?? null,
        },
      }),
    ]);

    base.fired = true;
    base.delivered = result.delivered;
    if (result.error) base.reason = result.error;
    if (next) base.rescheduledTo = next.toISOString();
    outcomes.push(base);
  }

  return { checked: candidates.length, fired: outcomes };
}

/** Push a single reminder immediately, ignoring its schedule. */
export async function sendTestReminder(reminderId: string): Promise<{
  delivered: boolean;
  error?: string;
}> {
  const r = await prisma.reminder.findUnique({ where: { id: reminderId } });
  if (!r) return { delivered: false, error: "Reminder not found" };

  const result = await notify({
    title: `[Test] ${r.title}`,
    body: bodyFor(r, new Date()),
    severity: severityFor(r.priority),
    url: HUB_URL,
    webhookUrl: reminderWebhookUrl(),
  });

  await prisma.reminderEvent.create({
    data: {
      reminderId: r.id,
      kind: "test",
      channel: result.channel,
      delivered: result.delivered,
      detail: result.error ?? null,
    },
  });

  return { delivered: result.delivered, error: result.error };
}
