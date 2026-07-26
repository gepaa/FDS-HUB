import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { seal } from "@/lib/secret-box";
import { requireVault } from "@/lib/vault-session";

export const dynamic = "force-dynamic";

const patchInput = z.object({
  service: z.string().trim().min(1, "Service is required").max(120).optional(),
  label: z.string().trim().max(120).nullable().optional(),
  username: z.string().trim().max(200).nullable().optional(),
  // Omit to leave the stored secret untouched — editing a label must
  // not require re-typing the password.
  secret: z.string().min(1).max(2000).optional(),
  url: z.string().trim().max(500).nullable().optional(),
  category: z.string().trim().min(1).max(60).optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
});

const SAFE_SELECT = {
  id: true,
  service: true,
  label: true,
  username: true,
  url: true,
  category: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = await requireVault(request);
  if (blocked) return blocked;

  const { id } = await params;
  const existing = await prisma.credential.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = patchInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  const { secret, ...rest } = parsed.data;

  const updated = await prisma.credential.update({
    where: { id },
    data: { ...rest, ...(secret ? { secret: seal(secret) } : {}) },
    select: SAFE_SELECT,
  });
  return Response.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = await requireVault(request);
  if (blocked) return blocked;

  const { id } = await params;
  const existing = await prisma.credential.findUnique({ where: { id } });
  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.credential.delete({ where: { id } });
  return Response.json({ deleted: true });
}
