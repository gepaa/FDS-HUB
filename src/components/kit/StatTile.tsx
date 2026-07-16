import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassPanel } from "@/components/kit/GlassPanel";

interface StatTileProps {
  label: string;
  value: string | number;
  /** Small context line under the value, e.g. "12 due today". */
  sub?: string;
  icon?: LucideIcon;
  tone?: "default" | "accent" | "green" | "amber" | "danger";
  className?: string;
}

const toneStyles: Record<string, { fg: string; bg: string }> = {
  default: { fg: "var(--muted)", bg: "var(--panel-soft)" },
  accent: { fg: "var(--accent-bright)", bg: "var(--accent-soft)" },
  green: { fg: "var(--green)", bg: "var(--green-soft)" },
  amber: { fg: "var(--amber)", bg: "var(--amber-soft)" },
  danger: { fg: "var(--red)", bg: "var(--red-soft)" },
};

/**
 * Hero-number tile. The value wears text tokens (never a series
 * color); tone only tints the icon chip.
 */
export function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
  className,
}: StatTileProps) {
  const t = toneStyles[tone];
  return (
    <GlassPanel className={cn("p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium tracking-wider text-muted uppercase">
            {label}
          </p>
          <p className="num mt-2 text-3xl font-semibold tracking-tight text-ink">
            {value}
          </p>
          {sub ? <p className="mt-1 text-xs text-muted">{sub}</p> : null}
        </div>
        {Icon ? (
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control"
            style={{ background: t.bg, color: t.fg }}
          >
            <Icon size={18} strokeWidth={2} aria-hidden />
          </span>
        ) : null}
      </div>
    </GlassPanel>
  );
}
