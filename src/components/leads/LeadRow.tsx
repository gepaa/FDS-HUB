"use client";

import { ShoppingBag } from "lucide-react";
import { LEAD_STAGES, needsFollowUp, type RecordDTO, type StageId } from "@/lib/domain";
import { cn, shortDate } from "@/lib/utils";

/**
 * One lead as a flat row. Clicking anywhere opens the record; the stage
 * dropdown is the one inline control, because moving a lead along the
 * ladder is the single most common edit and shouldn't cost a drawer.
 */
export function LeadRow({
  record: r,
  onOpen,
  onStageChange,
}: {
  record: RecordDTO;
  onOpen: () => void;
  onStageChange: (next: StageId) => void;
}) {
  const due = needsFollowUp(r);
  const fromShopify = r.source === "Shopify" || Boolean(r.linkedShopifyId);

  return (
    <div
      className={cn(
        "group grid gap-3 border-b border-hairline bg-[var(--panel)] px-4 py-4 transition last:border-b-0",
        "hover:bg-[var(--accent-soft)] sm:grid-cols-2",
        "lg:grid-cols-[minmax(0,2fr)_180px_190px_minmax(0,1fr)_110px] lg:items-center lg:gap-0 lg:py-3",
      )}
    >
      {/* name */}
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 text-left"
        aria-label={`Open ${r.name}`}
      >
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-ink">
            {r.name}
          </span>
          {fromShopify ? (
            <ShoppingBag
              size={11}
              aria-label="From Shopify"
              className="shrink-0 text-muted"
            />
          ) : null}
        </span>
        <span className="block truncate text-xs text-muted">
          {r.company ?? r.recordId ?? "—"}
        </span>
      </button>

      {/* stage — inline editable */}
      <div>
        <span className="mb-1 block text-[10px] font-semibold tracking-wide text-muted uppercase lg:hidden">
          Stage
        </span>
        <select
          value={r.status}
          aria-label={`Stage for ${r.name}`}
          onChange={(e) => onStageChange(e.target.value as StageId)}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-[170px] cursor-pointer rounded-control border border-hairline bg-[var(--panel-soft)] px-2 py-1.5 text-xs text-ink outline-none transition hover:border-[var(--hairline-strong)] focus:border-[var(--accent)]"
        >
          {LEAD_STAGES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* contact */}
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 text-left"
        tabIndex={-1}
      >
        <span className="mb-1 block text-[10px] font-semibold tracking-wide text-muted uppercase lg:hidden">
          Phone / Email
        </span>
        <span className="block truncate font-mono text-xs text-ink">
          {r.phone || "—"}
        </span>
        <span className="block truncate text-xs text-muted">
          {r.email || ""}
        </span>
      </button>

      {/* interest */}
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 text-left"
        tabIndex={-1}
      >
        <span className="mb-1 block text-[10px] font-semibold tracking-wide text-muted uppercase lg:hidden">
          Interested in
        </span>
        <span className="block truncate text-xs text-muted">
          {r.productInterest || "—"}
        </span>
      </button>

      {/* next action */}
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 text-left lg:text-right"
        tabIndex={-1}
      >
        <span className="mb-1 block text-[10px] font-semibold tracking-wide text-muted uppercase lg:hidden">
          Next action
        </span>
        {r.nextActionDate ? (
          <span
            className={cn(
              "block text-xs",
              due ? "font-semibold text-amber" : "text-muted",
            )}
          >
            {due ? "due " : ""}
            {shortDate(r.nextActionDate)}
          </span>
        ) : (
          <span className="block text-xs text-muted">—</span>
        )}
      </button>
    </div>
  );
}
