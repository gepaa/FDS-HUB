/**
 * The "needs attention now" model behind the dashboard's top zone.
 *
 * Every item here is derived from a real row — an overdue
 * `nextActionDate`, a pending Approval, a task that never finished, a
 * credential that isn't in the environment. Nothing is estimated and
 * nothing is invented: if the DB is quiet, the zone is empty and says
 * so. See docs/FDS_HQ_Decisions.md (D2: honest empty states).
 */

import { STAGE_MAP, TERMINAL_STAGES } from "@/lib/domain";
import type { IntegrationStatus } from "@/lib/integrations";

/** Days without contact before a worked record counts as stalled. */
export const STALL_DAYS = 14;

/** Days past due before an overdue follow-up escalates to critical. */
const CRITICAL_OVERDUE_DAYS = 3;

/** Stages where the deal is live enough that silence is a problem. */
const WORKING_STAGES = new Set<string>([
  "CONTACTED",
  "REPLIED",
  "IN_CONVERSATION",
  "CALL_SCHEDULED",
  "NEGOTIATING",
  "ENGAGED",
  "QUOTE_REQUESTED",
  "QUOTE_SENT",
  "CALL_NEGOTIATION",
]);

export type AttentionSeverity = "critical" | "warning";

export interface AttentionItem {
  id: string;
  severity: AttentionSeverity;
  /** Short kind label, e.g. "Overdue" — always paired with the title. */
  kind: string;
  title: string;
  detail?: string;
  /** Right-aligned age/count, e.g. "6d late". */
  meta?: string;
  href: string;
}

interface RecordLike {
  id: string;
  name: string;
  status: string;
  nextAction: string | null;
  nextActionDate: Date | null;
  lastContactDate: Date | null;
}

interface ApprovalLike {
  id: string;
  title: string;
  createdAt: Date;
}

interface TaskLike {
  id: string;
  title: string;
  status: string;
  updatedAt: Date;
}

export interface AttentionInput {
  records: RecordLike[];
  approvals: ApprovalLike[];
  tasks: TaskLike[];
  integrations: IntegrationStatus[];
  /** Evaluation instant — injected so this stays testable. */
  now: Date;
}

/** Whole days from `date` to `now`, floored. Negative means future. */
function daysSince(date: Date, now: Date): number {
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfThen = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  return Math.round(
    (startOfToday.getTime() - startOfThen.getTime()) / 86_400_000,
  );
}

/**
 * Build the attention list, most urgent first. Critical outranks
 * warning; within a severity, the older item wins.
 */
export function buildAttention(input: AttentionInput): AttentionItem[] {
  const { records, approvals, tasks, integrations, now } = input;
  const items: AttentionItem[] = [];

  // ---- overdue and due-today follow-ups ----
  for (const r of records) {
    if (!r.nextActionDate || TERMINAL_STAGES.has(r.status)) continue;
    const late = daysSince(r.nextActionDate, now);
    if (late < 0) continue; // still in the future

    const stage = STAGE_MAP[r.status]?.label ?? r.status;
    items.push({
      id: `followup-${r.id}`,
      severity: late >= CRITICAL_OVERDUE_DAYS ? "critical" : "warning",
      kind: late === 0 ? "Due today" : "Overdue",
      title: r.name,
      detail: r.nextAction ?? `Follow up · ${stage}`,
      meta: late === 0 ? "today" : `${late}d late`,
      href: `/crm?record=${r.id}`,
    });
  }

  // ---- approvals waiting on a human decision ----
  for (const a of approvals) {
    const waiting = daysSince(a.createdAt, now);
    items.push({
      id: `approval-${a.id}`,
      severity: waiting >= CRITICAL_OVERDUE_DAYS ? "critical" : "warning",
      kind: "Needs approval",
      title: a.title,
      detail: "Drafted by the agent — nothing sends until you approve",
      meta: waiting <= 0 ? "today" : `${waiting}d waiting`,
      href: "/approvals",
    });
  }

  // ---- pipeline stalls: worked, then went quiet ----
  for (const r of records) {
    if (!WORKING_STAGES.has(r.status) || !r.lastContactDate) continue;
    const quiet = daysSince(r.lastContactDate, now);
    if (quiet < STALL_DAYS) continue;
    // An overdue next-action already surfaces this record; don't double-list.
    if (r.nextActionDate && daysSince(r.nextActionDate, now) >= 0) continue;

    const stage = STAGE_MAP[r.status]?.label ?? r.status;
    items.push({
      id: `stall-${r.id}`,
      severity: "warning",
      kind: "Stalled",
      title: r.name,
      detail: `${stage} · no contact logged in ${quiet} days`,
      meta: `${quiet}d quiet`,
      href: `/crm?record=${r.id}`,
    });
  }

  // ---- task runs that started and never landed ----
  for (const t of tasks) {
    if (t.status !== "running") continue;
    const stuck = daysSince(t.updatedAt, now);
    if (stuck < 1) continue; // a run in flight today is fine
    items.push({
      id: `task-${t.id}`,
      severity: "critical",
      kind: "Run stuck",
      title: t.title,
      detail: "Marked running but never completed — re-queue it",
      meta: `${stuck}d`,
      href: "/tasks",
    });
  }

  // ---- integrations the hub actually needs to function ----
  const ai = integrations.find((i) => i.id === "ai");
  if (ai && !ai.connected) {
    items.push({
      id: "integration-ai",
      severity: "warning",
      kind: "Not connected",
      title: "No AI provider configured",
      detail: "The assistant and task runs can't execute until a key is set",
      href: "/integrations",
    });
  }

  const severityRank: Record<AttentionSeverity, number> = {
    critical: 0,
    warning: 1,
  };
  const ageOf = (i: AttentionItem) => {
    const m = i.meta?.match(/^(\d+)d/);
    return m ? Number(m[1]) : 0;
  };

  return items.sort(
    (a, b) =>
      severityRank[a.severity] - severityRank[b.severity] ||
      ageOf(b) - ageOf(a),
  );
}
