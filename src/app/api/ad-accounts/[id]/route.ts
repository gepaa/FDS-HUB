import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";

export const dynamic = "force-dynamic";

const accountPatch = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  platform: z.string().trim().min(1).max(80).optional(),
  externalId: z.string().trim().max(120).nullable().optional(),
  currency: z.string().trim().min(1).max(8).optional(),
  dailyBudget: z.number().finite().min(0).optional(),
  thresholdDays: z.number().int().min(1).max(90).optional(),
  active: z.boolean().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

/**
 * PATCH /api/ad-accounts/[id] — edit settings (name, daily budget,
 * threshold, active…). NOTE: `balance` is deliberately NOT editable
 * here — money only moves through the ledger endpoint so the statement
 * stays honest. Use POST /api/ad-accounts/[id]/ledger for deposits and
 * corrections.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  const { id } = await params;

  const existing = await prisma.adAccount.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = accountPatch.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const updated = await prisma.adAccount.update({
    where: { id },
    data: {
      ...(d.name !== undefined ? { name: d.name } : {}),
      ...(d.platform !== undefined ? { platform: d.platform } : {}),
      ...(d.externalId !== undefined
        ? { externalId: d.externalId?.trim() || null }
        : {}),
      ...(d.currency !== undefined ? { currency: d.currency } : {}),
      ...(d.dailyBudget !== undefined ? { dailyBudget: d.dailyBudget } : {}),
      ...(d.thresholdDays !== undefined ? { thresholdDays: d.thresholdDays } : {}),
      ...(d.active !== undefined ? { active: d.active } : {}),
      ...(d.notes !== undefined ? { notes: d.notes?.trim() || null } : {}),
    },
  });
  return Response.json(updated);
}

/** DELETE /api/ad-accounts/[id] — remove an account (cascades ledger). */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  const { id } = await params;
  const existing = await prisma.adAccount.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
  await prisma.adAccount.delete({ where: { id } });
  return Response.json({ ok: true });
}
