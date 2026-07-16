"use client";

import { useDraggable } from "@dnd-kit/core";
import { Clock, MessageSquareText } from "lucide-react";
import { needsFollowUp, type RecordDTO } from "@/lib/domain";
import { cn, shortDate } from "@/lib/utils";
import { OwnerBadge, PriorityBadge, RankBadge } from "@/components/crm/badges";

interface RecordCardProps {
  record: RecordDTO;
  onSelect: (id: string) => void;
  /** Static clone rendered inside DragOverlay. */
  overlay?: boolean;
}

/** Kanban card. Drag ≥6px to move stages; click to open the drawer. */
export function RecordCard({ record, onSelect, overlay }: RecordCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: record.id,
    disabled: overlay,
  });

  const due = needsFollowUp(record);
  const sub =
    record.type === "lead"
      ? (record.productInterest ?? record.company)
      : record.niche;

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={overlay ? undefined : () => onSelect(record.id)}
      onKeyDown={
        overlay
          ? undefined
          : (e) => {
              if (e.key === "Enter") onSelect(record.id);
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
      <p className="truncate text-sm font-medium text-ink">{record.name}</p>
      {sub ? <p className="mt-0.5 truncate text-xs text-muted">{sub}</p> : null}
      {record.nextAction ? (
        <p className="mt-1.5 truncate rounded-md bg-[var(--accent-soft)] px-1.5 py-1 text-[11px] text-accent-bright">
          → {record.nextAction}
        </p>
      ) : null}
      <div className="mt-2.5 flex items-center gap-1.5">
        {record.type === "supplier" ? (
          <RankBadge rank={record.rank} />
        ) : null}
        <PriorityBadge priority={record.priority} />
        <OwnerBadge owner={record.owner} />
        <span className="ml-auto inline-flex items-center gap-2">
          {record.interactions.length > 0 ? (
            <span
              className="inline-flex items-center gap-1 text-[11px] text-muted"
              title={`${record.interactions.length} logged interactions`}
            >
              <MessageSquareText size={11} aria-hidden />
              {record.interactions.length}
            </span>
          ) : null}
          {due ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-[var(--amber-soft)] px-1.5 py-0.5 text-[10px] font-medium text-amber"
              title={`Follow-up due ${shortDate(record.nextActionDate)}`}
            >
              <Clock size={10} aria-hidden />
              {shortDate(record.nextActionDate)}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}
