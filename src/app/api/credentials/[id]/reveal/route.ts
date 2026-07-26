import { prisma } from "@/lib/prisma";
import { open } from "@/lib/secret-box";
import { requireVault } from "@/lib/vault-session";

export const dynamic = "force-dynamic";

/**
 * POST /api/credentials/[id]/reveal — unseal one secret.
 *
 * POST, not GET, on purpose: a GET would land in browser history,
 * proxy logs, and the Next router cache. This is also the only path
 * that ever returns plaintext, and every call writes a
 * CredentialReveal row — the point of a vault is knowing when
 * something came out of it.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = await requireVault(request);
  if (blocked) return blocked;

  const { id } = await params;
  const row = await prisma.credential.findUnique({ where: { id } });
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });

  let secret: string;
  try {
    secret = open(row.secret);
  } catch {
    // Wrong key or a tampered row — GCM refuses rather than returning
    // garbage, and we say so plainly instead of showing nonsense.
    return Response.json(
      {
        error:
          "Could not decrypt. CREDENTIAL_KEY may have changed since this entry was saved.",
      },
      { status: 500 },
    );
  }

  await prisma.credentialReveal.create({ data: { credentialId: id } });

  return Response.json(
    { secret },
    // Never let a reveal response sit in any cache.
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
