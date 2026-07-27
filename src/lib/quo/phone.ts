import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Telephone-number handling for lead matching.
 *
 * Two forms are kept for every number: whatever a human typed (kept for
 * display, because "07700 900123" is how the customer says it) and the
 * normalised E.164 form, which is the ONLY thing matching is allowed to
 * compare. Matching on display values means "+1 555 010 1234" and
 * "(555) 010-1234" look like two different customers.
 *
 * Deliberately NOT implemented: fuzzy "last N digits" matching. It
 * attaches a call to the wrong lead eventually, and on this CRM a wrong
 * match means a salesperson reads another customer's conversation.
 * Anything we cannot match exactly goes to the review queue instead.
 *
 * Client-safe: no server imports, so the browser can format numbers too.
 */

const DEFAULT_REGION = "US";

type Region = Parameters<typeof parsePhoneNumberFromString>[1];

/**
 * Normalise to E.164 ("+15550101234"), or null when the value is not a
 * valid telephone number. Null is meaningful — it means "do not match
 * on this", not "try harder".
 */
export function toE164(
  raw: string | null | undefined,
  region: string = DEFAULT_REGION,
): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  // Fast path: already E.164 and plausible.
  const parsed = parsePhoneNumberFromString(
    trimmed,
    (trimmed.startsWith("+") ? undefined : region.toUpperCase()) as Region,
  );
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

/**
 * Human-readable form. Falls back to the original string when the value
 * cannot be parsed — showing a salesperson the raw value they typed
 * beats showing them nothing.
 */
export function displayPhone(
  raw: string | null | undefined,
  region: string = DEFAULT_REGION,
): string {
  if (!raw) return "";
  const trimmed = String(raw).trim();
  const parsed = parsePhoneNumberFromString(
    trimmed,
    (trimmed.startsWith("+") ? undefined : region.toUpperCase()) as Region,
  );
  if (!parsed || !parsed.isValid()) return trimmed;
  return parsed.formatInternational();
}

/** True only when both normalise to the same E.164 value. */
export function sameNumber(
  a: string | null | undefined,
  b: string | null | undefined,
  region: string = DEFAULT_REGION,
): boolean {
  const x = toE164(a, region);
  const y = toE164(b, region);
  return x !== null && x === y;
}

/**
 * The `tel:` target for click-to-call. E.164 when we can produce it,
 * otherwise the raw digits — a dialler can still handle those.
 */
export function telHref(
  raw: string | null | undefined,
  region: string = DEFAULT_REGION,
): string | null {
  const e164 = toE164(raw, region);
  if (e164) return `tel:${e164}`;
  const digits = String(raw ?? "").replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : null;
}

/**
 * Last four digits, for masked display in places where the full number
 * is more than the reader needs (notifications, logs).
 */
export function maskNumber(raw: string | null | undefined): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length < 4) return "•••";
  return `•••${digits.slice(-4)}`;
}
