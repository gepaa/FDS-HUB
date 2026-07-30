/**
 * Shared shapes for the to-do board, plus the one piece of mapping that
 * would otherwise drift between the page and the API.
 *
 * OWNERSHIP. A task has two owner columns and they are not redundant:
 *
 *   assignee   "claude" | "you"  — the agent-facing field. Every route,
 *                                  agent tool and test that predates the
 *                                  board reads this, and "is this the
 *                                  agent's job?" is still answered here.
 *   assigneeId seat id | null    — which human seat owns it.
 *
 * The UI speaks in a single `owner` value instead — "claude", a seat id,
 * or "unassigned" — and this module converts. Keeping the old column
 * meant the migration didn't have to rewrite live task rows.
 */

export const UNASSIGNED = "unassigned";
export const CLAUDE = "claude";

export interface SeatDTO {
  id: string;
  name: string;
  initials: string;
  color: string;
  sortOrder: number;
  active: boolean;
}

export interface AttachmentDTO {
  id: string;
  kind: string;
  label: string;
  url: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

export interface TodoDTO {
  id: string;
  title: string;
  detail: string | null;
  status: string;
  assignee: string;
  assigneeId: string | null;
  origin: string;
  result: string | null;
  priority: string | null;
  dueDate: string | null;
  pinned: boolean;
  aiBrief: string | null;
  aiBriefAt: string | null;
  source: string;
  aiGenerated: boolean;
  humanConfirmed: boolean;
  recordId: string | null;
  recordName: string | null;
  createdAt: string;
  completedAt: string | null;
  attachments: AttachmentDTO[];
}

/** The single value the UI uses for "who owns this". */
export function ownerKey(task: { assignee: string; assigneeId: string | null }): string {
  if (task.assigneeId) return task.assigneeId;
  return task.assignee === CLAUDE ? CLAUDE : UNASSIGNED;
}

/** Split a UI owner value back into the two stored columns. */
export function ownerColumns(owner: string): {
  assignee: "claude" | "you";
  assigneeId: string | null;
} {
  if (owner === CLAUDE) return { assignee: "claude", assigneeId: null };
  if (owner === UNASSIGNED) return { assignee: "you", assigneeId: null };
  return { assignee: "you", assigneeId: owner };
}

/** Priority vocabulary, shared with the CRM so the badges match. */
export const TASK_PRIORITIES = ["hot", "warm", "cold"] as const;
