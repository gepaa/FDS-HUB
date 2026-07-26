import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { seal } from "@/lib/secret-box";
import { requireVault } from "@/lib/vault-session";

export const dynamic = "force-dynamic";

const credentialInput = z.object({
  service: z.string().trim().min(1, "Service is required").max(120),
  label: z.string().trim().max(120).nullable().optional(),
  username: z.string().trim().max(200).nullable().optional(),
  secret: z.string().min(1, "Password is required").max(2000),
  url: z.string().trim().max(500).nullable().optional(),
  category: z.string().trim().min(1).max(60).default("Other"),
  notes: z.string().trim().max(4000).nullable().optional(),
});

/**
 * GET /api/credentials — the vault index.
 *
 * Returns everything EXCEPT the secret. Listing is not revealing: the
 * sealed blob never leaves the server here, so a list render can't
 * leak a password into a cache, a screenshot, or the DOM.
 */
export async function GET(request: Request) {
  const blocked = await requireVault(request);
  if (blocked) return blocked;

  const rows = await prisma.credential.findMany({
    orderBy: [{ category: "asc" }, { service: "asc" }],
    select: {
      id: true,
      service: true,
      label: true,
      username: true,
      url: true,
      category: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      reveals: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true, actor: true },
      },
    },
  });

  return Response.json(
    rows.map(({ reveals, ...r }) => ({
      ...r,
      lastRevealedAt: reveals[0]?.createdAt ?? null,
    })),
  );
}

/** POST /api/credentials — add an entry, sealing the secret on the way in. */
export async function POST(request: Request) {
  const blocked = await requireVault(request);
  if (blocked) return blocked;

  const parsed = credentialInput.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  const { secret, ...rest } = parsed.data;

  const created = await prisma.credential.create({
    data: {
      ...rest,
      label: rest.label?.trim() || null,
      username: rest.username?.trim() || null,
      url: rest.url?.trim() || null,
      notes: rest.notes?.trim() || null,
      secret: seal(secret),
    },
    select: {
      id: true,
      service: true,
      label: true,
      username: true,
      url: true,
      category: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return Response.json({ ...created, lastRevealedAt: null }, { status: 201 });
}
