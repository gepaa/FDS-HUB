"use client";

import { useState } from "react";
import { ChevronDown, Moon } from "lucide-react";
import { GlassPanel } from "@/components/kit/GlassPanel";
import { cn } from "@/lib/utils";

interface BriefCardProps {
  title: string;
  date: string;
  body: string;
}

/**
 * The morning brief, collapsed. The agent writes several hundred words
 * a night; the dashboard shows the lede and gets out of the way. The
 * full text is one click away and never leaves the page.
 */
export function BriefCard({ title, date, body }: BriefCardProps) {
  const [open, setOpen] = useState(false);

  // The PM writes "HEADLINE: ..." first; fall back to the first
  // non-empty line for briefs that don't follow the template.
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  const headlineLine = lines.find((l) => /^headline:/i.test(l)) ?? lines[0] ?? "";
  const lede = headlineLine.replace(/^headline:\s*/i, "");
  const hasMore = lines.length > 1 || lede.length < body.trim().length;

  return (
    <GlassPanel className="border-l-2 border-[var(--accent)]">
      <div className="px-5 py-4">
        <div className="flex items-center gap-2">
          <p className="flex min-w-0 items-center gap-2 text-xs font-semibold tracking-widest text-accent-bright uppercase">
            <Moon size={13} className="shrink-0" aria-hidden />
            <span className="truncate">
              {title} · {date}
            </span>
          </p>
          {hasMore ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="press ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted hover:bg-[var(--panel-soft)] hover:text-ink"
            >
              {open ? "Collapse" : "Read full brief"}
              <ChevronDown
                size={12}
                aria-hidden
                className={cn("transition-transform", open && "rotate-180")}
              />
            </button>
          ) : null}
        </div>

        {open ? (
          <p className="fade-rise mt-2 text-sm whitespace-pre-wrap text-ink">
            {body}
          </p>
        ) : (
          <p className="mt-2 line-clamp-2 text-sm text-ink">{lede}</p>
        )}
      </div>
    </GlassPanel>
  );
}
