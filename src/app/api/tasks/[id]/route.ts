import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";

export const dynamic = "force-dynamic";

const taskPatch = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  detail: z.string().nullable().optional(),
  status: z
    .enum(["suggested", "queued", "running", "done", "cancelled"])
    .optional(),
  assignee: z.enum(["claude", "you"]).optional(),
  result: z.string().nullable().optional(),
});

/** PATCH /api/tasks/[id] — update a task. The agent can start/finish
 *  work (running/done + result) but cannot cancel human-queued tasks
 *  or promote its own suggestions into the queue. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  const { id } = await params;

  const existing = await prisma.hqTask.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = taskPatch.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  const data = parsed.data;

  if (actor === "claude" && data.status) {
    const allowed =
      (existing.status === "queued" && data.status === "running") ||
      (existing.status === "running" && data.status === "done");
    if (!allowed) {
      return Response.json(
        { error: `Agent may not move a task ${existing.status} → ${data.status}` },
        { status: 403 },
      );
    }
  }

  const updated = await prisma.hqTask.update({
    where: { id },
    data: {
      ...data,
      ...(data.status === "done" ? { completedAt: new Date() } : {}),
    },
  });
  return Response.json(updated);
}

/** DELETE /api/tasks/[id] — human only. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  if (actor === "claude") {
    return Response.json({ error: "Agent may not delete tasks" }, { status: 403 });
  }
  const { id } = await params;
  const existing = await prisma.hqTask.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
  await prisma.hqTask.delete({ where: { id } });
  return Response.json({ ok: true });
}
