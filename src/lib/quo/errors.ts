/**
 * Failure classification for Quo API calls.
 *
 * The queue needs to tell these apart, because they want opposite
 * treatment: a 503 should be retried with backoff, a 401 should stop
 * and raise an alarm, and "the transcript isn't ready yet" is not a
 * failure at all — it is a normal state that means "ask again later".
 * Retrying a 403 five times just turns one broken config into five log
 * lines.
 */
export type QuoErrorKind =
  /** Transient: network, 5xx, timeout. Retry with backoff. */
  | "retryable"
  /** 429. Retry, but back off harder and respect Retry-After. */
  | "rate_limited"
  /** 401. The API key is wrong or revoked — a human must fix it. */
  | "auth"
  /** 403. Key is valid but the workspace/plan does not allow this. */
  | "permission"
  /** 404. The resource does not exist (and probably never will). */
  | "not_found"
  /** The resource exists but is still being produced by Quo. */
  | "not_ready"
  /** 400/422. We sent something wrong; retrying cannot help. */
  | "validation"
  | "unknown";

export class QuoApiError extends Error {
  readonly kind: QuoErrorKind;
  readonly status: number | null;
  readonly path: string;
  /** Seconds Quo asked us to wait, when it said so. */
  readonly retryAfterSeconds: number | null;
  /** Quo's error code, when present. Never contains customer data. */
  readonly code: string | null;

  constructor(opts: {
    message: string;
    kind: QuoErrorKind;
    status?: number | null;
    path: string;
    retryAfterSeconds?: number | null;
    code?: string | null;
  }) {
    super(opts.message);
    this.name = "QuoApiError";
    this.kind = opts.kind;
    this.status = opts.status ?? null;
    this.path = opts.path;
    this.retryAfterSeconds = opts.retryAfterSeconds ?? null;
    this.code = opts.code ?? null;
  }

  /** Whether the queue should schedule another attempt. */
  get isRetryable(): boolean {
    return (
      this.kind === "retryable" ||
      this.kind === "rate_limited" ||
      this.kind === "not_ready"
    );
  }
}

export function classifyStatus(status: number): QuoErrorKind {
  if (status === 401) return "auth";
  if (status === 403) return "permission";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  if (status === 400 || status === 422) return "validation";
  if (status >= 500) return "retryable";
  return "unknown";
}

/**
 * Backoff schedule in milliseconds. Deliberately bounded — a job that
 * has failed 5 times is a job a human needs to look at, not one the
 * machine should keep grinding on.
 */
export function backoffMs(attempt: number, kind?: QuoErrorKind): number {
  const base = kind === "rate_limited" ? 5_000 : 2_000;
  const capped = Math.min(attempt, 6);
  // 2s, 4s, 8s, 16s, 32s, 64s (x2.5 for rate limits)
  const delay = base * Math.pow(2, Math.max(0, capped - 1));
  // Jitter stops a burst of failures from retrying in lockstep.
  const jitter = delay * 0.2 * Math.random();
  return Math.round(delay + jitter);
}
