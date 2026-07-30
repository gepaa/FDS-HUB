/**
 * Turning a model reply into a task brief.
 *
 * Kept out of the route so it can be tested without a model or a
 * database: the model is the one part of this feature that can't be run
 * locally, so everything around it is worth pinning down.
 */

export interface Explanation {
  brief?: string;
  steps?: string[];
  priority?: string;
  dueInDays?: number | null;
  questions?: string[];
}

export const EXPLAIN_SYSTEM = `You are the operations lead at Farming Direct Supply, a high-ticket agricultural equipment dealer. Suppliers are dealers being recruited; leads are inbound buyers. Anything outbound (email, quote, price) goes through a human approval gate — never describe sending something as if it just happens.

A teammate has jotted a task down in shorthand. Turn it into something a colleague could pick up cold, WITHOUT inventing facts. If the note is ambiguous, say what is unclear in "questions" rather than guessing.

Reply with ONLY a JSON object, no preamble:
{
  "brief": "2-4 sentences: what this actually means and why it matters",
  "steps": ["3-6 concrete steps, each starting with a verb"],
  "priority": "hot" | "warm" | "cold",
  "dueInDays": number of days from today, or null if genuinely open-ended,
  "questions": ["anything you had to assume, phrased as a question. [] if the note was clear."]
}`;

const clean = (xs: unknown): string[] =>
  Array.isArray(xs)
    ? xs.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    : [];

/** Flatten the model's JSON into the text shown on the card. */
export function renderBrief(x: Explanation): string {
  const parts: string[] = [];
  if (typeof x.brief === "string" && x.brief.trim()) parts.push(x.brief.trim());

  const steps = clean(x.steps).slice(0, 8);
  if (steps.length) {
    parts.push(steps.map((s, i) => `${i + 1}. ${s.trim()}`).join("\n"));
  }

  const questions = clean(x.questions).slice(0, 5);
  if (questions.length) {
    parts.push(
      `Needs confirming:\n${questions.map((q) => `• ${q.trim()}`).join("\n")}`,
    );
  }

  return parts.join("\n\n").slice(0, 4000);
}

/**
 * The advisory priority + due date. Both are proposals shown behind an
 * "Apply" button — a model is not allowed to silently re-rank the board,
 * so anything it returns that isn't a known priority is dropped rather
 * than written through.
 */
export function suggestionFrom(
  x: Explanation | null,
  now: number = Date.now(),
): { priority: string | null; dueDate: string | null } {
  const priority =
    x?.priority === "hot" || x?.priority === "warm" || x?.priority === "cold"
      ? x.priority
      : null;

  const days =
    typeof x?.dueInDays === "number" && Number.isFinite(x.dueInDays)
      ? Math.max(0, Math.min(365, Math.round(x.dueInDays)))
      : null;

  return {
    priority,
    dueDate: days === null ? null : new Date(now + days * 86_400_000).toISOString(),
  };
}
