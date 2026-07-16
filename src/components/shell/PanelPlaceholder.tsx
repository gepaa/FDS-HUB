import type { LucideIcon } from "lucide-react";
import { GlassPanel } from "@/components/kit/GlassPanel";
import { StatusPill } from "@/components/kit/StatusPill";

interface PanelPlaceholderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  stage: number;
  /** What lands here when the stage ships. */
  features: string[];
  /** What the human must supply first (credentials, accounts). */
  humanSupplies?: string[];
  children?: React.ReactNode;
}

/**
 * Honest placeholder for panels that arrive in later stages. States
 * exactly what will exist and what credentials the human must
 * supply — never fabricated content.
 */
export function PanelPlaceholder({
  icon: Icon,
  title,
  description,
  stage,
  features,
  humanSupplies,
  children,
}: PanelPlaceholderProps) {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-card bg-[var(--accent-soft)] text-accent-bright">
          <Icon size={20} aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {title}
          </h1>
          <p className="text-sm text-muted">{description}</p>
        </div>
        <StatusPill
          status="planned"
          label={`Arrives in Stage ${stage}`}
          className="ml-auto"
        />
      </header>

      <GlassPanel glow="green" className="p-6">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
          What ships in Stage {stage}
        </h2>
        <ul className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-ink">
              <span
                aria-hidden
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent-bright)]"
              />
              {f}
            </li>
          ))}
        </ul>

        {humanSupplies?.length ? (
          <>
            <h2 className="mt-6 text-sm font-semibold tracking-wide text-muted uppercase">
              You supply first
            </h2>
            <ul className="mt-3 flex flex-col gap-2">
              {humanSupplies.map((h) => (
                <li key={h} className="flex items-start gap-2 text-sm text-muted">
                  <span
                    aria-hidden
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--amber)]"
                  />
                  {h}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </GlassPanel>

      {children}
    </div>
  );
}
