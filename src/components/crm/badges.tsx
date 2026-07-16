import { Bot, Medal, User } from "lucide-react";
import {
  PRIORITIES,
  RANK_COLORS,
  STAGE_MAP,
  type Owner,
  type Priority,
} from "@/lib/domain";

/** Stage pill: colored dot + label, tinted surface. Never color-alone. */
export function StageBadge({ stage }: { stage: string }) {
  const s = STAGE_MAP[stage];
  if (!s) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-ink"
      style={{ background: `${s.color}1c`, borderColor: `${s.color}45` }}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: s.color }}
      />
      {s.label}
    </span>
  );
}

/** Rank marker: medal tinted by rank + text label. */
export function RankBadge({ rank }: { rank: string | null }) {
  if (!rank || !RANK_COLORS[rank]) {
    return <span className="text-xs text-muted">Unranked</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-ink">
      <Medal size={12} aria-hidden style={{ color: RANK_COLORS[rank] }} />
      {rank}
    </span>
  );
}

/** Priority pill (hot/warm/cold) — label + tint, never color-alone. */
export function PriorityBadge({ priority }: { priority: Priority | null }) {
  if (!priority) return null;
  const p = PRIORITIES.find((x) => x.id === priority);
  if (!p) return null;
  return (
    <span
      className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{ background: `${p.color}1f`, color: p.color }}
    >
      {p.label}
    </span>
  );
}

/** Owner chip: who owns the next move — Claude, you, or unassigned. */
export function OwnerBadge({ owner }: { owner: Owner }) {
  if (owner === "unassigned") return null;
  const isClaude = owner === "claude";
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
        (isClaude
          ? "bg-[#7c6be81f] text-[#7C6BE8]"
          : "bg-[var(--accent-soft)] text-accent-bright")
      }
    >
      {isClaude ? (
        <Bot size={10} aria-hidden />
      ) : (
        <User size={10} aria-hidden />
      )}
      {isClaude ? "Claude" : "You"}
    </span>
  );
}
