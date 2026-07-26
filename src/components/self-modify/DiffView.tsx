"use client";

import { useMemo } from "react";
import { FileDiff } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassPanel } from "@/components/kit/GlassPanel";

interface Props {
  /** Unified diff, exactly as GitHub returned it. Never reconstructed. */
  diff: string | null;
  filesChanged: number | null;
  additions: number | null;
  deletions: number | null;
  status: string;
}

/** Split a unified diff into per-file blocks for readable review. */
function splitByFile(diff: string): { file: string; lines: string[] }[] {
  const out: { file: string; lines: string[] }[] = [];
  let current: { file: string; lines: string[] } | null = null;
  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git")) {
      if (current) out.push(current);
      // "diff --git a/path b/path" — the b/ side is the current name.
      const match = line.match(/ b\/(.+)$/);
      current = { file: match?.[1] ?? line, lines: [] };
      continue;
    }
    if (!current) continue;
    // Skip index/mode noise; keep hunks and content.
    if (/^(index |--- |\+\+\+ |new file|deleted file|similarity|rename )/.test(line))
      continue;
    current.lines.push(line);
  }
  if (current) out.push(current);
  return out;
}

/**
 * The human review surface: the actual diff GitHub reports for the
 * agent's pull request. If there is no diff there is nothing to show —
 * this component never renders a placeholder that could be mistaken for
 * a real change.
 */
export function DiffView({
  diff,
  filesChanged,
  additions,
  deletions,
  status,
}: Props) {
  const files = useMemo(() => (diff ? splitByFile(diff) : []), [diff]);

  if (!diff) {
    return (
      <GlassPanel className="p-4">
        <h3 className="text-[11px] font-semibold tracking-wider text-muted uppercase">
          Proposed diff
        </h3>
        <p className="mt-2 text-sm text-muted">
          {status === "failed"
            ? "This run produced no diff."
            : status === "queued" || status === "running"
              ? "The diff appears here once the run opens its pull request."
              : "No diff available for this run."}
        </p>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-[11px] font-semibold tracking-wider text-muted uppercase">
          Proposed diff
        </h3>
        <span className="flex items-center gap-2 text-xs text-muted">
          <FileDiff size={12} aria-hidden />
          <span className="num">{filesChanged ?? files.length}</span> file
          {(filesChanged ?? files.length) === 1 ? "" : "s"}
          {additions != null ? (
            <span className="num text-green">+{additions}</span>
          ) : null}
          {deletions != null ? (
            <span className="num text-danger">−{deletions}</span>
          ) : null}
        </span>
      </div>

      <div className="flex max-h-[32rem] flex-col gap-3 overflow-y-auto">
        {files.map((f) => (
          <div key={f.file} className="overflow-hidden rounded-card border border-hairline">
            <p className="surface-muted num border-b border-hairline px-3 py-1.5 text-[11px] text-ink">
              {f.file}
            </p>
            <div className="overflow-x-auto">
              <pre className="min-w-full font-mono text-[11px] leading-relaxed">
                {f.lines.map((line, i) => (
                  <code
                    key={i}
                    className={cn(
                      "block px-3 py-0.5 whitespace-pre",
                      line.startsWith("+")
                        ? "bg-[color-mix(in_srgb,var(--green)_12%,transparent)] text-green"
                        : line.startsWith("-")
                          ? "bg-[var(--red-soft)] text-danger"
                          : line.startsWith("@@")
                            ? "bg-[var(--panel-soft)] text-muted"
                            : "text-muted",
                    )}
                  >
                    {line || " "}
                  </code>
                ))}
              </pre>
            </div>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}
