import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";

export const dynamic = "force-dynamic";

const memberPatch = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  initials: z.string().trim().min(1).max(3).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Colour must be a #rrggbb hex value")
    .optional(),
  active: z.boolean().optional(),
  discordUserId: z
    .union([
      z.string().trim().regex(/^\d{15,22}$/, "Use the numeric Discord user ID"),
      z.literal(""),
      z.null(),
    ])
    .optional()
    .transform((value) =>
      value === undefined ? undefined : value ? value : null,
    ),
});

/**
 * PATCH /api/team-members/[id] — rename a seat, or retire one.
 *
 * Human only. Who the people are is not the agent's call to make, and a
 * renamed seat re-labels every task in the history.
 *
 * There is no DELETE: deleting a seat would strip the owner off finished
 * work and lose the record of who did it. `active: false` hides the seat
 * from the pickers and leaves history intact.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  if (actor === "claude") {
    return Response.json(
      { error: "Agent may not edit the team roster" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const existing = await prisma.teamMember.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const parsed = memberPatch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  const updated = await prisma.teamMember.update({
    where: { id },
    data: parsed.data,
  });
  return Response.json(updated);
}
