import { env } from "@/lib/env";
import { apiBaseUrl, QUO_API_VERSION } from "@/lib/quo/config";
import { QuoApiError, classifyStatus } from "@/lib/quo/errors";

/**
 * The one place that speaks HTTP to Quo. Nothing else in the codebase
 * may call api.quo.com directly (§4) — that keeps auth, versioning,
 * rate limiting and error classification in a single reviewable file.
 *
 * SERVER ONLY. Importing this from a client component would ship the
 * API key to the browser.
 *
 * Two things about Quo's API that are easy to get wrong:
 *
 *  1. Authentication is `Authorization: <key>` with NO "Bearer " prefix.
 *     Quo's docs call this out explicitly. Sending "Bearer <key>" 401s.
 *
 *  2. There are two surfaces on the same host. The stable v1 API lives
 *     under /v1/… and is where all call data (calls, recordings,
 *     transcripts, summaries) lives. The newer versioned surface has no
 *     /v1 prefix, requires a `Quo-Api-Version` header, and is where the
 *     unified webhook management lives. We use both, deliberately.
 */

const DEFAULT_TIMEOUT_MS = 15_000;

// Quo allows 10 requests/second per API key. This spaces requests
// within a single serverless instance. It is not a distributed limiter
// — with several instances we can still exceed the limit, which is why
// 429 is also handled as a retryable error rather than relied upon
// never to happen.
const MIN_REQUEST_SPACING_MS = 110;
let lastRequestAt = 0;

async function pace(): Promise<void> {
  const now = Date.now();
  const wait = lastRequestAt + MIN_REQUEST_SPACING_MS - now;
  lastRequestAt = wait > 0 ? lastRequestAt + MIN_REQUEST_SPACING_MS : now;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Record<string, string | string[] | number | undefined | null>;
  body?: unknown;
  /** Use the versioned surface (no /v1, sends Quo-Api-Version). */
  versioned?: boolean;
  timeoutMs?: number;
}

