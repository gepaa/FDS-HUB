import type { LucideIcon } from "lucide-react";
import { ExternalLink } from "lucide-react";
import { GlassPanel } from "@/components/kit/GlassPanel";
import { StatusPill } from "@/components/kit/StatusPill";

interface ConnectStateProps {
  icon: LucideIcon;
  name: string;
  description: string;
  requiredEnv: string[];
  setupUrl?: string;
  stage?: number;
  /** Extra setup checklist lines. */
  checklist?: string[];
}

/**
 * The honest "not connected" state. Shown wherever a real credential
 * is missing — the client and UI are built; the human drops the key
 * into the environment and the panel comes alive. Never fake data.
 */
export function ConnectState({
  icon: Icon,
  name,
  description,
  requiredEnv,
  setupUrl,
  stage,
  checklist,
}: ConnectStateProps) {
  return (
    <GlassPanel glow="green" className="p-8">
      <div className="flex flex-col items-start gap-4">
        <div className="flex w-full items-start justify-between gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-card bg-[var(--accent-soft)] text-accent-bright">
            <Icon size={22} aria-hidden />
          </span>
          <StatusPill status="disconnected" label="Not connected" />
        </div>
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-ink">
            {name}
          </h3>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
            {description}
          </p>
        </div>

        {checklist?.length ? (
          <ol className="flex list-inside list-decimal flex-col gap-1.5 text-sm text-muted">
            {checklist.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {requiredEnv.map((v) => (
            <code
              key={v}
              className="glass-soft rounded-md px-2 py-1 font-mono text-[11px] text-muted"
            >
              {v}
            </code>
          ))}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted">
          {typeof stage === "number" ? (
            <span>Wired in Stage {stage}</span>
          ) : null}
          {setupUrl ? (
            <a
              href={setupUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-accent-bright hover:underline"
            >
              Get credentials <ExternalLink size={11} aria-hidden />
            </a>
          ) : null}
        </div>
      </div>
    </GlassPanel>
  );
}
