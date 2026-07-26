import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";
import { branchFor, dispatchAgentRun, isConnected, REPO } from "@/lib/github";
import { toAgentRunDTO } from "@/lib/agent-runs";

export const dynamic = "force-dynamic";

const dispatchInput = z.object({
  prompt: z
    .string()
    .trim()
    .min(10, "Describe the change in a sentence or two")
    .max(4000),
});

/** GET /api/agent-runs — run history, newest first. */
export async function GET(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;

  const runs = await prisma.agentRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return Response.json({
    connected: isConnected(),
    repo: REPO,
    // The list is deliberately diff-free: diffs are large and only the
    // opened run needs one.
    runs: runs.map((r) => ({ ...toAgentRunDTO(r), diff: null })),
  });
}

/**
 * POST /api/agent-runs — dispatch a real coding-agent run.
 *
 * There is no simulation path. With no token the request fails with a
 * 503 the panel renders as "Connect your agent token"; it never writes
 * a row that pretends work happened.
 */
export async function POST(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;

  // The agent must not be able to dispatch agents. Self-modification is
  // a human-initiated action only — same principle as the delete and
  // approval gates (D4).
  if (actor === "claude") {
    return Response.json(
      { error: "Agent may not dispatch code changes — a human starts these" },
      { status: 403 },
    );
  }

  if (!isConnected()) {
    return Response.json(
      {
        error:
          "No agent token configured. Set GITHUB_TOKEN (PAT with repo + workflow scope) to dispatch real runs.",
      },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = dispatchInput.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  // Create the row first so the run has an id to name its branch after,
  // and so a dispatch that fails is still visible in history.
  const created = await prisma.agentRun.create({
    data: { prompt: parsed.data.prompt, actor, status: "queued" },
  });
  const branch = branchFor(created.id);

  try {
    await dispatchAgentRun({
      runId: created.id,
      prompt: parsed.data.prompt,
      branch,
    });
  } catch (e) {
    const failed = await prisma.agentRun.update({
      where: { id: created.id },
      data: {
        status: "failed",
        error: e instanceof Error ? e.message : "Dispatch failed",
      },
    });
    return Response.json(
      { error: failed.error, run: toAgentRunDTO(failed) },
      { status: 502 },
    );
  }

  const updated = await prisma.agentRun.update({
    where: { id: created.id },
    data: { branch },
  });
  return Response.json(toAgentRunDTO(updated), { status: 201 });
}
