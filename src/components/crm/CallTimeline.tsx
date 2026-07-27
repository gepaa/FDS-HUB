"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Voicemail,
  FileText,
  Sparkles,
  Mic,
  ExternalLink,
  Loader2,
  ChevronDown,
  Search,
  Bot,
} from "lucide-react";
import { Button } from "@/components/kit/Button";
import { cn } from "@/lib/utils";
import type { CallSummaryDTO, CallDetailDTO } from "@/lib/quo/dto";

/**
 * The call history on a lead.
 *
 * Loads a lightweight list first — one row per call with availability
 * flags — and fetches the heavy content (audio, transcript, extraction)
 * only when a salesperson opens a specific call. A lead with a hundred
 * calls opens as fast as a new one.
 */

interface Props {
  recordId: string;
  /** Refetch trigger — bump to reload after an external change. */
  refreshKey?: number;
}

export function CallTimeline({ recordId, refreshKey = 0 }: Props) {
  // Keyed so switching lead (or forcing a refresh) remounts and resets
  // state naturally, instead of clearing it from inside an effect.
  return <CallList key={`${recordId}:${refreshKey}`} recordId={recordId} />;
}

function CallList({ recordId }: { recordId: string }) {
  const [calls, setCalls] = useState<CallSummaryDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/records/${recordId}/calls?limit=25`)
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load calls (${r.status})`);
        return r.json();
      })
      .then((data: { calls: CallSummaryDTO[] }) => {
        if (!cancelled) setCalls(data.calls);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [recordId]);

  if (error) {
    return <p className="text-sm text-muted">{error}</p>;
  }

  if (calls === null) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Loading calls…
      </p>
    );
  }

  if (calls.length === 0) {
    return (
      <p className="text-sm text-muted">
        No calls yet. Once Quo is connected, every call with this lead appears
        here automatically.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {calls.map((call) => (
        <li key={call.id}>
          <CallRow
            call={call}
            open={expanded === call.id}
            onToggle={() =>
              setExpanded((cur) => (cur === call.id ? null : call.id))
            }
          />
        </li>
      ))}
    </ul>
  );
}

