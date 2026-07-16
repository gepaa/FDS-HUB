import { prisma } from "@/lib/prisma";
import { toRecordDTO } from "@/lib/serialize";
import { interactionInput } from "@/lib/validation";
import { resolveActor } from "@/lib/agent-auth";

export const dynamic = "force-dynamic";

/** POST /api/records/[id]/interactions — log an activity entry;
 *  returns the full refreshed record. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  const { id } = await params;

  const existing = await prisma.crmRecord.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = interactionInput.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  const isTouch = parsed.data.type === "email" || parsed.data.type === "call";
  const updated = await prisma.crmRecord.update({
    where: { id },
    data: {
      interactions: { create: { ...parsed.data, actor } },
      // Real touches keep last_contact honest (CRM Data Model §2).
      ...(isTouch ? { lastContactDate: parsed.data.date } : {}),
    },
    include: { interactions: true },
  });
  return Response.json(toRecordDTO(updated), { status: 201 });
}
