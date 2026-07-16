"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Play, Plus, ThumbsUp, Trash2, X } from "lucide-react";
import { Button } from "@/components/kit/Button";
import { Input } from "@/components/kit/Field";
import { GlassCard } from "@/components/kit/GlassCard";
import { useToast } from "@/components/kit/Toast";
import { shortDate } from "@/lib/utils";

export interface TaskDTO {
  id: string;
  title: string;
  detail: string | null;
  status: string;
  assignee: string;
  origin: string;
  result: string | null;
  createdAt: string;
  completedAt: string | null;
}

function TaskCard({
  task,
  onPatch,
  onDelete,
}: {
  task: TaskDTO;
  onPatch: (id: string, patch: object) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <GlassCard className="flex flex-col gap-1.5 p-3">
      <div className="flex items-start gap-2">
        <p className="text-sm font-medium text-ink">{task.title}</p>
        <span className="num ml-auto shrink-0 text-[11px] text-muted">
          {shortDate(task.createdAt)}
        </span>
      </div>
      {task.detail ? (
        <p className="text-xs text-muted">{task.detail}</p>
      ) : null}
      {task.result ? (
        <p className="rounded-md bg-[var(--accent-soft)] px-2 py-1 text-xs text-accent-bright">
          {task.result}
        </p>
      ) : null}
      <div className="mt-1 flex items-center gap-1.5">
        <span className="text-[10px] font-semibold tracking-wide text-muted uppercase">
          {task.assignee === "claude" ? "→ Claude" : "→ You"}
          {task.origin === "claude" ? " · suggested by Claude" : ""}
        </span>
        <span className="flex-1" />
        {task.status === "suggested" ? (
          <>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onPatch(task.id, { status: "queued" })}
            >
              <ThumbsUp size={12} aria-hidden />
              Queue it
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPatch(task.id, { status: "cancelled" })}
            >
              <X size={12} aria-hidden />
            </Button>
          </>
        ) : null}
        {task.status === "queued" && task.assignee === "you" ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPatch(task.id, { status: "done" })}
          >
            <Check size={12} aria-hidden />
            Done
          </Button>
        ) : null}
        {task.status === "queued" ? (
          <Button variant="ghost" size="sm" onClick={() => onDelete(task.id)}>
            <Trash2 size={12} aria-hidden />
          </Button>
        ) : null}
      </div>
    </GlassCard>
  );
}

/** The task queue: assign in plain language, watch the PM work it. */
export function TaskBoard({ initial }: { initial: TaskDTO[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const t = title.trim();
    if (!t) return;
    setBusy(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "failed");
      setTitle("");
      toast({ title: "Queued — the PM picks it up on its next run", tone: "success" });
      router.refresh();
    } catch (e) {
      toast({
        title: "Couldn't queue task",
        description: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const patch = async (id: string, body: object) => {
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok)
      toast({ title: "Update failed", tone: "error" });
    router.refresh();
  };

  const remove = async (id: string) => {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    router.refresh();
  };

  const suggested = initial.filter((t) => t.status === "suggested");
  const active = initial.filter(
    (t) => t.status === "queued" || t.status === "running",
  );
  const done = initial
    .filter((t) => t.status === "done" || t.status === "cancelled")
    .slice(0, 12);

  return (
    <div className="flex flex-col gap-5">
      <div className="surface flex items-center gap-2 rounded-card p-3">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void add();
          }}
          placeholder='Tell the PM what to do — e.g. "Qualify the top 10 Gold suppliers and draft first contact"'
          aria-label="New task"
        />
        <Button variant="primary" size="sm" disabled={busy} onClick={add}>
          <Plus size={14} aria-hidden />
          Assign
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-2.5">
          <h2 className="flex items-center gap-2 text-xs font-semibold tracking-widest text-muted uppercase">
            <Play size={12} aria-hidden /> Queued & running (
            {active.length})
          </h2>
          {active.map((t) => (
            <TaskCard key={t.id} task={t} onPatch={patch} onDelete={remove} />
          ))}
          {active.length === 0 ? (
            <p className="text-xs text-muted">
              Nothing queued. Assign work above — it runs on the PM&apos;s next
              cycle.
            </p>
          ) : null}
        </section>

        <section className="flex flex-col gap-2.5">
          <h2 className="text-xs font-semibold tracking-widest text-muted uppercase">
            Suggested by Claude ({suggested.length})
          </h2>
          {suggested.map((t) => (
            <TaskCard key={t.id} task={t} onPatch={patch} onDelete={remove} />
          ))}
          {suggested.length === 0 ? (
            <p className="text-xs text-muted">
              When the PM spots work worth doing, it proposes it here — you
              approve it into the queue.
            </p>
          ) : null}

          {done.length > 0 ? (
            <>
              <h2 className="mt-3 text-xs font-semibold tracking-widest text-muted uppercase">
                Recently finished
              </h2>
              {done.map((t) => (
                <TaskCard key={t.id} task={t} onPatch={patch} onDelete={remove} />
              ))}
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
