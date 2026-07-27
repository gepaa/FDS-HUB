import { env } from "@/lib/env";

/**
 * Quo integration configuration — the single place that decides whether
 * the integration is on, and what it is allowed to do.
 *
 * Three capabilities are tracked separately, because they fail
 * separately in real deployments:
 *
 *   - `canCallApi`        we have a key, so we can fetch call artifacts
 *   - `canReceiveWebhooks` we have a signing secret, so deliveries can
 *                          be verified (an unverifiable delivery is
 *                          always rejected — never trusted)
 *   - `canExtract`        our own AI pass is switched on
 *
 * Everything is server-only. Nothing here may be imported from a client
 * component: it reads secrets.
 */

export const QUO_PROVIDER = "quo";

/**
 * Payload version pinned when the webhook subscription is created, and
 * sent on every request to the versioned API surface. Quo pins a
 * subscription's payload shape at creation, so changing this constant
 * does NOT change existing subscriptions — they have to be recreated.
 */
export const QUO_API_VERSION = "2026-03-30";

/** How far out of date a webhook timestamp may be before we reject it. */
export const WEBHOOK_TOLERANCE_SECONDS = 300;

export interface QuoStatus {
  /** Master switch (QUO_INTEGRATION_ENABLED). */
  enabled: boolean;
  canCallApi: boolean;
  canReceiveWebhooks: boolean;
  canExtract: boolean;
  /** Environment variables that still need a value. */
  missing: string[];
}

export function quoStatus(): QuoStatus {
  const enabled = env.QUO_INTEGRATION_ENABLED;
  const hasKey = Boolean(env.QUO_API_KEY);
  const hasSecret = Boolean(env.QUO_WEBHOOK_SECRET);

  const missing: string[] = [];
  if (!enabled) missing.push("QUO_INTEGRATION_ENABLED");
  if (!hasKey) missing.push("QUO_API_KEY");
  if (!hasSecret) missing.push("QUO_WEBHOOK_SECRET");

  return {
    enabled,
    canCallApi: enabled && hasKey,
    canReceiveWebhooks: enabled && hasSecret,
    canExtract: enabled && env.QUO_AI_EXTRACTION_ENABLED,
    missing,
  };
}

/** Quo phone-number IDs we sync. Empty array = every number. */
export function syncedPhoneNumberIds(): string[] {
  return (env.QUO_PHONE_NUMBER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * True when an activity on this Quo number should be processed. An
 * empty allow-list means "all numbers", which is also what the webhook
 * subscription defaults to.
 */
export function isSyncedPhoneNumber(phoneNumberId: string | null): boolean {
  const ids = syncedPhoneNumberIds();
  if (ids.length === 0) return true;
  return phoneNumberId !== null && ids.includes(phoneNumberId);
}

export function defaultPhoneNumberId(): string | null {
  return env.QUO_DEFAULT_PHONE_NUMBER_ID || syncedPhoneNumberIds()[0] || null;
}

/** Host with any trailing slash removed, so path joins stay predictable. */
export function apiBaseUrl(): string {
  return env.QUO_API_BASE_URL.replace(/\/+$/, "");
}