function buildUrl(
  path: string,
  query: RequestOptions["query"],
  versioned: boolean,
): string {
  const base = apiBaseUrl();
  const prefix = versioned ? "" : "/v1";
  const url = new URL(`${base}${prefix}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      // Quo expects repeated params for arrays (participants[], etc.)
      for (const v of value) url.searchParams.append(key, String(v));
    } else {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const apiKey = env.QUO_API_KEY;
  if (!apiKey) {
    throw new QuoApiError({
      message: "QUO_API_KEY is not configured",
      kind: "auth",
      path,
    });
  }

  const versioned = opts.versioned ?? false;
  const url = buildUrl(path, opts.query, versioned);

  const headers: Record<string, string> = {
    // No "Bearer" — this is not a mistake. See the file header.
    Authorization: apiKey,
    Accept: "application/json",
  };
  if (versioned) headers["Quo-Api-Version"] = QUO_API_VERSION;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  await pace();

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    throw new QuoApiError({
      message: aborted ? "Quo request timed out" : "Quo request failed",
      kind: "retryable",
      path,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const retryAfter = Number(res.headers.get("retry-after"));
    let code: string | null = null;
    let message = `Quo ${res.status} on ${path}`;
    try {
      const parsed = (await res.json()) as {
        code?: string;
        message?: string;
        title?: string;
      };
      code = parsed.code ?? null;
      // Quo's error bodies describe the request, not the customer, so
      // they are safe to keep. Full payloads are never logged.
      if (parsed.message) message = `${message}: ${parsed.message}`;
    } catch {
      // Non-JSON error body — the status alone is enough to classify.
    }
    throw new QuoApiError({
      message,
      kind: classifyStatus(res.status),
      status: res.status,
      path,
      retryAfterSeconds: Number.isFinite(retryAfter) ? retryAfter : null,
      code,
    });
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---------------- response shapes (only what we consume) ----------------

export interface QuoCall {
  id: string;
  direction: "incoming" | "outgoing" | string;
  status: string;
  duration: number | null;
  phoneNumberId: string | null;
  userId: string | null;
  answeredBy: string | null;
  initiatedBy: string | null;
  participants: string[] | null;
  aiHandled: string | null;
  forwardedFrom: unknown;
  forwardedTo: unknown;
  createdAt: string | null;
  answeredAt: string | null;
  completedAt: string | null;
  updatedAt: string | null;
}

export interface QuoRecording {
  id: string;
  url: string | null;
  type: string | null;
  duration: number | null;
  startTime: string | null;
  status: string | null;
}

export interface QuoTranscriptSegment {
  content: string;
  start: number;
  end: number;
  identifier: string | null;
  userId: string | null;
}

export interface QuoTranscript {
  callId: string;
  createdAt: string | null;
  duration: number | null;
  /** absent | in-progress | completed | failed */
  status: string;
  dialogue: QuoTranscriptSegment[] | null;
}

export interface QuoSummary {
  callId: string;
  /** absent | in-progress | completed | failed */
  status: string;
  /** Quo returns bullet points, not prose. */
  summary: string[] | null;
  /** Scale-plan only; null on Business. */
  nextSteps: string[] | null;
}

export interface QuoPhoneNumber {
  id: string;
  name: string | null;
  number: string | null;
}

export interface QuoUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

export interface QuoConversation {
  id: string;
  phoneNumberId: string | null;
  participants: string[] | null;
  lastActivityAt: string | null;
  updatedAt: string | null;
}

export interface QuoContact {
  id: string;
  externalId?: string | null;
  defaultFields?: Record<string, unknown>;
}

interface Paged<T> {
  data: T[];
  /** Documented by Quo as unreliable — never used for control flow. */
  totalItems?: number;
  nextPageToken?: string | null;
}

// ---------------- the client ----------------

export const quoClient = {
  /** GET /v1/calls/{id} */
  getCall: (callId: string) =>
    request<{ data: QuoCall }>(`/calls/${encodeURIComponent(callId)}`).then(
      (r) => r.data,
    ),

  /**
   * GET /v1/calls — one page.
   *
   * NOTE: Quo requires BOTH `phoneNumberId` and `participants`, and only
   * supports 1:1 conversations. There is no "list every recent call on
   * this number" endpoint, which is why reconciliation has to walk
   * conversations first (see reconcile.ts).
   */
  listCalls: (params: {
    phoneNumberId: string;
    participants: string[];
    createdAfter?: string;
    createdBefore?: string;
    maxResults?: number;
    pageToken?: string;
  }) =>
    request<Paged<QuoCall>>("/calls", {
      query: {
        phoneNumberId: params.phoneNumberId,
        participants: params.participants,
        createdAfter: params.createdAfter,
        createdBefore: params.createdBefore,
        maxResults: params.maxResults ?? 50,
        pageToken: params.pageToken,
      },
    }),

  /** GET /v1/call-recordings/{callId} — may hold several segments. */
  getRecordings: (callId: string) =>
    request<{ data: QuoRecording[] }>(
      `/call-recordings/${encodeURIComponent(callId)}`,
    ).then((r) => r.data ?? []),

  /** GET /v1/call-transcripts/{callId} — Business/Scale plans only. */
  getTranscript: (callId: string) =>
    request<{ data: QuoTranscript }>(
      `/call-transcripts/${encodeURIComponent(callId)}`,
    ).then((r) => r.data),

  /** GET /v1/call-summaries/{callId} — Business/Scale plans only. */
  getSummary: (callId: string) =>
    request<{ data: QuoSummary }>(
      `/call-summaries/${encodeURIComponent(callId)}`,
    ).then((r) => r.data),

  /** GET /v1/phone-numbers */
  listPhoneNumbers: () =>
    request<Paged<QuoPhoneNumber>>("/phone-numbers", {
      query: { maxResults: 50 },
    }).then((r) => r.data ?? []),

  /** GET /v1/users */
  listUsers: () =>
    request<Paged<QuoUser>>("/users", { query: { maxResults: 50 } }).then(
      (r) => r.data ?? [],
    ),

  /** GET /v1/conversations — the index reconciliation walks. */
  listConversations: (params: {
    phoneNumbers?: string[];
    updatedAfter?: string;
    maxResults?: number;
    pageToken?: string;
  }) =>
    request<Paged<QuoConversation>>("/conversations", {
      query: {
        phoneNumbers: params.phoneNumbers,
        updatedAfter: params.updatedAfter,
        maxResults: params.maxResults ?? 50,
        pageToken: params.pageToken,
      },
    }),

  /** POST /v1/contacts — externalId keeps the CRM id authoritative. */
  createContact: (body: unknown) =>
    request<{ data: QuoContact }>("/contacts", {
      method: "POST",
      body,
    }).then((r) => r.data),

  /** PATCH /v1/contacts/{id} */
  updateContact: (id: string, body: unknown) =>
    request<{ data: QuoContact }>(`/contacts/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body,
    }).then((r) => r.data),

  // ---- versioned surface: unified webhook management ----

  listWebhooks: () =>
    request<{ data: unknown[] }>("/webhooks", { versioned: true }).then(
      (r) => r.data ?? [],
    ),

  createWebhook: (body: {
    url: string;
    events: string[];
    label?: string;
    resourceIds?: string[];
    status?: "enabled" | "disabled";
  }) =>
    request<{ data: { id: string; key?: string } }>("/webhooks", {
      method: "POST",
      versioned: true,
      body,
    }).then((r) => r.data),

  deleteWebhook: (id: string) =>
    request<void>(`/webhooks/${encodeURIComponent(id)}`, {
      method: "DELETE",
      versioned: true,
    }),

  /** Ask Quo to send us a signed test delivery of a given event type. */
  sendTestEvent: (webhookId: string, eventType: string) =>
    request<unknown>(
      `/webhooks/${encodeURIComponent(webhookId)}/events/test`,
      { method: "POST", versioned: true, body: { eventType } },
    ),

  /** Delivery history — powers the integration settings page. */
  listWebhookEvents: (webhookId: string) =>
    request<{ data: unknown[] }>(
      `/webhooks/${encodeURIComponent(webhookId)}/events`,
      { versioned: true },
    ).then((r) => r.data ?? []),
};

/**
 * Follow `nextPageToken` to exhaustion.
 *
 * Quo documents `totalItems` as inaccurate, so it is never used to
 * decide when to stop — the only reliable signal is the token going
 * null. `maxPages` is a safety valve so a malformed cursor cannot spin
 * forever inside a serverless function.
 */
export async function paginate<T>(
  fetchPage: (pageToken?: string) => Promise<Paged<T>>,
  opts: { maxPages?: number; maxItems?: number } = {},
): Promise<{ items: T[]; truncated: boolean }> {
  const maxPages = opts.maxPages ?? 20;
  const maxItems = opts.maxItems ?? 1000;
  const items: T[] = [];
  let token: string | undefined;
  let pages = 0;

  for (;;) {
    const page = await fetchPage(token);
    items.push(...(page.data ?? []));
    pages += 1;
    const next = page.nextPageToken;
    if (!next) return { items, truncated: false };
    if (pages >= maxPages || items.length >= maxItems) {
      return { items, truncated: true };
    }
    token = next;
  }
}
