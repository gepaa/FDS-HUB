import Link from "next/link";
import { SUPPLIER_STAGES as STAGES } from "@/lib/domain";

/**
 * Pipeline distribution strip: one stacked bar, 2px surface gaps
 * between segments, legend with labels + counts (identity is never
 * color-alone). Every stage drills into the CRM filtered to it.
 * Server-rendered, no client JS.
 */
export function PipelineBar({ counts }: { counts: Record<string, number> }) {
  const total = STAGES.reduce((sum, s) => sum + (counts[s.id] ?? 0), 0);
  if (total === 0) {
    return <p className="text-sm text-muted">No suppliers yet.</p>;
  }
  const visible = STAGES.filter((s) => (counts[s.id] ?? 0) > 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-3 w-full gap-0.5">
        {visible.map((s) => (
          <Link
            key={s.id}
            href={`/crm?stage=${s.id}`}
            title={`${s.label}: ${counts[s.id]}`}
            aria-label={`${s.label}: ${counts[s.id]} — open in CRM`}
            className="h-full rounded-[4px] transition-opacity hover:opacity-75"
            style={{
              background: s.color,
              width: `${((counts[s.id] ?? 0) / total) * 100}%`,
              minWidth: "6px",
            }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-1 gap-y-0.5">
        {STAGES.map((s) => {
          const count = counts[s.id] ?? 0;
          const label = (
            <>
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: s.color, opacity: count > 0 ? 1 : 0.35 }}
              />
              {s.label}
              <span className="num font-medium text-ink">{count}</span>
            </>
          );
          return (
            <li key={s.id}>
              {count > 0 ? (
                <Link
                  href={`/crm?stage=${s.id}`}
                  className="press inline-flex items-center gap-1.5 rounded-control px-1.5 py-1 text-xs text-muted hover:bg-[var(--panel-soft)] hover:text-ink"
                >
                  {label}
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-1.5 py-1 text-xs text-muted">
                  {label}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
