import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";
import { PRIORITY_IDS, REPEAT_IDS, STATUSES } from "@/lib/reminders";

export const dynamic = "force-dynamic";

const dueAtSchema = z
  .string()
  .trim()
  .min(1)
  .transform((v, ctx) => {
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00.000Z` : v;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Invalid due date" });
      return z.NEVER;
    }
    return d;
  });

const reminderPatch = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  detail: z.string().trim().max(2000).nullable().optional(),
  dueAt: dueAtSchema.optional(),
  repeat: z.enum(REPEAT_IDS as [string, ...string[]]).optional(),
  priority: z.enum(PRIORITY_IDS as [string, ...string[]]).optional(),
  status: z.enum(STATUSES as unknown as [string, ...string[]]).optional(),
  category: z.string().trim().max(80).nullable().optional(),
});

/**
 * PATCH /api/reminders/[id] — edit a reminder, or change its status
 * (complete / cancel / reopen). Status changes are recorded on the
 * event log so History explains why something left the list.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  const { id } = await params;

  const existing = await prisma.reminder.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = reminderPatch.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const updated = await prisma.reminder.update({
    where: { id },
    data: {
      ...(d.title !== undefined ? { title: d.title } : {}),
      ...(d.detail !== undefined ? { detail: d.detail } : {}),
      ...(d.dueAt !== undefined ? { dueAt: d.dueAt } : {}),
      ...(d.repeat !== undefined ? { repeat: d.repeat } : {}),
      ...(d.priority !== undefined ? { priority: d.priority } : {}),
      ...(d.status !== undefined ? { status: d.status } : {}),
      ...(d.category !== undefined ? { category: d.category } : {}),
    },
    include: { events: { orderBy: { createdAt: "desc" }, take: 10 } },
  });

  // Log meaningful lifecycle changes so History reads as a story.
  if (d.status && d.status !== existing.status) {
    const kind =
      d.status === "done"
        ? "completed"
        : d.status === "cancelled"
          ? "cancelled"
          : "snoozed"; // back to scheduled = revived
    await prisma.reminderEvent.create({
      data: { reminderId: id, kind, channel: "none", delivered: false },
    });
  }

  return Response.json(updated);
}

/** DELETE /api/reminders/[id] — remove it and its history. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  const { id } = await params;

  const existing = await prisma.reminder.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  await prisma.reminder.delete({ where: { id } });
  return Response.json({ ok: true });
}
