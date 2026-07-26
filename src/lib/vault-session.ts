import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { resolveActor } from "@/lib/agent-auth";

/**
 * The Password Control gate.
 *
 * Unlocking mints an HMAC-signed, httpOnly cookie derived from
 * CREDENTIAL_KEY. It can't be forged without the key and can't be read
 * by page scripts, so an XSS bug can't lift it. It expires on its own
 * so an unattended tab re-locks.
 *
 * The passphrase is checked server-side only — no comparison ever
 * reaches the browser, and the vault list is never sent to a client
 * that hasn't unlocked.
 */

const COOKIE = "fds_vault";
/** Unattended tabs re-lock after this long. */
const TTL_SECONDS = 30 * 60;

function sign(expiresAt: number): string {
  const key = env.CREDENTIAL_KEY ?? "";
  return createHmac("sha256", key)
    .update(`vault:${expiresAt}`)
    .digest("base64url");
}

function tokenFor(expiresAt: number): string {
  return `${expiresAt}.${sign(expiresAt)}`;
}

export async function grantVaultSession(): Promise<void> {
  const expiresAt = Date.now() + TTL_SECONDS * 1000;
  const jar = await cookies();
  jar.set(COOKIE, tokenFor(expiresAt), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function revokeVaultSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function hasVaultSession(): Promise<boolean> {
  if (!env.CREDENTIAL_KEY) return false;
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return false;

  const [expRaw, mac] = raw.split(".");
  const expiresAt = Number(expRaw);
  if (!Number.isFinite(expiresAt) || !mac) return false;
  if (Date.now() > expiresAt) return false;

  const expected = Buffer.from(sign(expiresAt), "utf8");
  const got = Buffer.from(mac, "utf8");
  if (expected.length !== got.length) return false;
  return timingSafeEqual(expected, got);
}

/**
 * Guard for every vault route. Returns a Response to bail with, or
 * null when the caller may proceed.
 *
 * The AI agent is refused outright — it authenticates with
 * AGENT_API_KEY and has no business reading the company's passwords.
 * Autonomy notch 0 or not, credentials are not agent-reachable data.
 */
export async function requireVault(request: Request): Promise<Response | null> {
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
      { error: "Vault is not configured on this server." },
      { status: 503 },
    );
  }
  if (!(await hasVaultSession())) {
    return Response.json({ error: "Vault is locked." }, { status: 401 });
  }
  return null;
}
