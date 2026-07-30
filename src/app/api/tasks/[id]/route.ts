import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";
import { ownerColumns } from "@/lib/tasks/board";

export const dynamic = "force-dynamic";

const taskPatch = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  detail: z.string().nullable().optional(),
  status: z
    .enum(["suggested", "queued", "running", "done", "cancelled"])
    .optional(),
  assignee: z.enum(["claude", "you"]).optional(),
  result: z.string().nullable().optional(),
  // Call-generated follow-ups (source "quo_call") arrive as
  // `suggested` + aiGenerated. A human accepting one records that here,
  // so "did a person actually agree to this?" stays answerable.
  humanConfirmed: z.boolean().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  // Board fields: "claude" | "unassigned" | seat id.
  owner: z.string().trim().min(1).max(40).optional(),
  priority: z.enum(["hot", "warm", "cold"]).nullable().optional(),
  pinned: z.boolean().optional(),
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

  // Only a human may confirm an AI-proposed follow-up — that is the
  // entire point of the proposal step.
  if (actor === "claude" && data.humanConfirmed !== undefined) {
    return Response.json(
      { error: "Agent may not confirm its own proposal" },
      { status: 403 },
    );
  }

  // Who a piece of work belongs to is a human decision. The agent can
  // report on a task and finish its own, but it cannot put work on a
  // teammate's plate or promote a card up the board.
  if (actor === "claude" && (data.owner !== undefined || data.pinned !== undefined)) {
    return Response.json(
      { error: "Agent may not reassign or pin tasks" },
      { status: 403 },
    );
  }

  if (data.owner && data.owner !== "claude" && data.owner !== "unassigned") {
    const seat = await prisma.teamMember.findUnique({ where: { id: data.owner } });
    if (!seat) {
      return Response.json({ error: "No such team member" }, { status: 400 });
    }
  }

  const { owner, ...fields } = data;

  const updated = await prisma.hqTask.update({
    where: { id },
    data: {
      ...fields,
      ...(owner ? ownerColumns(owner) : {}),
      ...(data.dueDate !== undefined
        ? { dueDate: data.dueDate ? new Date(data.dueDate) : null }
        : {}),
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
