import { env } from "@/lib/env";

/**
 * GitHub client for the self-modification panel.
 *
 * Why this exists at all: the hub is deployed to Vercel serverless.
 * A lambda has an ephemeral read-only filesystem, no `git`, and a hard
 * runtime cap — it cannot check out a repo, run a coding agent for
 * several minutes, and push. So the panel does not run the agent; it
 * dispatches the agent-run workflow on GitHub Actions, which owns the
 * checkout, and reads the result back through this module.
 *
 * The scope guard lives here: every call is pinned to REPO, derived
 * from env.GITHUB_REPO. Nothing accepts a caller-supplied repo, so a
 * prompt can't redirect a run at another project.
 */

const API = "https://api.github.com";

/** The one repo the panel may ever touch. */
export const REPO = env.GITHUB_REPO;

/** Workflow that runs the agent. Dispatched from the default branch. */
export const WORKFLOW_FILE = "agent-run.yml";

/**
 * The workflow is always dispatched from `main`, never from the branch
 * an agent is working on. GitHub runs the workflow definition at the
 * dispatched ref — so even though the agent is allowed to *propose*
 * edits to .github/workflows, those edits cannot take effect until a
 * human has merged them. The branch-only rule stays enforceable.
 */
export const DISPATCH_REF = "main";

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

/** True when a token is configured. Drives the honest connect state. */
export function isConnected(): boolean {
  return Boolean(env.GITHUB_TOKEN);
}

async function gh<T>(
  path: string,
  init: RequestInit & { raw?: boolean } = {},
): Promise<T> {
  if (!env.GITHUB_TOKEN) {
    throw new GitHubError(
      "No agent token configured — set GITHUB_TOKEN to dispatch runs",
      401,
    );
  }
  const { raw, ...rest } = init;
  const res = await fetch(`${API}${path}`, {
    ...rest,
    headers: {
      Accept: raw ? "application/vnd.github.v3.diff" : "application/vnd.github+json",
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(rest.body ? { "Content-Type": "application/json" } : {}),
      ...rest.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let detail = `GitHub returned ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) detail = body.message;
    } catch {
      // keep the status-only message
    }
    throw new GitHubError(detail, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (raw ? await res.text() : await res.json()) as T;
}

/** Branch name for a run — namespaced so it's obvious who made it. */
export function branchFor(runId: string): string {
  return `agent/${runId}`;
}

/**
 * Kick off a real workflow run. GitHub's dispatch endpoint returns 204
 * with no body, so the caller matches the run afterwards by branch.
 */
export async function dispatchAgentRun(args: {
  runId: string;
  prompt: string;
  branch: string;
}): Promise<void> {
  await gh(`/repos/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
    method: "POST",
    body: JSON.stringify({
      ref: DISPATCH_REF,
      inputs: {
        run_id: args.runId,
        prompt: args.prompt,
        branch: args.branch,
      },
    }),
  });
}

export interface WorkflowRun {
  id: number;
  status: string; // queued | in_progress | completed
  conclusion: string | null; // success | failure | cancelled | ...
  html_url: string;
  created_at: string;
}

/**
 * Find the workflow run for a branch. Dispatch is asynchronous, so this
 * returns null until GitHub has actually created the run — the caller
 * keeps the row in `queued` rather than inventing progress.
 */
export async function findRunForBranch(
  branch: string,
): Promise<WorkflowRun | null> {
  const data = await gh<{ workflow_runs: WorkflowRun[] }>(
    `/repos/${REPO}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=30`,
  );
  const runs = data.workflow_runs ?? [];
  // The dispatch inputs aren't queryable, so match on the branch the
  // workflow names its job after (see agent-run.yml `run-name`).
  return runs.find((r) => (r as unknown as { name?: string }).name?.includes(branch)) ?? null;
}

export async function getWorkflowRun(id: string): Promise<WorkflowRun> {
  return gh<WorkflowRun>(`/repos/${REPO}/actions/runs/${id}`);
}

export interface PullRequest {
  number: number;
  html_url: string;
  state: string;
  merged: boolean;
  mergeable: boolean | null;
  changed_files: number;
  additions: number;
  deletions: number;
  head: { ref: string; sha: string };
}

/** The open PR for a branch, if the workflow got far enough to open one. */
export async function findPullRequestForBranch(
  branch: string,
): Promise<PullRequest | null> {
  const owner = REPO.split("/")[0];
  const list = await gh<{ number: number }[]>(
    `/repos/${REPO}/pulls?head=${encodeURIComponent(`${owner}:${branch}`)}&state=all&per_page=1`,
  );
  if (!list.length) return null;
  return gh<PullRequest>(`/repos/${REPO}/pulls/${list[0].number}`);
}

/** The actual unified diff a human reviews before approving. */
export async function getPullRequestDiff(number: number): Promise<string> {
  return gh<string>(`/repos/${REPO}/pulls/${number}`, { raw: true });
}

/**
 * Merge — the only path that puts agent-written code on main, and it
 * runs solely from an explicit human "Apply & deploy". Nothing in this
 * module calls it automatically.
 */
export async function mergePullRequest(
  number: number,
  title: string,
): Promise<{ merged: boolean; message: string }> {
  return gh<{ merged: boolean; message: string }>(
    `/repos/${REPO}/pulls/${number}/merge`,
    {
      method: "PUT",
      body: JSON.stringify({ commit_title: title, merge_method: "squash" }),
    },
  );
}

/** Best-effort log tail for the console. Empty array if unavailable. */
export async function getRunJobs(
  runId: string,
): Promise<{ name: string; status: string; conclusion: string | null }[]> {
  try {
    const data = await gh<{
      jobs: {
        name: string;
        status: string;
        conclusion: string | null;
        steps?: { name: string; status: string; conclusion: string | null }[];
      }[];
    }>(`/repos/${REPO}/actions/runs/${runId}/jobs`);
    return (data.jobs ?? []).flatMap((j) =>
      (j.steps ?? []).map((s) => ({
        name: s.name,
        status: s.status,
        conclusion: s.conclusion,
      })),
    );
  } catch {
    return [];
  }
}