function CallRow({
  call,
  open,
  onToggle,
}: {
  call: CallSummaryDTO;
  open: boolean;
  onToggle: () => void;
}) {
  const Icon = call.missed
    ? PhoneMissed
    : call.direction === "incoming"
      ? PhoneIncoming
      : PhoneOutgoing;

  const tone = call.missed
    ? "text-[var(--red)]"
    : call.direction === "incoming"
      ? "text-[var(--green)]"
      : "text-muted";

  return (
    <div
      className={cn(
        "surface rounded-lg border border-hairline",
        !call.reviewedAt && "border-l-2 border-l-[var(--accent)]",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
      >
        <Icon className={cn("h-4 w-4 shrink-0", tone)} aria-hidden />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium text-ink">
              {call.missed
                ? "Missed call"
                : call.direction === "incoming"
                  ? "Inbound call"
                  : "Outbound call"}
            </span>
            {call.durationSec ? (
              <span className="text-xs text-muted">
                {formatDuration(call.durationSec)}
              </span>
            ) : null}
            {call.voicemail ? (
              <Badge icon={Voicemail} label="Voicemail" />
            ) : null}
            {call.aiHandled ? <Badge icon={Bot} label="AI answered" /> : null}
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {formatWhen(call.startedAt ?? call.completedAt)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {call.hasRecording ? (
            <Availability icon={Mic} label="Recording available" />
          ) : null}
          {call.hasTranscript ? (
            <Availability icon={FileText} label="Transcript available" />
          ) : null}
          {call.hasExtraction ? (
            <Availability icon={Sparkles} label="AI summary available" />
          ) : null}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted transition-transform",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </div>
      </button>

      {open ? <CallDetail activityId={call.id} /> : null}
    </div>
  );
}

function Badge({
  icon: Icon,
  label,
}: {
  icon: typeof Voicemail;
  label: string;
}) {
  return (
    <span className="surface-muted inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-muted">
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}

function Availability({
  icon: Icon,
  label,
}: {
  icon: typeof Mic;
  label: string;
}) {
  return (
    <span title={label}>
      <Icon className="h-3.5 w-3.5 text-muted" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Everything about one call — fetched only when opened. */
function CallDetail({ activityId }: { activityId: string }) {
  const [detail, setDetail] = useState<CallDetailDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/calls/${activityId}`);
      if (!res.ok) throw new Error(`Could not load this call (${res.status})`);
      const data = (await res.json()) as CallDetailDTO;
      setDetail(data);
      setNote(data.extraction?.crmNote ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this call");
    }
  }, [activityId]);

  useEffect(() => {
    // Fetch-on-open. The lint rule cannot see that `load` only sets
    // state after an await, so it reads this as a synchronous cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Opening a call is what "reviewed" means — no extra click.
  useEffect(() => {
    if (!detail || detail.reviewedAt) return;
    void fetch(`/api/calls/${activityId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewed: true }),
    });
  }, [detail, activityId]);

  const segments = useMemo(() => {
    const all = detail?.transcript?.segments ?? [];
    if (!query.trim()) return all;
    const q = query.toLowerCase();
    return all.filter((s) => s.content.toLowerCase().includes(q));
  }, [detail, query]);

  if (error) {
    return <p className="px-3 pb-3 text-sm text-muted">{error}</p>;
  }

  if (!detail) {
    return (
      <p className="flex items-center gap-2 px-3 pb-3 text-sm text-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Loading…
      </p>
    );
  }

  const saveNote = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/calls/${activityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crmNote: note }),
      });
      if (res.ok) setDetail((await res.json()) as CallDetailDTO);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 border-t border-hairline px-3 py-3">
      {/* Recordings */}
      {detail.recordings.length > 0 ? (
        <Section title="Recording">
          <div className="space-y-2">
            {detail.recordings.map((rec) => (
              <div key={rec.segmentIndex}>
                {detail.recordings.length > 1 ? (
                  <p className="mb-1 text-xs text-muted">
                    Part {rec.segmentIndex + 1} of {detail.recordings.length}
                  </p>
                ) : null}
                {/* Streamed through our own permission-checked route —
                    the provider URL is never exposed to the browser. */}
                <audio
                  controls
                  preload="none"
                  src={rec.src}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {/* Quo's summary — original, never edited */}
      {detail.providerSummary && detail.providerSummary.bullets.length > 0 ? (
        <Section title="Quo summary">
          <ul className="list-disc space-y-1 pl-4 text-sm text-ink">
            {detail.providerSummary.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
          {detail.providerSummary.nextSteps.length > 0 ? (
            <>
              <p className="mt-2 text-xs font-medium text-muted">
                Quo next steps
              </p>
              <ul className="list-disc space-y-1 pl-4 text-sm text-ink">
                {detail.providerSummary.nextSteps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </>
          ) : null}
        </Section>
      ) : null}

      {/* Our extraction — clearly labelled as AI, and editable */}
      {detail.extraction?.status === "completed" ? (
        <Section
          title="CRM summary"
          badge={
            <span className="surface-muted inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-muted">
              <Sparkles className="h-3 w-3" aria-hidden />
              AI generated
              {detail.extraction.crmNoteEditedAt ? " · edited" : ""}
            </span>
          }
        >
          {detail.extraction.needsHumanReview ? (
            <p className="mb-2 rounded-md border border-[var(--amber)] px-2 py-1 text-xs text-ink">
              Flagged for human review — parts of this call were unclear.
            </p>
          ) : null}

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={Math.min(10, Math.max(3, note.split("\n").length))}
            className="w-full resize-y rounded-md border border-hairline bg-[var(--panel)] px-2 py-1.5 text-sm text-ink"
            aria-label="Editable CRM summary"
          />
          <div className="mt-2 flex items-center gap-2">
            <Button
              size="sm"
              onClick={saveNote}
              disabled={saving || note === (detail.extraction.crmNote ?? "")}
            >
              {saving ? "Saving…" : "Save note"}
            </Button>
            {detail.extraction.intentScore !== null ? (
              <span className="text-xs text-muted">
                Buying intent {detail.extraction.intentScore}/100
              </span>
            ) : null}
          </div>
        </Section>
      ) : null}

      {/* Proposed follow-up */}
      {detail.followUp ? (
        <Section title="Proposed follow-up">
          <div className="rounded-md border border-hairline p-2">
            <p className="text-sm font-medium text-ink">
              {detail.followUp.title}
            </p>
            {detail.followUp.detail ? (
              <p className="mt-1 whitespace-pre-line text-xs text-muted">
                {detail.followUp.detail}
              </p>
            ) : null}
            <div className="mt-2 flex items-center gap-2">
              {detail.followUp.status === "suggested" ? (
                <>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={async () => {
                      await fetch(`/api/tasks/${detail.followUp!.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: "queued" }),
                      });
                      void load();
                    }}
                  >
                    Accept task
                  </Button>
                  <Button
                    size="sm"
                    onClick={async () => {
                      await fetch(`/api/tasks/${detail.followUp!.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: "cancelled" }),
                      });
                      void load();
                    }}
                  >
                    Dismiss
                  </Button>
                </>
              ) : (
                <span className="text-xs text-muted">
                  {detail.followUp.status}
                </span>
              )}
              {detail.followUp.dueDate ? (
                <span className="text-xs text-muted">
                  Due {new Date(detail.followUp.dueDate).toLocaleDateString()}
                </span>
              ) : null}
            </div>
          </div>
        </Section>
      ) : null}

      {/* Transcript */}
      {detail.transcript?.segments.length ? (
        <Section title="Transcript">
          <label className="mb-2 flex items-center gap-2 rounded-md border border-hairline px-2 py-1">
            <Search className="h-3.5 w-3.5 text-muted" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search this transcript"
              className="w-full bg-transparent text-sm text-ink outline-none"
            />
          </label>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {segments.length === 0 ? (
              <p className="text-xs text-muted">No matches.</p>
            ) : (
              segments.map((seg, i) => (
                <p key={i} className="text-sm">
                  <span
                    className={cn(
                      "mr-2 text-xs font-medium",
                      seg.speaker === "customer"
                        ? "text-[var(--accent)]"
                        : "text-muted",
                    )}
                  >
                    {seg.speaker === "customer"
                      ? "Customer"
                      : seg.speaker === "team"
                        ? "Us"
                        : "—"}
                  </span>
                  <span className="text-ink">{seg.content}</span>
                </p>
              ))
            )}
          </div>
        </Section>
      ) : detail.transcriptStatus === "in-progress" ? (
        <p className="text-xs text-muted">
          Transcript is still being prepared by Quo.
        </p>
      ) : null}

      {detail.providerLink ? (
        <a
          href={detail.providerLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
        >
          Open this conversation in Quo
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      ) : null}
    </div>
  );
}

function Section({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-1.5 flex items-center gap-2">
        <h4 className="text-xs font-semibold tracking-wide text-muted uppercase">
          {title}
        </h4>
        {badge}
      </div>
      {children}
    </section>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "Time unknown";
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
