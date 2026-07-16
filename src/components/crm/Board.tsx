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
import {
  stagesFor,
  type RecordDTO,
  type RecordType,
  type StageId,
} from "@/lib/domain";
import { cn } from "@/lib/utils";
import { useSound } from "@/hooks/useSound";
import { RecordCard } from "@/components/crm/RecordCard";

interface BoardProps {
  records: RecordDTO[];
  recordType: RecordType;
  onMoveStage: (id: string, stage: StageId) => void;
  onSelect: (id: string) => void;
}

type Stage = { id: string; label: string; color: string };

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
      <header className="flex items-center gap-2 px-1.5 pb-2">
        <span
          aria-hidden
          className="h-2 w-2 rounded-full"
          style={{ background: stage.color }}
        />
        <h3 className="text-xs font-semibold tracking-wide text-ink uppercase">
          {stage.label}
        </h3>
        <span className="num text-xs text-muted">{records.length}</span>
      </header>
      <div
        ref={setNodeRef}
        className={cn(
          "glass-soft flex min-h-32 flex-1 flex-col gap-2 overflow-y-auto rounded-card p-2 transition-all duration-200",
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

/** Kanban view — drag cards across the pipeline for the active record type. */
export function Board({ records, recordType, onMoveStage, onSelect }: BoardProps) {
  const { sound } = useSound();
  const [activeId, setActiveId] = useState<string | null>(null);
  const stages = stagesFor(recordType);

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
    if (stages.some((st) => st.id === target) && record.status !== target) {
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
      </div>
      <DragOverlay dropAnimation={{ duration: 220 }}>
        {active ? (
          <RecordCard record={active} onSelect={() => {}} overlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
