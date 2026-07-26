"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ExternalLink,
  GitBranch,
  Loader2,
  Rocket,
  Send,
  XCircle,
} from "lucide-react";
import type { AgentRunDTO } from "@/lib/agent-runs";
import { cn, shortDate } from "@/lib/utils";
import { useToast } from "@/components/kit/Toast";
import { GlassPanel } from "@/components/kit/GlassPanel";
import { Button } from "@/components/kit/Button";
import { Textarea } from "@/components/kit/Field";
import { Modal } from "@/components/kit/Modal";
import { ConnectState } from "@/components/kit/ConnectState";
import { DiffView } from "@/components/self-modify/DiffView";

interface Step {
  name: string;
  status: string;
  conclusion: string | null;
}

interface Props {
  initialRuns: AgentRunDTO[];
  connected: boolean;
  repo: string;
}

const STATUS_META: Record<
  string,
  { label: string; tone: string; icon: typeof Loader2 }
> = {
  queued: { label: "Queued", tone: "text-muted", icon: Loader2 },
  running: { label: "Running", tone: "text-accent-bright", icon: Loader2 },
  succeeded: { label: "Ready to review", tone: "text-amber", icon: CheckCircle2 },
  applied: { label: "Applied", tone: "text-green", icon: Rocket },
  failed: { label: "Failed", tone: "text-danger", icon: XCircle },
};

const LIVE = new Set(["queued", "running"]);

