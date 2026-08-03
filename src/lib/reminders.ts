/**
 * Reminders — the scheduling rules.
 *
 * Delivery runs through the same Discord webhook as the budget alerts
 * (src/lib/notify.ts), swept once a day by /api/cron/send-reminders.
 *
 * Because the sweep is DAILY, everything here treats `dueAt` as a
 * calendar date. A reminder is "due" when its date is today or earlier —
 * the time-of-day is display/ordering only. That keeps the UI honest:
 * we never imply a 2:47pm reminder will arrive at 2:47pm.
 */

export const REPEATS = [
  { id: "none", label: "One-off" },
  { id: "daily", label: "Every day" },
  { id: "weekly", label: "Every week" },
  { id: "monthly", label: "Every month" },
] as const;
export type RepeatId = (typeof REPEATS)[number]["id"];

export const PRIORITIES = [
  { id: "low", label: "Low", color: "#8A94A6" },
  { id: "normal", label: "Normal", color: "#5B8DEF" },
  { id: "urgent", label: "Urgent", color: "#E5484D" },
] as const;
export type ReminderPriority = (typeof PRIORITIES)[number]["id"];

export const STATUSES = ["scheduled", "done", "cancelled"] as const;
export type ReminderStatus = (typeof STATUSES)[number];

export const REPEAT_IDS = REPEATS.map((r) => r.id);
export const PRIORITY_IDS = PRIORITIES.map((p) => p.id);

/** Which tab a reminder belongs to in the UI. */
export type ReminderBucket = "upcoming" | "past";

export interface ReminderLike {
  dueAt: string | Date;
  status: string;
  repeat: string;
  lastFiredAt?: string | Date | null;
}

// ---------------- calendar-date helpers ----------------
//
// All comparisons happen on the UTC calendar day. Dates are stored at
// UTC midnight, and the cron runs in UTC, so using UTC everywhere keeps
// "due today" identical on the server, in the cron, and in the browser
// regardless of the viewer's timezone.

/** The UTC midnight instant for whatever day `value` falls on. */
export function startOfUtcDay(value: string | Date): Date {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

/** Whole days from day(a) to day(b); negative when b is earlier. */
export function daysBetween(a: string | Date, b: string | Date): number {
  const ms = startOfUtcDay(b).getTime() - startOfUtcDay(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** True when the reminder's date is today or already past. */
export function isDue(r: ReminderLike, now: Date = new Date()): boolean {
  return daysBetween(now, r.dueAt) <= 0;
}

/**
 * Which list the reminder shows under.
 *
 * "past" = finished (done/cancelled) or already fired at least once and
 * not repeating. A scheduled one-off that slipped past its date is
 * still "upcoming" — it hasn't happened yet and it still needs doing,
 * so burying it in history would hide real work.
 */
export function bucketOf(r: ReminderLike): ReminderBucket {
  if (r.status === "done" || r.status === "cancelled") return "past";
  return "upcoming";
}

/** Overdue = scheduled, dated before today, and not yet delivered. */
export function isOverdue(r: ReminderLike, now: Date = new Date()): boolean {
  if (r.status !== "scheduled") return false;
  return daysBetween(now, r.dueAt) < 0;
}

/**
 * The next occurrence after `from` for a repeating reminder, or null
 * for a one-off.
 *
 * Rolls forward in whole periods until the result is strictly in the
 * future, so a reminder that missed several sweeps (server asleep,
 * cron paused) lands on its next real occurrence instead of replaying
 * every occurrence it slept through.
 *
 * Monthly clamps to the end of short months: the 31st becomes the 30th
 * in November and the 28th/29th in February, rather than silently
 * rolling into the next month the way `setUTCMonth` alone would.
 */
export function nextOccurrence(
  dueAt: string | Date,
  repeat: string,
  from: Date = new Date(),
): Date | null {
  if (repeat === "none" || !REPEAT_IDS.includes(repeat as RepeatId)) {
    return null;
  }

  const base = typeof dueAt === "string" ? new Date(dueAt) : new Date(dueAt);
  const floor = startOfUtcDay(from).getTime();

  // Guard: a corrupt/absurd date must not spin the loop forever.
  if (Number.isNaN(base.getTime())) return null;

  const next = new Date(base.getTime());
  const dayOfMonth = base.getUTCDate();

  for (let i = 0; i < 4000; i += 1) {
    if (repeat === "daily") {
      next.setUTCDate(next.getUTCDate() + 1);
    } else if (repeat === "weekly") {
      next.setUTCDate(next.getUTCDate() + 7);
    } else {
      // monthly — advance one month, then clamp the day.
      const y = next.getUTCFullYear();
      const m = next.getUTCMonth();
      const lastDayNextMonth = new Date(Date.UTC(y, m + 2, 0)).getUTCDate();
      next.setUTCDate(1); // avoid overflow while switching month
      next.setUTCMonth(m + 1);
      next.setUTCDate(Math.min(dayOfMonth, lastDayNextMonth));
    }
    if (startOfUtcDay(next).getTime() > floor) return next;
  }
  return null;
}

/** "Today", "Tomorrow", "3 days overdue", "in 5 days"… */
export function duePhrase(dueAt: string | Date, now: Date = new Date()): string {
  const diff = daysBetween(now, dueAt);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "1 day overdue";
  if (diff < 0) return `${Math.abs(diff)} days overdue`;
  if (diff < 7) return `in ${diff} days`;
  if (diff < 14) return "next week";
  return `in ${Math.round(diff / 7)} weeks`;
}

/** Human label for a repeat rule. */
export function repeatLabel(repeat: string): string {
  return REPEATS.find((r) => r.id === repeat)?.label ?? "One-off";
}

/** Discord severity for a reminder priority. */
export function severityFor(
  priority: string,
): "info" | "warn" | "critical" {
  if (priority === "urgent") return "critical";
  if (priority === "low") return "info";
  return "warn";
}
