import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";
import { runAgent } from "@/lib/agent/loop";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/tasks/[id]/run — hand a queued task to the agent right
 * now. The agent works it with its tools, writes the outcome onto the
 * task card, and posts a run log to the feed. On failure the task
 * returns to the queue.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  const { id } = await params;

  const task = await prisma.hqTask.findUnique({ where: { id } });
  if (!task) return Response.json({ error: "Not found" }, { status: 404 });
  if (task.status !== "queued") {
    return Response.json(
      { error: `Task is ${task.status}; only queued tasks can be run.` },
      { status: 400 },
    );
  }

  await prisma.hqTask.update({ where: { id }, data: { status: "running" } });

  try {
    const { content, toolLog } = await runAgent({
      history: [],
      userMessage: `Execute this task from the HQ queue, end to end, using your tools.

TASK: ${task.title}${task.detail ? `\nDETAIL: ${task.detail}` : ""}

Work autonomously: read the relevant SOPs and records first, make the CRM changes, draft any outbound messages through the approvals gate, and finish with a short outcome summary (3-6 sentences, plain text). Your final reply is written verbatim onto the task card as the result.`,
      emit: () => {},
      signal: request.signal,
    });

    const result = content || "Run finished without a summary.";
    const updated = await prisma.hqTask.update({
      where: { id },
      data: { status: "done", result: result.slice(0, 4000), completedAt: new Date() },
    });
    await prisma.agentMessage.create({
      data: {
        role: "claude",
        kind: "log",
        title: `Task run: ${task.title}`,
        body: `${result}\n\nTools used: ${toolLog.map((t) => t.tool).join(", ") || "none"}`,
      },
    });
    return Response.json(updated);
  } catch (e) {
    await prisma.hqTask.update({ where: { id }, data: { status: "queued" } });
    return Response.json(
      { error: e instanceof Error ? e.message : "Agent run failed" },
      { status: 500 },
    );
  }
}
