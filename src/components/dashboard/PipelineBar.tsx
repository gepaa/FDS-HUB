import { SUPPLIER_STAGES as STAGES } from "@/lib/domain";

/**
 * Pipeline distribution strip: one stacked bar, 2px surface gaps
 * between segments, legend with labels + counts (identity is never
 * color-alone). Server-rendered, no client JS.
 */
export function PipelineBar({ counts }: { counts: Record<string, number> }) {
  const total = STAGES.reduce((sum, s) => sum + (counts[s.id] ?? 0), 0);
  if (total === 0) {
    return <p className="text-sm text-muted">No suppliers yet.</p>;
  }
  const visible = STAGES.filter((s) => (counts[s.id] ?? 0) > 0);

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex h-3 w-full gap-0.5"
        role="img"
        aria-label={`Pipeline: ${visible
          .map((s) => `${s.label} ${counts[s.id]}`)
          .join(", ")}`}
      >
        {visible.map((s) => (
          <div
            key={s.id}
            title={`${s.label}: ${counts[s.id]}`}
            className="h-full rounded-[4px]"
            style={{
              background: s.color,
              width: `${((counts[s.id] ?? 0) / total) * 100}%`,
              minWidth: "6px",
            }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {STAGES.map((s) => (
          <li
            key={s.id}
            className="inline-flex items-center gap-1.5 text-xs text-muted"
          >
            <span
              aria-hidden
              className="h-2 w-2 rounded-full"
              style={{
                background: s.color,
                opacity: (counts[s.id] ?? 0) > 0 ? 1 : 0.35,
              }}
            />
            {s.label}
            <span className="num font-medium text-ink">{counts[s.id] ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
