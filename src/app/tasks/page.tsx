import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { TaskBoard, type TaskDTO } from "@/components/tasks/TaskBoard";

export const metadata: Metadata = { title: "Task Queue" };
export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const tasks = await prisma.hqTask.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const dtos: TaskDTO[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    detail: t.detail,
    status: t.status,
    assignee: t.assignee,
    origin: t.origin,
    result: t.result,
    createdAt: t.createdAt.toISOString(),
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl text-ink">
          Task Queue
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Assign work in plain language. The PM plans it, dispatches workers,
          and reports back — anything outbound still goes through Approvals.
        </p>
      </header>
      <TaskBoard initial={dtos} />
    </div>
  );
}
