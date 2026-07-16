"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { type RecordDTO, type StageId } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { useSound } from "@/hooks/useSound";
import { RecordCard } from "@/components/crm/RecordCard";

type Stage = { id: string; label: string; color: string };

interface BoardProps {
  records: RecordDTO[];
  /** Columns to render, in ladder order. */
  stages: readonly Stage[];
  /**
   * Optional extra drop targets rendered as a compact "close" rail at
   * the end of the board (e.g. Authorized dealer / Declined). Records
   * dropped here leave the pipeline.
   */
  closeTargets?: readonly Stage[];
  onMoveStage: (id: string, stage: StageId) => void;
  onSelect: (id: string) => void;
}

function Column({
  stage,
  records,
  onSelect,
}: {
  stage: Stage;
  records: RecordDTO[];
  onSelect: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <section
      aria-label={`${stage.label} — ${records.length} records`}
      className="flex w-64 shrink-0 flex-col"
    >
      <header className="flex items-center gap-2 px-1.5 pb-2.5">
        <span
          aria-hidden
          className="h-2 w-2 rounded-full"
          style={{ background: stage.color }}
        />
        <h3 className="text-[11px] font-semibold tracking-wider text-ink uppercase">
          {stage.label}
        </h3>
        <span className="num text-xs text-muted">{records.length}</span>
      </header>
      <div
        ref={setNodeRef}
        className={cn(
          "surface-muted flex min-h-32 flex-1 flex-col gap-2 overflow-y-auto rounded-card p-2 transition-all duration-200",
          isOver && "border-[var(--accent)] bg-[var(--accent-soft)]",
        )}
      >
        {records.map((r) => (
          <RecordCard key={r.id} record={r} onSelect={onSelect} />
        ))}
        {records.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted">
            Drop records here
          </p>
        ) : null}
      </div>
    </section>
  );
}

function CloseSlot({ stage }: { stage: Stage }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-1.5 rounded-card border border-dashed border-[var(--hairline-strong)] p-3 text-center transition-colors duration-200",
        isOver && "border-solid border-[var(--accent)] bg-[var(--accent-soft)]",
      )}
    >
      <span
        aria-hidden
        className="h-2 w-2 rounded-full"
        style={{ background: stage.color }}
      />
      <p className="text-xs font-medium text-ink">{stage.label}</p>
    </div>
  );
}

/** Kanban view — drag cards across the pipeline for the active record type. */
export function Board({
  records,
  stages,
  closeTargets,
  onMoveStage,
  onSelect,
}: BoardProps) {
  const { sound } = useSound();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const byStage = useMemo(() => {
    const map = new Map<string, RecordDTO[]>(stages.map((s) => [s.id, []]));
    for (const r of records) {
      map.get(r.status)?.push(r);
    }
    return map;
  }, [records, stages]);

  const active = activeId
    ? (records.find((r) => r.id === activeId) ?? null)
    : null;

  const validTargets = useMemo(
    () => new Set([...stages, ...(closeTargets ?? [])].map((s) => s.id)),
    [stages, closeTargets],
  );

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    sound("pop");
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const overId = e.over?.id;
    if (!overId) return;
    const record = records.find((r) => r.id === e.active.id);
    if (!record) return;
    const target = overId as StageId;
    if (validTargets.has(target) && record.status !== target) {
      sound("drop");
      onMoveStage(record.id, target);
    }
  };

  return (
    <DndContext
      // Stable id keeps dnd-kit's SSR-generated aria attributes in sync
      // with the client (avoids the DndDescribedBy hydration mismatch).
      id="crm-board"
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex max-h-[calc(100dvh-22rem)] min-h-[24rem] gap-3 overflow-x-auto pb-2">
        {stages.map((stage) => (
          <Column
            key={stage.id}
            stage={stage}
            records={byStage.get(stage.id) ?? []}
            onSelect={onSelect}
          />
        ))}
        {closeTargets?.length ? (
          <section
            aria-label="Close a supplier"
            className="flex w-44 shrink-0 flex-col"
          >
            <header className="flex items-center gap-2 px-1.5 pb-2.5">
              <h3 className="text-[11px] font-semibold tracking-wider text-muted uppercase">
                Close →
              </h3>
            </header>
            <div className="flex flex-1 flex-col gap-2">
              {closeTargets.map((stage) => (
                <CloseSlot key={stage.id} stage={stage} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
      <DragOverlay dropAnimation={{ duration: 220 }}>
        {active ? (
          <RecordCard record={active} onSelect={() => {}} overlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
