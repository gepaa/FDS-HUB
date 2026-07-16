import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";

export const dynamic = "force-dynamic";

const decisionInput = z.object({
  status: z.enum(["approved", "rejected", "snoozed", "executed"]),
  decisionNote: z.string().nullable().optional(),
  snoozedUntil: z.string().nullable().optional(),
  draftSubject: z.string().nullable().optional(),
  draftBody: z.string().optional(), // human edit before approving
  executedAt: z.string().nullable().optional(),
});

/** PATCH /api/approvals/[id] — decide a gate item.
 *  Humans approve/reject/snooze/edit. The agent may ONLY mark an
 *  already-approved item as executed (after it performed the approved
 *  action) — it can never approve its own drafts (D7). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  const { id } = await params;

  const existing = await prisma.approval.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = decisionInput.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  const data = parsed.data;

  if (actor === "claude") {
    const marksExecuted =
      data.status === "executed" && existing.status === "approved";
    if (!marksExecuted) {
      return Response.json(
        { error: "The agent cannot decide gate items — humans only (D7)" },
        { status: 403 },
      );
    }
  }

  const updated = await prisma.approval.update({
    where: { id },
    data: {
      status: data.status,
      decisionNote: data.decisionNote,
      ...(data.draftSubject !== undefined
        ? { draftSubject: data.draftSubject }
        : {}),
      ...(data.draftBody !== undefined ? { draftBody: data.draftBody } : {}),
      ...(data.status === "snoozed" && data.snoozedUntil
        ? { snoozedUntil: new Date(data.snoozedUntil) }
        : {}),
      ...(data.status === "executed"
        ? { executedAt: new Date() }
        : { decidedAt: new Date() }),
    },
  });
  return Response.json(updated);
}
