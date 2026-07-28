"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { GlassPanel } from "@/components/kit/GlassPanel";
import { Button } from "@/components/kit/Button";
import { StatusPill } from "@/components/kit/StatusPill";
import { StatTile } from "@/components/kit/StatTile";

/**
 * Administrator view of the Quo integration.
 *
 * Built so a failure can be diagnosed here rather than by reading
 * server logs: what is configured, what has arrived, what is stuck, and
 * what failed most recently — plus the buttons to retry it.
 *
 * No secret is ever rendered. The API returns booleans for the key and
 * signing secret, never their values.
 */

interface Status {
  enabled: boolean;
  apiVersion: string;
  apiKeyConfigured: boolean;
  webhookSecretConfigured: boolean;
  extractionEnabled: boolean;
  missing: string[];
  phoneNumberIds: string[];
  subscribedEvents: string[];
  recordingStorageMode: string;
  metrics: Record<string, number>;
  queue: Record<string, number>;
  errors: {
    events: {
      id: string;
      eventType: string;
      lastError: string | null;
      receivedAt: string;
      attempts: number;
    }[];
    jobs: {
      id: string;
      kind: string;
      lastError: string | null;
      updatedAt: string;
      attempts: number;
    }[];
  };
  lastWebhookAt: string | null;
  lastReconcileAt: string | null;
  lastBackfillAt: string | null;
}

