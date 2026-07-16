import { Medal } from "lucide-react";
import { RANK_COLORS, STAGE_MAP, type StageId } from "@/lib/domain";

/** Stage pill: colored dot + label, tinted surface. Never color-alone. */
export function StageBadge({ stage }: { stage: StageId }) {
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
