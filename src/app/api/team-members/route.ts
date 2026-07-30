import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";

export const dynamic = "force-dynamic";

/** GET /api/team-members — the seats on the to-do board. */
export async function GET(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  const members = await prisma.teamMember.findMany({
    orderBy: { sortOrder: "asc" },
  });
  return Response.json(members);
}
