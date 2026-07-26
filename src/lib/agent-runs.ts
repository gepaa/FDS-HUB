import { prisma } from "@/lib/prisma";
import {
  branchFor,
  findPullRequestForBranch,
  findRunForBranch,
  getPullRequestDiff,
  getWorkflowRun,
  isConnected,
} from "@/lib/github";

/**
 * Run-state reconciliation for the self-modification panel.
 *
 * The rule this file exists to enforce: the hub never invents progress.
 * A run's status only advances because GitHub said so. If GitHub can't
 * be reached, the row keeps its last real state and the panel surfaces
 * the error — it does not fall back to a plausible-looking timeline.
 */

export type AgentRunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "applied";

export interface AgentRunDTO {
  id: string;
  prompt: string;
  status: AgentRunStatus;
  actor: string;
  branch: string | null;
  runUrl: string | null;
  prNumber: number | null;
  prUrl: string | null;
  diff: string | null;
  filesChanged: number | null;
  additions: number | null;
  deletions: number | null;
  error: string | null;
  appliedAt: string | null;
  appliedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

type Row = {
  id: string;
  prompt: string;
  status: string;
  actor: string;
  branch: string | null;
  workflowRunId: string | null;
  runUrl: string | null;
  prNumber: number | null;
  prUrl: string | null;
  diff: string | null;
  filesChanged: number | null;
  additions: number | null;
  deletions: number | null;
  error: string | null;
  appliedAt: Date | null;
  appliedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toAgentRunDTO(r: Row): AgentRunDTO {
  return {
    id: r.id,
    prompt: r.prompt,
    status: r.status as AgentRunStatus,
    actor: r.actor,
    branch: r.branch,
    runUrl: r.runUrl,
    prNumber: r.prNumber,
    prUrl: r.prUrl,
    diff: r.diff,
    filesChanged: r.filesChanged,
    additions: r.additions,
    deletions: r.deletions,
    error: r.error,
    appliedAt: r.appliedAt?.toISOString() ?? null,
    appliedBy: r.appliedBy,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

/** Statuses that are done moving on their own. */
const TERMINAL = new Set(["applied", "failed"]);

/**
 * Pull the live state of one run from GitHub and persist what changed.
 *
 * Deliberately tolerant: any GitHub failure is recorded on the row as an
 * error string and the previous status is kept. A panel that shows
 * "running" forever is honest; one that shows "succeeded" because a poll
 * failed is not.
 */
export async function refreshAgentRun(id: string): Promise<AgentRunDTO | null> {
  const row = (await prisma.agentRun.findUnique({ where: { id } })) as Row | null;
  if (!row) return null;
  if (TERMINAL.has(row.status) || !isConnected()) return toAgentRunDTO(row);

  const branch = row.branch ?? branchFor(row.id);
  const patch: Record<string, unknown> = {};

  try {
    // 1. Locate the workflow run, if GitHub has created it yet.
    let workflowRunId = row.workflowRunId;
    if (!workflowRunId) {
      const found = await findRunForBranch(branch);
      if (found) {
        workflowRunId = String(found.id);
        patch.workflowRunId = workflowRunId;
        patch.runUrl = found.html_url;
        patch.status = found.status === "completed" ? row.status : "running";
      }
    }

    // 2. Advance status from the workflow's own conclusion.
    if (workflowRunId) {
      const run = await getWorkflowRun(workflowRunId);
      patch.runUrl = run.html_url;
      if (run.status !== "completed") {
        patch.status = "running";
      } else if (run.conclusion && run.conclusion !== "success") {
        patch.status = "failed";
        patch.error = `Workflow ${run.conclusion}`;
      }
    }

    // 3. A PR means the agent produced something reviewable. The diff is
    //    fetched from GitHub, never reconstructed locally.
    const pr = await findPullRequestForBranch(branch);
    if (pr) {
      patch.prNumber = pr.number;
      patch.prUrl = pr.html_url;
      patch.filesChanged = pr.changed_files;
      patch.additions = pr.additions;
      patch.deletions = pr.deletions;
      if (pr.merged) {
        patch.status = "applied";
      } else if (patch.status !== "failed") {
        patch.status = "succeeded";
      }
      try {
        patch.diff = await getPullRequestDiff(pr.number);
      } catch {
        // Diff is best-effort; the PR link still lets a human review.
      }
    }

    if (Object.keys(patch).length === 0) return toAgentRunDTO(row);
    patch.error = patch.error ?? null;
  } catch (e) {
    // Keep the last known-real status; surface why polling failed.
    const updated = (await prisma.agentRun.update({
      where: { id },
      data: { error: e instanceof Error ? e.message : "Could not reach GitHub" },
    })) as Row;
    return toAgentRunDTO(updated);
  }

  const updated = (await prisma.agentRun.update({
    where: { id },
    data: patch,
  })) as Row;
  return toAgentRunDTO(updated);
}
