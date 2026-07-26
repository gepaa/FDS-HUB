import { prisma } from "@/lib/prisma";
import { importInput } from "@/lib/validation";
import { resolveActor } from "@/lib/agent-auth";
import { assignCluster } from "@/lib/clusters";
import { nextRecordId } from "@/lib/record-id";
import { STAGE_MAP } from "@/lib/domain";

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
    select: { id: true, name: true, status: true },
  });
  const byName = new Map(
    existing.map((r) => [r.name.trim().toLowerCase(), r]),
  );

  let created = 0;
  let updated = 0;
  let stagesChanged = 0;
  for (const row of parsed.data.records) {
    const { activityNote, cluster, ...fields } = row;
    // A cluster the sheet states wins, even if it is not one of the
    // seeded 8 — the CRM's filters read clusters off the DB, so a new
    // one is a legitimate value rather than something to reclassify.
    const clusterValue = cluster?.trim()
      ? cluster.trim()
      : assignCluster(row.name, row.niche ?? null);
    const match = byName.get(row.name.trim().toLowerCase());
    if (match) {
      const { status, ...rest } = fields;
      const stageMoves = parsed.data.updateStages && status !== match.status;
      await prisma.crmRecord.update({
        where: { id: match.id },
        data: {
          ...rest,
          cluster: clusterValue,
          // Pipeline stage is only touched on explicit opt-in (see
          // importInput.updateStages) — and never without a log entry.
          ...(stageMoves ? { status } : {}),
          interactions: {
            create: [
              {
                type: "system",
                actor,
                body: `Updated from CSV import by ${actor}${
                  stageMoves ? "" : " (pipeline stage left unchanged)"
                }`,
              },
              ...(stageMoves
                ? [
                    {
                      type: "status",
                      actor,
                      body: `${STAGE_MAP[match.status]?.label ?? match.status} → ${
                        STAGE_MAP[status]?.label ?? status
                      } (CSV import)`,
                    },
                  ]
                : []),
              ...(activityNote
                ? [{ type: "note", actor, body: activityNote }]
                : []),
            ],
          },
        },
      });
      if (stageMoves) stagesChanged += 1;
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
  return Response.json({ ok: true, created, updated, stagesChanged });
}
