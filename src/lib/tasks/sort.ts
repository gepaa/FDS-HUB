/**
 * The to-do board's automatic order.
 *
 * The list sorts itself so nobody has to groom it. The rules are plain
 * code rather than a model call for three reasons: the order must be
 * stable (the same board can't reshuffle between two refreshes), it must
 * be instant (this runs on every render), and every card has to be able
 * to say *why* it sits where it does — see `reasonFor`. The model's job
 * on this board is explaining a task (`aiBrief`), not ranking it.
 *
 * Ranking, top to bottom:
 *   0  pinned         — the one manual override
 *   1  overdue
 *   2  due today
 *   3  hot
 *   4  due within the next 3 days
 *   5  warm
 *   6  no priority set
 *   7  cold
 *
 * Ties break by due date (soonest first, undated last) and then by age,
 * oldest first — so a task nobody picks up rises instead of rotting at
 * the bottom.
 */

export const SOON_DAYS = 3;

export interface SortableTask {
  id: string;
  pinned: boolean;
  priority: string | null;
  dueDate: string | null;
  createdAt: string;
}

export type Urgency = "pinned" | "overdue" | "today" | "soon" | "normal";

/** Midnight local time, as a timestamp. */
function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Whole days from today to `iso`: negative = past, 0 = today.
 * Compared at day granularity on purpose — a task due "today" is due
 * today all day, not overdue from 00:01.
 */
export function daysUntil(iso: string | null, now: Date = new Date()): number | null {
  if (!iso) return null;
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return null;
  return Math.round((startOfDay(due) - startOfDay(now)) / 86_400_000);
}

/** Rank bucket, lower sorts higher. */
export function bucketOf(task: SortableTask, now: Date = new Date()): number {
  if (task.pinned) return 0;
  const days = daysUntil(task.dueDate, now);
  if (days !== null && days < 0) return 1;
  if (days === 0) return 2;
  if (task.priority === "hot") return 3;
  if (days !== null && days <= SOON_DAYS) return 4;
  if (task.priority === "warm") return 5;
  if (!task.priority) return 6;
  return 7;
}

/** How the card should read at a glance. */
export function urgencyOf(task: SortableTask, now: Date = new Date()): Urgency {
  if (task.pinned) return "pinned";
  const days = daysUntil(task.dueDate, now);
  if (days !== null && days < 0) return "overdue";
  if (days === 0) return "today";
  if (task.priority === "hot") return "soon";
  if (days !== null && days <= SOON_DAYS) return "soon";
  return "normal";
}

/** Short plain-English answer to "why is this here?". */
export function reasonFor(task: SortableTask, now: Date = new Date()): string {
  if (task.pinned) return "Pinned to the top";
  const days = daysUntil(task.dueDate, now);
  if (days !== null && days < 0) {
    const n = Math.abs(days);
    return `Overdue by ${n} day${n === 1 ? "" : "s"}`;
  }
  if (days === 0) return "Due today";
  if (task.priority === "hot") return "Marked hot";
  if (days !== null && days <= SOON_DAYS) {
    return `Due in ${days} day${days === 1 ? "" : "s"}`;
  }
  if (task.priority === "warm") return "Marked warm";
  if (task.priority === "cold") return "Marked cold";
  return "No priority or date yet";
}

/**
 * Sort a list into board order. Pure — returns a new array, and given
 * the same `now` always produces the same order.
 */
export function autoSort<T extends SortableTask>(tasks: T[], now: Date = new Date()): T[] {
  return [...tasks].sort((a, b) => {
    const bucket = bucketOf(a, now) - bucketOf(b, now);
    if (bucket !== 0) return bucket;

    const da = daysUntil(a.dueDate, now);
    const db = daysUntil(b.dueDate, now);
    if (da !== db) {
      if (da === null) return 1; // undated sinks below dated
      if (db === null) return -1;
      return da - db;
    }

    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}
