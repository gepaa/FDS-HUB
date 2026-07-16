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
import { STAGES, type StageId, type SupplierDTO } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { useSound } from "@/hooks/useSound";
import { SupplierCard } from "@/components/crm/SupplierCard";

interface BoardProps {
  suppliers: SupplierDTO[];
  onMoveStage: (id: string, stage: StageId) => void;
  onSelect: (id: string) => void;
}

function Column({
  stage,
  suppliers,
  onSelect,
}: {
  stage: (typeof STAGES)[number];
  suppliers: SupplierDTO[];
  onSelect: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <section
      aria-label={`${stage.label} — ${suppliers.length} suppliers`}
      className="flex w-72 shrink-0 flex-col"
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
        <span className="num text-xs text-muted">{suppliers.length}</span>
      </header>
      <div
        ref={setNodeRef}
        className={cn(
          "glass-soft flex min-h-32 flex-1 flex-col gap-2 overflow-y-auto rounded-card p-2 transition-all duration-200",
          isOver && "border-[var(--accent)] bg-[var(--accent-soft)]",
        )}
      >
        {suppliers.map((s) => (
          <SupplierCard key={s.id} supplier={s} onSelect={onSelect} />
        ))}
        {suppliers.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted">
            Drop suppliers here
          </p>
        ) : null}
      </div>
    </section>
  );
}

/** Kanban view — drag cards across pipeline stages. */
export function Board({ suppliers, onMoveStage, onSelect }: BoardProps) {
  const { sound } = useSound();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const byStage = useMemo(() => {
    const map = new Map<StageId, SupplierDTO[]>(
      STAGES.map((s) => [s.id, []]),
    );
    for (const s of suppliers) {
      map.get(s.stage)?.push(s);
    }
    return map;
  }, [suppliers]);

  const active = activeId
    ? (suppliers.find((s) => s.id === activeId) ?? null)
    : null;

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    sound("pop");
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const overId = e.over?.id;
    if (!overId) return;
    const supplier = suppliers.find((s) => s.id === e.active.id);
    if (!supplier) return;
    const target = overId as StageId;
    if (STAGES.some((st) => st.id === target) && supplier.stage !== target) {
      sound("drop");
      onMoveStage(supplier.id, target);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex max-h-[calc(100dvh-22rem)] min-h-[24rem] gap-3 overflow-x-auto pb-2">
        {STAGES.map((stage) => (
          <Column
            key={stage.id}
            stage={stage}
            suppliers={byStage.get(stage.id) ?? []}
            onSelect={onSelect}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 220 }}>
        {active ? (
          <SupplierCard supplier={active} onSelect={() => {}} overlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
