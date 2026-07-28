"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PhoneIncoming, X, AlertTriangle } from "lucide-react";
import { GlassPanel } from "@/components/kit/GlassPanel";
import { Button } from "@/components/kit/Button";
import { StageBadge } from "@/components/crm/badges";
import { useSound } from "@/hooks/useSound";

/**
 * The ringing-phone alert.
 *
 * A salesperson should never have to search for a caller while the
 * phone is in their hand. Quo's `call.ringing` webhook reaches the CRM
 * before anyone picks up, so by the time they answer, the lead — stage,
 * product interest, what we last promised — is already on screen.
 *
 * Polling, not a socket: the hub has no pub/sub layer, and the shell
 * already polls for its counts. Adding a websocket transport for one
 * card would be a much larger change than the feature justifies.
 *
 * MULTIPLE TABS: whichever tab sees a call first claims it in
 * localStorage; the others stay quiet. Without that, someone with the
 * CRM open on two monitors gets two alerts for one phone call.
 * Dismissing is likewise shared, so it clears everywhere.
 */

interface IncomingCall {
  activityId: string;
  startedAt: string | null;
  phone: string;
  providerLink: string | null;
  known: boolean;
  record: {
    id: string;
    name: string;
    company: string | null;
    stage: string;
    owner: string;
    productInterest: string | null;
    needsEnrichment: boolean;
  } | null;
  lastContactDate: string | null;
  nextAction: string | null;
  nextActionDate: string | null;
  overdue: boolean;
  lastCallNote: string | null;
}

const POLL_MS = 8_000;
const CLAIM_PREFIX = "quo:alert:";
/** A claim older than this is stale — the tab that made it has gone. */
const CLAIM_TTL_MS = 60_000;

function claimAlert(id: string): boolean {
  if (typeof window === "undefined") return false;
  const key = CLAIM_PREFIX + id;
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) {
      const parsed = JSON.parse(existing) as { at: number; dismissed?: boolean };
      if (parsed.dismissed) return false;
      if (Date.now() - parsed.at < CLAIM_TTL_MS) {
        // Another tab already owns this one.
        return parsed.at === claimedAt.get(id);
      }
    }
    const at = Date.now();
    window.localStorage.setItem(key, JSON.stringify({ at }));
    claimedAt.set(id, at);
    return true;
  } catch {
    // Private browsing / storage disabled — better a duplicate alert
    // than no alert at all.
    return true;
  }
}

function dismissAlert(id: string): void {
  try {
    window.localStorage.setItem(
      CLAIM_PREFIX + id,
      JSON.stringify({ at: Date.now(), dismissed: true }),
    );
  } catch {
    /* ignore */
  }
}

/** Claims made by THIS tab, so it recognises its own. */
const claimedAt = new Map<string, number>();

export function IncomingCallAlert() {
  const [calls, setCalls] = useState<IncomingCall[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const timer = useRef<number | null>(null);
  const { sound } = useSound();
  /** Calls we have already rung for, so a poll doesn't re-trigger. */
  const rungFor = useRef<Set<string>>(new Set());

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/quo/incoming", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { calls: IncomingCall[] };
      const mine = data.calls.filter((c) => claimAlert(c.activityId));
      setCalls(mine);

      // Ring for anything we haven't rung for yet. A salesperson is
      // rarely staring at the CRM when the phone goes — without this
      // the alert is only useful to someone already looking at it.
      for (const call of mine) {
        if (rungFor.current.has(call.activityId)) continue;
        rungFor.current.add(call.activityId);
        sound("ring");
      }
    } catch {
      // A failed poll is not worth surfacing — the next one is 8s away.
    }
  }, [sound]);

  useEffect(() => {
    // Polling an external system — exactly what effects are for. State
    // is set in the async callback, never synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void poll();
    timer.current = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [poll]);

  // Another tab dismissed it — clear here too.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key?.startsWith(CLAIM_PREFIX) || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue) as { dismissed?: boolean };
        if (parsed.dismissed) {
          const id = e.key.slice(CLAIM_PREFIX.length);
          setDismissed((prev) => new Set(prev).add(id));
        }
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const visible = calls.filter((c) => !dismissed.has(c.activityId));
  if (visible.length === 0) return null;

  return (
    <div
      className="fixed right-4 bottom-4 z-50 flex w-[min(92vw,22rem)] flex-col gap-2"
      role="region"
      aria-label="Incoming calls"
    >
      {visible.map((call) => (
        <GlassPanel key={call.activityId} strong className="p-3">
          <div
            className="flex items-start gap-2"
            role="status"
            aria-live="polite"
          >
            <PhoneIncoming
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--green)]"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs tracking-wide text-muted uppercase">
                Incoming call
              </p>

              {call.record && !call.record.needsEnrichment ? (
                <>
                  <p className="truncate text-sm font-semibold text-ink">
                    {call.record.name}
                  </p>
                  {call.record.company ? (
                    <p className="truncate text-xs text-muted">
                      {call.record.company}
                    </p>
                  ) : null}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <StageBadge stage={call.record.stage} />
                    <span className="text-xs text-muted">
                      {call.record.owner === "unassigned"
                        ? "Unassigned"
                        : call.record.owner}
                    </span>
                  </div>
                  {call.record.productInterest ? (
                    <p className="mt-1 truncate text-xs text-ink">
                      Interested in {call.record.productInterest}
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-ink">
                    Unknown caller
                  </p>
                  <p className="text-xs text-muted">
                    A new lead has been created for this number.
                  </p>
                </>
              )}

              <p className="mt-1 text-xs text-muted">{call.phone}</p>

              {call.overdue && call.nextAction ? (
                <p className="mt-1.5 flex items-start gap-1 text-xs text-[var(--amber)]">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                  <span>Overdue: {call.nextAction}</span>
                </p>
              ) : null}

              {/* One line of context only — a notification is not the
                  place for transcript content. */}
              {call.lastCallNote ? (
                <p className="mt-1.5 line-clamp-2 text-xs text-muted">
                  Last call: {call.lastCallNote}
                </p>
              ) : null}

              <div className="mt-2 flex items-center gap-2">
                {call.record ? (
                  <Link href={`/crm?record=${call.record.id}`}>
                    <Button size="sm" variant="primary">
                      Open lead
                    </Button>
                  </Link>
                ) : null}
                {call.providerLink ? (
                  <a
                    href={call.providerLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted hover:text-ink"
                  >
                    Open in Quo
                  </a>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              aria-label="Dismiss incoming call alert"
              onClick={() => {
                dismissAlert(call.activityId);
                setDismissed((prev) => new Set(prev).add(call.activityId));
              }}
              className="rounded p-1 text-muted hover:text-ink"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </GlassPanel>
      ))}
    </div>
  );
}
