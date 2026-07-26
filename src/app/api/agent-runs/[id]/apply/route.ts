import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";
import { refreshAgentRun, toAgentRunDTO } from "@/lib/agent-runs";
import { isConnected, mergePullRequest } from "@/lib/github";

export const dynamic = "force-dynamic";

/**
 * POST /api/agent-runs/[id]/apply — "Apply & deploy".
 *
 * The single place in the codebase that merges agent-written code into
 * main (and therefore triggers a production deploy). It is a separate
 * endpoint from dispatch on purpose: reviewing a proposed change can
 * never accidentally ship it (spec Step 4.4).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;

  // Shipping is a human decision, full stop.
  if (actor === "claude") {
    return Response.json(
      { error: "Agent may not deploy its own changes — a human approves" },
      { status: 403 },
    );
  }

  if (!isConnected()) {
    return Response.json(
      { error: "No agent token configured — cannot merge" },
      { status: 503 },
    );
  }

  const { id } = await params;

  // Reconcile first: never merge against a stale view of the run.
  const run = await refreshAgentRun(id);
  if (!run) return Response.json({ error: "Not found" }, { status: 404 });

  if (run.status === "applied") {
    return Response.json(
      { error: "This run has already been applied" },
      { status: 409 },
    );
  }
  if (!run.prNumber) {
    return Response.json(
      {
        error:
          "Nothing to apply — this run has no pull request. Only a completed run with a diff can be deployed.",
      },
      { status: 409 },
    );
  }
  if (run.status !== "succeeded") {
    return Response.json(
      { error: `Cannot apply a run that is "${run.status}"` },
      { status: 409 },
    );
  }

  try {
    const result = await mergePullRequest(
      run.prNumber,
      `Agent run: ${run.prompt.slice(0, 60)}`,
    );
    if (!result.merged) {
      return Response.json(
        { error: result.message || "GitHub declined the merge" },
        { status: 409 },
      );
    }
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Merge failed" },
      { status: 502 },
    );
  }

  const applied = await prisma.agentRun.update({
    where: { id },
    data: { status: "applied", appliedAt: new Date(), appliedBy: actor, error: null },
  });

  return Response.json({
    run: toAgentRunDTO(applied),
    // Honest about what merging did and did not do: Vercel builds from
    // main on push, but this response is not proof the deploy succeeded.
    note: "Merged to main. Vercel will build production from this commit — check the deploy before treating it as live.",
  });
}
