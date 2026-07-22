import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";
import { emptyCockpitData } from "@/lib/cockpit";

export const dynamic = "force-dynamic";

const startInput = z.object({ recordId: z.string() });

/**
 * POST /api/cockpit — start (or resume) a call session for a record.
 * If an un-ended session exists for the record it is resumed, so an
 * accidental tab close never loses call state.
 */
export async function POST(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;

  const body = await request.json().catch(() => null);
  const parsed = startInput.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "recordId required" }, { status: 400 });
  }

  const record = await prisma.crmRecord.findFirst({
    where: {
      OR: [{ id: parsed.data.recordId }, { recordId: parsed.data.recordId }],
    },
  });
  if (!record) return Response.json({ error: "Record not found" }, { status: 404 });

  const open = await prisma.callSession.findFirst({
    where: { recordId: record.id, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (open) return Response.json({ session: open, resumed: true });

  const session = await prisma.callSession.create({
    data: {
      recordId: record.id,
      data: JSON.stringify(
        emptyCockpitData({
          productInterest: record.productInterest,
          warranty: record.warranty,
          leadTime: record.leadTime,
          quoteAmount: record.quoteAmount,
        }),
      ),
    },
  });
  return Response.json({ session, resumed: false }, { status: 201 });
}
