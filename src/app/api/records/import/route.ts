import { prisma } from "@/lib/prisma";
import { importInput } from "@/lib/validation";
import { resolveActor } from "@/lib/agent-auth";
import { assignCluster } from "@/lib/clusters";
import { nextRecordId } from "@/lib/record-id";
import { CLUSTERS } from "@/lib/domain";

export const dynamic = "force-dynamic";

/** POST /api/records/import — bulk supplier import (CSV rows).
 *  Matched by name: existing records update, new ones are created. */
export async function POST(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;

  const body = await request.json().catch(() => null);
  const parsed = importInput.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  const existing = await prisma.crmRecord.findMany({
    where: { type: "supplier" },
    select: { id: true, name: true },
  });
  const byName = new Map(existing.map((r) => [r.name.trim().toLowerCase(), r.id]));

  let created = 0;
  let updated = 0;
  for (const row of parsed.data.records) {
    const { activityNote, cluster, ...fields } = row;
    const clusterValue =
      cluster && (CLUSTERS as readonly string[]).includes(cluster)
        ? cluster
        : assignCluster(row.name, row.niche ?? null);
    const id = byName.get(row.name.trim().toLowerCase());
    if (id) {
      await prisma.crmRecord.update({
        where: { id },
        data: { ...fields, cluster: clusterValue },
      });
      updated += 1;
    } else {
      const recordId = await nextRecordId("supplier");
      await prisma.crmRecord.create({
        data: {
          ...fields,
          type: "supplier",
          recordId,
          cluster: clusterValue,
          interactions: {
            create: [
              {
                type: "system",
                actor,
                body: `Imported from CSV by ${actor}`,
              },
              ...(activityNote
                ? [{ type: "note", actor, body: activityNote }]
                : []),
            ],
          },
        },
      });
      created += 1;
    }
  }
  return Response.json({ ok: true, created, updated });
}
