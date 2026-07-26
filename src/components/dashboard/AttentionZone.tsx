"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Check, ChevronDown } from "lucide-react";
import type { AttentionItem, AttentionSeverity } from "@/lib/attention";
import { GlassPanel } from "@/components/kit/GlassPanel";
import { cn } from "@/lib/utils";

/** How many items show before the zone would start needing a scroll. */
const VISIBLE = 6;

const severityStyle: Record<
  AttentionSeverity,
  { dot: string; chip: string; chipFg: string }
> = {
  critical: {
    dot: "var(--red)",
    chip: "var(--red-soft)",
    chipFg: "var(--red)",
  },
  warning: {
    dot: "var(--amber)",
    chip: "var(--amber-soft)",
    chipFg: "var(--amber)",
  },
};

/**
 * Tier 1 of the dashboard: the only zone that earns space above the
 * fold. Every row is a real overdue/pending record and links straight
 * to the thing that clears it.
 */
export function AttentionZone({ items }: { items: AttentionItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const criticalCount = items.filter((i) => i.severity === "critical").length;
  const shown = expanded ? items : items.slice(0, VISIBLE);
  const overflow = items.length - VISIBLE;

  if (items.length === 0) {
    return (
      <GlassPanel className="fade-rise border-l-2 border-[var(--green)] px-5 py-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control"
            style={{ background: "var(--green-soft)", color: "var(--green)" }}
          >
            <Check size={16} strokeWidth={2.5} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">All clear</p>
            <p className="text-xs text-muted">
              Nothing overdue, nothing waiting on your approval.
            </p>
          </div>
        </div>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel
      className={cn(
        "fade-rise border-l-2",
        criticalCount > 0
          ? "border-[var(--red)]"
          : "border-[var(--amber)]",
      )}
    >
      <div className="p-5">
        <div className="mb-3 flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control"
            style={{
              background:
                criticalCount > 0 ? "var(--red-soft)" : "var(--amber-soft)",
              color: criticalCount > 0 ? "var(--red)" : "var(--amber)",
            }}
          >
            <AlertTriangle size={16} aria-hidden />
          </span>
          <h2 className="text-sm font-semibold tracking-tight text-ink">
            Needs you now
          </h2>
          <span className="num ml-auto text-xs font-medium text-muted">
            {items.length} {items.length === 1 ? "item" : "items"}
            {criticalCount > 0 ? ` · ${criticalCount} critical` : ""}
          </span>
        </div>

        <ul className="flex flex-col gap-1">
          {shown.map((item) => {
            const s = severityStyle[item.severity];
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="press group flex items-center gap-3 rounded-control px-2 py-2 hover:bg-[var(--panel-soft)]"
                >
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: s.dot }}
                  />
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase"
                    style={{ background: s.chip, color: s.chipFg }}
                  >
                    {item.kind}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      {item.title}
                    </span>
                    {item.detail ? (
                      <span className="block truncate text-xs text-muted">
                        {item.detail}
                      </span>
                    ) : null}
                  </span>
                  {item.meta ? (
                    <span className="num shrink-0 text-xs font-medium text-muted">
                      {item.meta}
                    </span>
                  ) : null}
                  <ArrowRight
                    size={14}
                    aria-hidden
                    className="shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </Link>
              </li>
            );
          })}
        </ul>

        {overflow > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="press mt-2 inline-flex items-center gap-1 rounded-control px-2 py-1 text-xs font-medium text-accent-bright hover:bg-[var(--panel-soft)]"
          >
            {expanded ? "Show less" : `Show ${overflow} more`}
            <ChevronDown
              size={12}
              aria-hidden
              className={cn("transition-transform", expanded && "rotate-180")}
            />
          </button>
        ) : null}
      </div>
    </GlassPanel>
  );
}
