import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";

export const dynamic = "force-dynamic";

const patchInput = z.object({
  data: z.string().max(60000).optional(), // serialized CockpitData
  notes: z.string().max(60000).optional(), // serialized CallNote[]
});

/** PATCH /api/cockpit/[id] — autosave the call's working state. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  const { id } = await params;

  const existing = await prisma.callSession.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
  if (existing.endedAt) {
    return Response.json({ error: "Call already ended" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchInput.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
  // Validate the blobs are real JSON before storing.
  for (const blob of [parsed.data.data, parsed.data.notes]) {
    if (blob !== undefined) {
      try {
        JSON.parse(blob);
      } catch {
        return Response.json({ error: "Malformed JSON blob" }, { status: 400 });
      }
    }
  }
  const updated = await prisma.callSession.update({
    where: { id },
    data: parsed.data,
  });
  return Response.json({ ok: true, updatedAt: updated.updatedAt });
}
