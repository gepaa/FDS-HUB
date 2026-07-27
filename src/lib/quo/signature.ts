import { createHmac, timingSafeEqual } from "node:crypto";
import { WEBHOOK_TOLERANCE_SECONDS } from "@/lib/quo/config";

/**
 * Standard Webhooks signature verification for Quo deliveries.
 *
 * Quo's unified webhook API signs with the Standard Webhooks scheme
 * (the same one Svix implements):
 *
 *   signed content = `${webhook-id}.${webhook-timestamp}.${raw body}`
 *   signature      = base64( HMAC-SHA256(secret, signed content) )
 *   header         = "v1,<sig>" — space-delimited when several are
 *                    present, which happens during secret rotation
 *
 * The secret arrives as `whsec_<base64>`; the bytes used for the HMAC
 * are the base64-decoded remainder, NOT the literal string.
 *
 * This is deliberately NOT the legacy OpenPhone scheme. Quo's own
 * migration note is explicit that the two are not interchangeable, so
 * any example found in an older OpenPhone integration will fail here —
 * correctly.
 *
 * Two rules this file exists to enforce:
 *   1. The RAW request body must be verified, byte for byte. Verifying
 *      a re-serialised JSON object silently breaks on key order and
 *      whitespace.
 *   2. Comparison is constant-time. A fast-exit compare leaks the
 *      expected signature one byte at a time.
 */

export type SignatureFailure =
  | "missing_secret"
  | "missing_headers"
  | "bad_timestamp"
  | "timestamp_out_of_tolerance"
  | "malformed_signature"
  | "no_match";

export interface VerifyInput {
  secret: string | undefined | null;
  webhookId: string | null;
  webhookTimestamp: string | null;
  webhookSignature: string | null;
  /** The exact bytes received, before any JSON parsing. */
  rawBody: string;
  /** Injectable for tests. */
  nowMs?: number;
  toleranceSeconds?: number;
}

export interface VerifyResult {
  valid: boolean;
  reason?: SignatureFailure;
}

/** Decode a `whsec_…` secret into raw key bytes. */
export function decodeSecret(secret: string): Buffer {
  const body = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  return Buffer.from(body, "base64");
}

export function signPayload(
  secret: string,
  webhookId: string,
  webhookTimestamp: string,
  rawBody: string,
): string {
  const key = decodeSecret(secret);
  return createHmac("sha256", key)
    .update(`${webhookId}.${webhookTimestamp}.${rawBody}`)
    .digest("base64");
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  // timingSafeEqual throws on length mismatch, which would itself be a
  // timing signal — compare lengths separately and still run the
  // comparison on equal-length buffers.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function verifyWebhookSignature(input: VerifyInput): VerifyResult {
  const {
    secret,
    webhookId,
    webhookTimestamp,
    webhookSignature,
    rawBody,
    nowMs = Date.now(),
    toleranceSeconds = WEBHOOK_TOLERANCE_SECONDS,
  } = input;

  if (!secret) return { valid: false, reason: "missing_secret" };
  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    return { valid: false, reason: "missing_headers" };
  }

  // Replay window. Standard Webhooks sends seconds since the epoch.
  const ts = Number(webhookTimestamp);
  if (!Number.isFinite(ts)) return { valid: false, reason: "bad_timestamp" };
  const skewSeconds = Math.abs(nowMs / 1000 - ts);
  if (skewSeconds > toleranceSeconds) {
    return { valid: false, reason: "timestamp_out_of_tolerance" };
  }

  const expected = signPayload(secret, webhookId, webhookTimestamp, rawBody);

  // "v1,sigA v1,sigB" — several versions/keys may be offered at once.
  const presented = webhookSignature
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const comma = part.indexOf(",");
      if (comma === -1) return { version: "", value: part };
      return {
        version: part.slice(0, comma),
        value: part.slice(comma + 1),
      };
    })
    .filter((p) => p.version === "v1" && p.value.length > 0);

  if (presented.length === 0) {
    return { valid: false, reason: "malformed_signature" };
  }

  // Check every candidate — do not early-exit on the first mismatch.
  let matched = false;
  for (const p of presented) {
    if (constantTimeEquals(p.value, expected)) matched = true;
  }

  return matched ? { valid: true } : { valid: false, reason: "no_match" };
}

/** Header names Quo sends, lower-cased (Standard Webhooks). */
export const SIGNATURE_HEADERS = {
  id: "webhook-id",
  timestamp: "webhook-timestamp",
  signature: "webhook-signature",
} as const;

export function readSignatureHeaders(headers: Headers) {
  return {
    webhookId: headers.get(SIGNATURE_HEADERS.id),
    webhookTimestamp: headers.get(SIGNATURE_HEADERS.timestamp),
    webhookSignature: headers.get(SIGNATURE_HEADERS.signature),
  };
}
