import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { TodoBoard } from "@/components/tasks/TodoBoard";
import type { SeatDTO, TodoDTO } from "@/lib/tasks/board";
import { autoSort } from "@/lib/tasks/sort";

export const metadata: Metadata = { title: "To-Do Board" };
export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const [tasks, seats] = await Promise.all([
    prisma.hqTask.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        attachments: {
          orderBy: { createdAt: "asc" },
          // The file bytes stay in the database — the card links to the
          // download route. Selecting `data` here would push every
          // attached document through the server render.
          select: {
            id: true,
            kind: true,
            label: true,
            url: true,
            mimeType: true,
            sizeBytes: true,
            createdAt: true,
          },
        },
        record: { select: { name: true } },
      },
    }),
    prisma.teamMember.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const dtos: TodoDTO[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    detail: t.detail,
    status: t.status,
    assignee: t.assignee,
    assigneeId: t.assigneeId,
    origin: t.origin,
    result: t.result,
    priority: t.priority,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    pinned: t.pinned,
    aiBrief: t.aiBrief,
    aiBriefAt: t.aiBriefAt ? t.aiBriefAt.toISOString() : null,
    source: t.source,
    aiGenerated: t.aiGenerated,
    humanConfirmed: t.humanConfirmed,
    recordId: t.recordId,
    recordName: t.record?.name ?? null,
    createdAt: t.createdAt.toISOString(),
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    attachments: t.attachments.map((a) => ({
      id: a.id,
      kind: a.kind,
      label: a.label,
      url: a.url,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      createdAt: a.createdAt.toISOString(),
    })),
  }));

  const seatDtos: SeatDTO[] = seats.map((s) => ({
    id: s.id,
    name: s.name,
    initials: s.initials,
    color: s.color,
    sortOrder: s.sortOrder,
    active: s.active,
  }));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl text-ink">To-Do Board</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Note anything down in one line. Assign it to someone, hang the docs
          and links off it, and let Claude explain what it actually involves.
          The list sorts itself — overdue and hot rise to the top.
        </p>
      </header>
      <TodoBoard initial={autoSort(dtos)} seats={seatDtos} />
    </div>
  );
}
