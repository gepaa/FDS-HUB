import { z } from "zod";
import { env } from "@/lib/env";
import { resolveActor } from "@/lib/agent-auth";
import { passphraseMatches } from "@/lib/secret-box";
import { grantVaultSession, revokeVaultSession } from "@/lib/vault-session";

export const dynamic = "force-dynamic";

const input = z.object({ passphrase: z.string().min(1) });

/** POST /api/vault/unlock — exchange the passphrase for a session. */
export async function POST(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  if (actor === "claude") {
    return Response.json(
      { error: "The vault is not agent-accessible." },
      { status: 403 },
    );
  }

  if (!env.CREDENTIAL_KEY || !env.PASSWORD_CONTROL_PASSPHRASE) {
    return Response.json(
      {
        error:
          "Vault is not configured. Set CREDENTIAL_KEY and PASSWORD_CONTROL_PASSPHRASE.",
      },
      { status: 503 },
    );
  }

  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Password required" }, { status: 400 });
  }

  if (!passphraseMatches(parsed.data.passphrase)) {
    // Deliberately vague, and no hint about length or near-misses.
    return Response.json({ error: "Incorrect password" }, { status: 401 });
  }

  await grantVaultSession();
  return Response.json({ unlocked: true });
}

/** DELETE /api/vault/unlock — lock it again. */
export async function DELETE() {
  await revokeVaultSession();
  return Response.json({ unlocked: false });
}