export function SelfModifyPanel({ initialRuns, connected, repo }: Props) {
  const { toast } = useToast();
  const [runs, setRuns] = useState<AgentRunDTO[]>(initialRuns);
  const [openId, setOpenId] = useState<string | null>(
    initialRuns[0]?.id ?? null,
  );
  const [steps, setSteps] = useState<Step[]>([]);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmApply, setConfirmApply] = useState(false);
  const consoleRef = useRef<HTMLDivElement>(null);

  const open = runs.find((r) => r.id === openId) ?? null;

  const replace = useCallback(
    (dto: AgentRunDTO) =>
      setRuns((prev) => prev.map((r) => (r.id === dto.id ? dto : r))),
    [],
  );

  /** Poll the open run while GitHub still has work to report. */
  useEffect(() => {
    if (!openId || !connected) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch(`/api/agent-runs/${openId}`);
        if (!res.ok) return;
        const data = (await res.json()) as { run: AgentRunDTO; steps: Step[] };
        if (cancelled) return;
        replace(data.run);
        setSteps(data.steps ?? []);
      } catch {
        // Transient network failure — the next tick retries. The run's
        // status is never advanced locally to cover for it.
      }
    };

    void tick();
    const current = runs.find((r) => r.id === openId);
    if (!current || !LIVE.has(current.status)) return;
    const timer = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, connected, open?.status, replace]);

  useEffect(() => {
    consoleRef.current?.scrollTo({ top: consoleRef.current.scrollHeight });
  }, [steps]);

  if (!connected) {
    return (
      <ConnectState
        icon={Bot}
        name="Agent harness"
        description={`Describe a change in plain language and a real Claude Code run is dispatched against ${repo} on GitHub Actions. It works on its own branch, opens a pull request, and shows you the diff — nothing reaches production until you press Apply & deploy.`}
        requiredEnv={["GITHUB_TOKEN"]}
        setupUrl="https://github.com/settings/tokens"
        stage={5}
        checklist={[
          "Create a GitHub personal access token with repo + workflow scope.",
          "Set it as GITHUB_TOKEN in the hub's environment (Vercel → Settings → Environment Variables).",
          `Add your Anthropic key as an ANTHROPIC_API_KEY secret on ${repo} (Settings → Secrets → Actions) — it is used by the workflow, never by this app.`,
          "Redeploy the hub so the new environment variable is picked up.",
        ]}
      />
    );
  }

  const dispatch = async () => {
    const text = prompt.trim();
    if (text.length < 10) {
      setError("Describe the change in a sentence or two.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/agent-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not start the run.");
        if (data.run) setRuns((prev) => [data.run, ...prev]);
        return;
      }
      setRuns((prev) => [data as AgentRunDTO, ...prev]);
      setOpenId((data as AgentRunDTO).id);
      setPrompt("");
      toast({
        title: "Run dispatched",
        description: "Claude is working on a branch — this takes a few minutes.",
        tone: "success",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the run.");
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!open) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/agent-runs/${open.id}/apply`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Couldn't apply",
          description: data.error,
          tone: "error",
        });
        return;
      }
      replace(data.run as AgentRunDTO);
      setConfirmApply(false);
      toast({
        title: "Merged to main",
        description: data.note,
        tone: "success",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      {/* ---- Prompt + history ---- */}
      <div className="flex flex-col gap-4">
        <GlassPanel className="flex flex-col gap-3 p-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">Describe a change</h2>
            <p className="mt-1 text-xs text-muted">
              Runs against <span className="num">{repo}</span> on a branch.
              Nothing ships until you approve it.
            </p>
          </div>
          <Textarea
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={error ? true : undefined}
            aria-label="Change request"
            placeholder="e.g. Add a column for lead time to the supplier table"
            className="min-h-28"
          />
          {error ? (
            <p role="alert" className="text-[11px] text-danger">
              {error}
            </p>
          ) : null}
          <Button variant="primary" size="sm" onClick={dispatch} disabled={busy}>
            <Send size={13} aria-hidden />
            {busy ? "Dispatching…" : "Start run"}
          </Button>
        </GlassPanel>

        <GlassPanel className="flex flex-col gap-1 p-2">
          <h2 className="px-2 pt-1.5 pb-1 text-[11px] font-semibold tracking-wider text-muted uppercase">
            Run history
          </h2>
          {runs.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted">
              No runs yet. Your first change request will appear here.
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {runs.map((r) => {
                const meta = STATUS_META[r.status] ?? STATUS_META.queued;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(r.id)}
                      className={cn(
                        "press w-full rounded-card px-2.5 py-2 text-left",
                        openId === r.id
                          ? "bg-[var(--accent-soft)]"
                          : "hover:bg-[var(--panel-soft)]",
                      )}
                    >
                      <p className="truncate text-[13px] font-medium text-ink">
                        {r.prompt}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[11px]">
                        <span className={meta.tone}>{meta.label}</span>
                        <span className="text-muted">·</span>
                        <span className="num text-muted">
                          {shortDate(r.createdAt)}
                        </span>
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </GlassPanel>
      </div>

      {/* ---- The open run ---- */}
      {open ? (
        <div className="flex flex-col gap-4">
          <GlassPanel className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{open.prompt}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  {open.branch ? (
                    <span className="inline-flex items-center gap-1">
                      <GitBranch size={11} aria-hidden />
                      <span className="num">{open.branch}</span>
                    </span>
                  ) : null}
                  {open.runUrl ? (
                    <a
                      href={open.runUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-accent-bright hover:underline"
                    >
                      Workflow <ExternalLink size={10} aria-hidden />
                    </a>
                  ) : null}
                  {open.prUrl ? (
                    <a
                      href={open.prUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-accent-bright hover:underline"
                    >
                      PR #{open.prNumber} <ExternalLink size={10} aria-hidden />
                    </a>
                  ) : null}
                </p>
              </div>
              <StatusChip status={open.status} />
            </div>

            {open.error ? (
              <p className="flex items-start gap-2 rounded-card bg-[var(--red-soft)] px-3 py-2 text-xs text-danger">
                <AlertTriangle size={13} aria-hidden className="mt-0.5 shrink-0" />
                {open.error}
              </p>
            ) : null}

            {open.status === "succeeded" ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setConfirmApply(true)}
                >
                  <Rocket size={13} aria-hidden />
                  Apply &amp; deploy
                </Button>
                <p className="text-[11px] text-muted">
                  Merges to main and builds production. Reviewing is safe —
                  only this button ships.
                </p>
              </div>
            ) : null}

            {open.status === "applied" ? (
              <p className="flex items-center gap-2 text-xs text-green">
                <Rocket size={13} aria-hidden />
                Merged to main
                {open.appliedAt ? ` on ${shortDate(open.appliedAt)}` : ""} — check
                the Vercel deploy before treating it as live.
              </p>
            ) : null}
          </GlassPanel>

          {/* Live console — real workflow steps, nothing synthesised. */}
          <GlassPanel className="flex flex-col gap-2 p-4">
            <h3 className="text-[11px] font-semibold tracking-wider text-muted uppercase">
              Run console
            </h3>
            <div
              ref={consoleRef}
              className="surface-muted max-h-56 overflow-y-auto rounded-card p-3 font-mono text-[11px] leading-relaxed"
            >
              {steps.length === 0 ? (
                <p className="text-muted">
                  {LIVE.has(open.status)
                    ? "Waiting for GitHub to report the first step…"
                    : "No step detail available for this run."}
                </p>
              ) : (
                steps.map((s, i) => (
                  <p key={`${s.name}-${i}`} className="flex items-center gap-2">
                    <span
                      className={cn(
                        "shrink-0",
                        s.conclusion === "failure"
                          ? "text-danger"
                          : s.conclusion === "success"
                            ? "text-green"
                            : "text-muted",
                      )}
                    >
                      {s.conclusion === "failure"
                        ? "✗"
                        : s.conclusion === "success"
                          ? "✓"
                          : "·"}
                    </span>
                    <span className="text-ink">{s.name}</span>
                    <span className="ml-auto text-muted">
                      {s.conclusion ?? s.status}
                    </span>
                  </p>
                ))
              )}
            </div>
          </GlassPanel>

          <DiffView
            diff={open.diff}
            filesChanged={open.filesChanged}
            additions={open.additions}
            deletions={open.deletions}
            status={open.status}
          />
        </div>
      ) : (
        <GlassPanel className="flex items-center justify-center p-12">
          <p className="text-sm text-muted">
            Pick a run from the history, or describe a change to start one.
          </p>
        </GlassPanel>
      )}

      <Modal
        open={confirmApply}
        onClose={() => setConfirmApply(false)}
        title="Apply & deploy this change?"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmApply(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={apply} disabled={busy}>
              {busy ? "Merging…" : "Merge to main"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          This merges{" "}
          <span className="num text-ink">{open?.branch}</span> into main.
          Vercel builds production from main, so this change goes live to
          everyone using the hub. {open?.filesChanged ?? 0} file
          {open?.filesChanged === 1 ? "" : "s"} changed.
        </p>
      </Modal>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.queued;
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "surface-muted inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        meta.tone,
      )}
    >
      <Icon
        size={12}
        aria-hidden
        className={LIVE.has(status) ? "animate-spin" : undefined}
      />
      {meta.label}
    </span>
  );
}
