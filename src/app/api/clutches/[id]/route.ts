import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";

export const dynamic = "force-dynamic";

const clutchPatch = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  date: z
    .string()
    .refine((v) => !Number.isNaN(new Date(v).getTime()), {
      message: "Invalid date",
    })
    .optional(),
});

/** PATCH /api/clutches/[id] — edit a logged clutch. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  const { id } = await params;

  const existing = await prisma.clutch.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = clutchPatch.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  const { title, notes, date } = parsed.data;

  const updated = await prisma.clutch.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(notes !== undefined ? { notes: notes?.trim() || null } : {}),
      ...(date !== undefined ? { date: new Date(date) } : {}),
    },
  });
  return Response.json(updated);
}

/** DELETE /api/clutches/[id] — remove a clutch from the timeline. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  const { id } = await params;
  const existing = await prisma.clutch.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
  await prisma.clutch.delete({ where: { id } });
  return Response.json({ ok: true });
}