export function QuoIntegrationPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  // Quo returns the signing secret exactly once, at creation. It is
  // held here only so it can be copied — never written to the database,
  // never sent anywhere else.
  const [secret, setSecret] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/integrations/quo", { cache: "no-store" });
    if (res.ok) setStatus((await res.json()) as Status);
  }, []);

  useEffect(() => {
    // Fetch-on-mount; state is only set after the await resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(action);
    setResult(null);
    try {
      const res = await fetch("/api/integrations/quo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (typeof data.signingSecret === "string" && data.signingSecret) {
        setSecret(data.signingSecret);
      }
      setResult({
        ok: res.ok,
        text: res.ok
          ? summarise(action, data)
          : String(data.error ?? "Request failed"),
      });
      await load();
    } catch (e) {
      setResult({
        ok: false,
        text: e instanceof Error ? e.message : "Request failed",
      });
    } finally {
      setBusy(null);
    }
  };

  if (!status) {
    return (
      <GlassPanel className="p-5">
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading integration status…
        </p>
      </GlassPanel>
    );
  }

  const m = status.metrics;

  return (
    <div className="flex flex-col gap-4">
      {/* Connection */}
      <GlassPanel className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
            Connection
          </h2>
          <div className="flex flex-wrap gap-2">
            <StatusPill
              status={status.enabled ? "connected" : "disconnected"}
              label={status.enabled ? "Integration on" : "Integration off"}
            />
            <StatusPill
              status={status.apiKeyConfigured ? "connected" : "disconnected"}
              label={status.apiKeyConfigured ? "API key set" : "No API key"}
            />
            <StatusPill
              status={
                status.webhookSecretConfigured ? "connected" : "disconnected"
              }
              label={
                status.webhookSecretConfigured
                  ? "Signing secret set"
                  : "No signing secret"
              }
            />
          </div>
        </div>

        {status.missing.length > 0 ? (
          <p className="mt-3 flex items-start gap-2 text-sm text-muted">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--amber)]"
              aria-hidden
            />
            <span>
              Still needed in the environment:{" "}
              <code className="text-ink">{status.missing.join(", ")}</code>
            </span>
          </p>
        ) : null}

        <dl className="mt-4 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
          <Meta label="Payload version" value={status.apiVersion} />
          <Meta
            label="Numbers synced"
            value={
              status.phoneNumberIds.length
                ? status.phoneNumberIds.join(", ")
                : "All"
            }
          />
          <Meta
            label="Recordings"
            value={
              status.recordingStorageMode === "provider"
                ? "Streamed from Quo"
                : status.recordingStorageMode
            }
          />
          <Meta
            label="AI extraction"
            value={status.extractionEnabled ? "On" : "Off"}
          />
          <Meta label="Last webhook" value={ago(status.lastWebhookAt)} />
          <Meta label="Last reconcile" value={ago(status.lastReconcileAt)} />
          <Meta label="Last backfill" value={ago(status.lastBackfillAt)} />
          <Meta
            label="Events subscribed"
            value={`${status.subscribedEvents.length}`}
          />
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => act("test_connection")}
            disabled={busy !== null}
          >
            {busy === "test_connection" ? "Testing…" : "Test API connection"}
          </Button>
          <Button
            size="sm"
            onClick={() => act("refresh_phone_numbers")}
            disabled={busy !== null}
          >
            Refresh numbers
          </Button>
          <Button
            size="sm"
            onClick={() => act("list_webhooks")}
            disabled={busy !== null}
          >
            List webhooks
          </Button>
          {/* Registers this exact deployment's URL with Quo. Reads the
              origin from the browser so it is always the site you are
              actually looking at — no chance of pointing production at
              a preview URL by mistake.

              Deliberately NOT disabled when a secret already exists.
              A configured secret does not prove a subscription exists —
              the value could have been set by hand, or be left over from
              a rotation — and disabling the button in that state locks
              the operator out of the one action that fixes it. Instead
              it confirms, because re-registering issues a new secret and
              invalidates the old one. */}
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              if (
                status.webhookSecretConfigured &&
                !window.confirm(
                  "A signing secret is already configured.\n\n" +
                    "Registering again creates a new subscription and issues a " +
                    "NEW secret — the current one stops working until you " +
                    "replace it in the environment.\n\nContinue?",
                )
              ) {
                return;
              }
              void act("register_webhook", {
                url: `${window.location.origin}/api/integrations/quo/webhooks`,
                label: "FDS Operations HQ",
              });
            }}
            disabled={busy !== null}
            title="Tell Quo to send call events to this site"
          >
            {busy === "register_webhook"
              ? "Registering…"
              : status.webhookSecretConfigured
                ? "Re-register webhook"
                : "Register webhook"}
          </Button>
          <Button
            size="sm"
            onClick={() => act("drain_jobs")}
            disabled={busy !== null}
          >
            Run pending jobs
          </Button>
          <Button
            size="sm"
            onClick={() => act("reconcile", { sinceHours: 24 })}
            disabled={busy !== null}
          >
            Reconcile last 24h
          </Button>
          <Button size="sm" onClick={() => void load()} disabled={busy !== null}>
            <RefreshCw className="mr-1 h-3 w-3" aria-hidden />
            Refresh
          </Button>
        </div>

        {/* The one-time secret. Shown big, because Quo will not show it
            again and the integration cannot verify a delivery without
            it. Not persisted anywhere — closing this loses it, and the
            fix is to rotate, not to hunt for it. */}
        {secret ? (
          <div className="mt-4 rounded-md border-2 border-[var(--amber)] p-3">
            <p className="text-sm font-semibold text-ink">
              Copy this now — Quo will never show it again
            </p>
            <p className="mt-1 text-xs text-muted">
              Paste it into Vercel as{" "}
              <code className="text-ink">QUO_WEBHOOK_SECRET</code>, then
              redeploy. Until you do, calls cannot be verified and will be
              rejected.
            </p>
            <code className="mt-2 block rounded border border-hairline bg-[var(--panel)] px-2 py-1.5 text-xs break-all text-ink select-all">
              {secret}
            </code>
            <div className="mt-2 flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => void navigator.clipboard?.writeText(secret)}
              >
                Copy to clipboard
              </Button>
              <Button size="sm" onClick={() => setSecret(null)}>
                I&apos;ve saved it
              </Button>
            </div>
          </div>
        ) : null}

        {result ? (
          <p
            className={`mt-3 flex items-start gap-2 text-sm ${
              result.ok ? "text-ink" : "text-[var(--red)]"
            }`}
          >
            {result.ok ? (
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--green)]"
                aria-hidden
              />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            )}
            <span className="whitespace-pre-line">{result.text}</span>
          </p>
        ) : null}
      </GlassPanel>

      {/* Throughput */}
      <GlassPanel className="p-5">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">
          Activity
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Webhooks received" value={m.webhooksReceived ?? 0} />
          <StatTile label="Calls stored" value={m.callsTotal ?? 0} />
          <StatTile label="Matched to a lead" value={m.callsMatched ?? 0} />
          <StatTile label="Unmatched" value={m.callsUnmatched ?? 0} />
          <StatTile label="Leads created" value={m.leadsCreated ?? 0} />
          <StatTile label="Missed calls" value={m.missedCalls ?? 0} />
          <StatTile label="Recordings" value={m.recordings ?? 0} />
          <StatTile label="Transcripts" value={m.transcripts ?? 0} />
          <StatTile label="Quo summaries" value={m.summaries ?? 0} />
          <StatTile label="AI reads" value={m.extractionsCompleted ?? 0} />
          <StatTile label="Needs review" value={m.extractionsNeedingReview ?? 0} />
          <StatTile label="Follow-ups proposed" value={m.followUpsProposed ?? 0} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Jobs waiting" value={status.queue.queued ?? 0} />
          <StatTile label="Jobs running" value={status.queue.running ?? 0} />
          <StatTile label="Jobs failed" value={status.queue.dead ?? 0} />
          <StatTile
            label="Bad signatures"
            value={m.invalidSignatures ?? 0}
          />
        </div>
      </GlassPanel>

      {/* Failures */}
      {status.errors.events.length > 0 || status.errors.jobs.length > 0 ? (
        <GlassPanel className="p-5">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">
            Recent failures
          </h2>
          <ul className="space-y-2 text-sm">
            {status.errors.jobs.map((j) => (
              <li
                key={j.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-hairline px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="font-medium text-ink">{j.kind}</span>
                  <span className="ml-2 text-xs text-muted">
                    {j.attempts} attempts · {ago(j.updatedAt)}
                  </span>
                  {j.lastError ? (
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {j.lastError}
                    </span>
                  ) : null}
                </span>
                <Button
                  size="sm"
                  onClick={() => act("retry_job", { jobId: j.id })}
                  disabled={busy !== null}
                >
                  Retry
                </Button>
              </li>
            ))}
            {status.errors.events.map((e) => (
              <li
                key={e.id}
                className="rounded-md border border-hairline px-3 py-2"
              >
                <span className="font-medium text-ink">{e.eventType}</span>
                <span className="ml-2 text-xs text-muted">
                  {e.attempts} attempts · {ago(e.receivedAt)}
                </span>
                {e.lastError ? (
                  <span className="mt-0.5 block truncate text-xs text-muted">
                    {e.lastError}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </GlassPanel>
      ) : null}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-ink">{value}</dd>
    </div>
  );
}

function ago(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function summarise(action: string, data: Record<string, unknown>): string {
  if (action === "test_connection") {
    const numbers = (data.numbers ?? []) as { number?: string }[];
    return `Connected. ${data.phoneNumberCount} Quo number(s): ${numbers
      .map((n) => n.number)
      .filter(Boolean)
      .join(", ")}`;
  }
  if (action === "register_webhook") {
    return `Webhook created (${data.webhookId}). ${data.note}${
      data.signingSecret ? `\n\n${data.signingSecret}` : ""
    }`;
  }
  if (action === "reconcile" || action === "backfill") {
    const r = data.result as Record<string, unknown> | undefined;
    if (!r) return "Done.";
    return `Scanned ${r.conversationsScanned} conversations, saw ${r.callsSeen} calls, imported ${r.callsImported}${
      r.truncated ? " (stopped at the limit)" : ""
    }.`;
  }
  if (action === "drain_jobs" || action === "retry_job") {
    return `Ran ${data.claimed ?? 0} job(s): ${data.succeeded ?? 0} ok, ${data.failed ?? 0} failed.`;
  }
  return "Done.";
}
