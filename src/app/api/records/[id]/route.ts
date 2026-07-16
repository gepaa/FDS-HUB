import { prisma } from "@/lib/prisma";
import { toRecordDTO } from "@/lib/serialize";
import { recordPatch } from "@/lib/validation";
import { resolveActor } from "@/lib/agent-auth";
import {
  LEAD_STAGE_IDS,
  STAGE_MAP,
  SUPPLIER_STAGE_IDS,
} from "@/lib/domain";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  const { id } = await params;
  const record = await prisma.crmRecord.findUnique({
    where: { id },
    include: { interactions: true },
  });
  if (!record) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(toRecordDTO(record));
}

export async function PATCH(request: Request, { params }: Params) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  const { id } = await params;

  const existing = await prisma.crmRecord.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = recordPatch.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // Validate status against the ladder of the (possibly patched) type.
  const type = data.type ?? existing.type;
  if (data.status !== undefined) {
    const ladder =
      type === "lead"
        ? (LEAD_STAGE_IDS as readonly string[])
        : (SUPPLIER_STAGE_IDS as readonly string[]);
    if (!ladder.includes(data.status)) {
      return Response.json(
        { error: `"${data.status}" is not a valid ${type} stage` },
        { status: 400 },
      );
    }
  }

  const { tags, productCategories, ...rest } = data;
  const statusChanged =
    data.status !== undefined && data.status !== existing.status;

  const updated = await prisma.crmRecord.update({
    where: { id },
    data: {
      ...rest,
      ...(tags !== undefined ? { tags: JSON.stringify(tags) } : {}),
      ...(productCategories !== undefined
        ? { productCategories: JSON.stringify(productCategories) }
        : {}),
      // Status moves land on the activity log with who moved them.
      ...(statusChanged
        ? {
            interactions: {
              create: {
                type: "status",
                actor,
                body: `${STAGE_MAP[existing.status]?.label ?? existing.status} → ${
                  STAGE_MAP[data.status as string]?.label ?? data.status
                }`,
              },
            },
          }
        : {}),
    },
    include: { interactions: true },
  });
  return Response.json(toRecordDTO(updated));
}

export async function DELETE(request: Request, { params }: Params) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  // The agent never deletes records — losing history is irreversible
  // and the CRM is the memory (D1/D7). Humans only.
  if (actor === "claude") {
    return Response.json(
      { error: "Agent may not delete records — flag it for Pablo instead" },
      { status: 403 },
    );
  }
  const { id } = await params;
  const existing = await prisma.crmRecord.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
  await prisma.crmRecord.delete({ where: { id } });
  return Response.json({ ok: true });
}
