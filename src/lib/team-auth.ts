/**
 * Team session cookie.
 *
 * The credentials are unchanged — the same TEAM_USER / TEAM_PASSWORD
 * that the browser used to prompt for. What changes is how they are
 * carried: instead of re-sending Basic credentials on every request,
 * signing in once mints a signed, expiring cookie.
 *
 * EDGE-SAFE ON PURPOSE. This module is imported by src/proxy.ts, which
 * may run on the Edge runtime, so it uses Web Crypto (available in both
 * Edge and Node) and imports nothing from `node:`, Prisma, or the app.
 *
 * The token is `<expiry>.<hmac>`, signed with AUTH_SECRET when set and
 * otherwise with the team password itself. Forging one therefore needs
 * the very secret the cookie is protecting, and a stolen cookie stops
 * working at the expiry rather than lasting forever.
 */

export const SESSION_COOKIE = "fds_team";

/** How long a sign-in lasts before the login page reappears. */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function signingKeyMaterial(): string | null {
  const password = process.env.TEAM_PASSWORD;
  if (!password) return null;
  const secret = process.env.AUTH_SECRET ?? "";
  const user = process.env.TEAM_USER || "fds";
  return `fds-team:v1:${user}:${password}:${secret}`;
}

async function hmac(message: string, keyMaterial: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(keyMaterial),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  // Base64url so the value is cookie-safe without escaping.
  let binary = "";
  for (const byte of new Uint8Array(sig)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Compare without leaking where two values first differ. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Do these credentials match the configured team login? */
export function credentialsValid(user: string, password: string): boolean {
  const expectedUser = process.env.TEAM_USER || "fds";
  const expectedPassword = process.env.TEAM_PASSWORD;
  if (!expectedPassword) return false;
  return (
    safeEqual(user.trim(), expectedUser) &&
    safeEqual(password, expectedPassword)
  );
}

/** Mint a cookie value for a successful sign-in. */
export async function createSessionToken(
  nowMs: number = Date.now(),
): Promise<string | null> {
  const keyMaterial = signingKeyMaterial();
  if (!keyMaterial) return null;
  const expiry = Math.floor(nowMs / 1000) + SESSION_MAX_AGE_SECONDS;
  const signature = await hmac(String(expiry), keyMaterial);
  return `${expiry}.${signature}`;
}

/**
 * Is this cookie value genuine and unexpired?
 *
 * Changing TEAM_PASSWORD or AUTH_SECRET changes the signing key, which
 * invalidates every existing session — the intended behaviour when a
 * shared password is rotated.
 */
export async function verifySessionToken(
  token: string | undefined | null,
  nowMs: number = Date.now(),
): Promise<boolean> {
  if (!token) return false;
  const keyMaterial = signingKeyMaterial();
  if (!keyMaterial) return false;

  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const expiryPart = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  const expiry = Number(expiryPart);
  if (!Number.isFinite(expiry)) return false;
  if (expiry * 1000 < nowMs) return false;

  const expected = await hmac(expiryPart, keyMaterial);
  return safeEqual(signature, expected);
}
