import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { env } from "@/lib/env";

/**
 * Authenticated encryption for the Password Control vault.
 *
 * AES-256-GCM. The key lives only in CREDENTIAL_KEY (env) — never in
 * the database, never in the repo — so a Postgres dump or a leaked
 * backup yields sealed blobs and nothing else. GCM's auth tag means a
 * tampered row fails to open rather than decrypting to garbage.
 *
 * Sealed format: v1.<iv>.<tag>.<ciphertext>, each part base64url.
 */

const VERSION = "v1";
const IV_BYTES = 12; // 96-bit nonce, the GCM standard
const KEY_BYTES = 32;

export class VaultUnconfiguredError extends Error {
  constructor() {
    super(
      "CREDENTIAL_KEY is not set. Generate one with: openssl rand -base64 32",
    );
    this.name = "VaultUnconfiguredError";
  }
}

/** True when the vault has a usable key — drives the UI's connect state. */
export function vaultConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

function getKey(): Buffer {
  const raw = env.CREDENTIAL_KEY;
  if (!raw) throw new VaultUnconfiguredError();
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `CREDENTIAL_KEY must decode to ${KEY_BYTES} bytes, got ${key.length}. Generate one with: openssl rand -base64 32`,
    );
  }
  return key;
}

/** Encrypt a plaintext secret into a storable blob. */
export function seal(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ct.toString("base64url"),
  ].join(".");
}

/** Decrypt a sealed blob. Throws if the key is wrong or the row was altered. */
export function open(sealed: string): string {
  const key = getKey();
  const parts = sealed.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Malformed sealed secret");
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Constant-time passphrase check for the Password Control gate. A
 * plain `===` leaks the passphrase a character at a time to anyone
 * who can measure the response.
 */
export function passphraseMatches(candidate: string): boolean {
  const expected = env.PASSWORD_CONTROL_PASSPHRASE;
  if (!expected) return false;
  const a = Buffer.from(candidate, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    // Still burn a comparison so length isn't a timing oracle.
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}
