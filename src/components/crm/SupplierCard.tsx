"use client";

import { useDraggable } from "@dnd-kit/core";
import { Clock, MessageSquareText } from "lucide-react";
import { needsFollowUp, type SupplierDTO } from "@/lib/domain";
import { cn, shortDate } from "@/lib/utils";
import { RankBadge } from "@/components/crm/badges";

interface SupplierCardProps {
  supplier: SupplierDTO;
  onSelect: (id: string) => void;
  /** Static clone rendered inside DragOverlay. */
  overlay?: boolean;
}

/** Kanban card. Drag ≥6px to move stages; click to open the drawer. */
export function SupplierCard({ supplier, onSelect, overlay }: SupplierCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: supplier.id,
    disabled: overlay,
  });

  const due = needsFollowUp(supplier);

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={overlay ? undefined : () => onSelect(supplier.id)}
      onKeyDown={
        overlay
          ? undefined
          : (e) => {
              if (e.key === "Enter") onSelect(supplier.id);
            }
      }
      className={cn(
        "glass press cursor-grab rounded-card p-3 text-left select-none",
        "hover:-translate-y-0.5 hover:border-[var(--hairline-strong)] hover:bg-[var(--panel-strong)]",
        isDragging && "opacity-30",
        overlay &&
          "rotate-2 scale-[1.03] cursor-grabbing shadow-2xl border-[var(--accent)]",
      )}
    >
      <p className="truncate text-sm font-medium text-ink">{supplier.name}</p>
      {supplier.niche ? (
        <p className="mt-0.5 truncate text-xs text-muted">{supplier.niche}</p>
      ) : null}
      <div className="mt-2.5 flex items-center gap-2">
        <RankBadge rank={supplier.rank} />
        <span className="ml-auto inline-flex items-center gap-2">
          {supplier.interactions.length > 0 ? (
            <span
              className="inline-flex items-center gap-1 text-[11px] text-muted"
              title={`${supplier.interactions.length} logged interactions`}
            >
              <MessageSquareText size={11} aria-hidden />
              {supplier.interactions.length}
            </span>
          ) : null}
          {due ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-[var(--amber-soft)] px-1.5 py-0.5 text-[10px] font-medium text-amber"
              title={`Follow-up due ${shortDate(supplier.nextActionDate)}`}
            >
              <Clock size={10} aria-hidden />
              {shortDate(supplier.nextActionDate)}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}
