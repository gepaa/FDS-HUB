import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";

export const dynamic = "force-dynamic";

/** DELETE /api/interactions/[id] — remove an activity entry (human only). */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  if (actor === "claude") {
    return Response.json(
      { error: "Agent may not delete activity log entries" },
      { status: 403 },
    );
  }
  const { id } = await params;
  const existing = await prisma.interaction.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
  await prisma.interaction.delete({ where: { id } });
  return Response.json({ ok: true });
}
