import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";
import { refreshAgentRun } from "@/lib/agent-runs";
import { getRunJobs, isConnected } from "@/lib/github";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/agent-runs/[id] — the live state of one run.
 *
 * Every call reconciles against GitHub before answering, so the panel's
 * console reflects the real workflow rather than a local guess.
 */
export async function GET(request: Request, { params }: Params) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  const { id } = await params;

  const run = await refreshAgentRun(id);
  if (!run) return Response.json({ error: "Not found" }, { status: 404 });

  const row = await prisma.agentRun.findUnique({ where: { id } });
  const steps =
    isConnected() && row?.workflowRunId
      ? await getRunJobs(row.workflowRunId)
      : [];

  return Response.json({ run, steps, connected: isConnected() });
}

/** DELETE /api/agent-runs/[id] — drop a run from history (human only). */
export async function DELETE(request: Request, { params }: Params) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  if (actor === "claude") {
    return Response.json(
      { error: "Agent may not erase its own run history" },
      { status: 403 },
    );
  }
  const { id } = await params;
  const existing = await prisma.agentRun.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  // Removing the hub's record does not touch the branch or PR on GitHub;
  // say so rather than implying the change was undone.
  await prisma.agentRun.delete({ where: { id } });
  return Response.json({
    ok: true,
    note: existing.prUrl
      ? "Removed from history. The branch and pull request still exist on GitHub."
      : "Removed from history.",
  });
}

