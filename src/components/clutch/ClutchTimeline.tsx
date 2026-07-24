"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  Check,
  Flag,
  GitCommitVertical,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/kit/Button";
import { Input, Textarea } from "@/components/kit/Field";
import { useToast } from "@/components/kit/Toast";
import { inputDate } from "@/lib/utils";

export interface ClutchDTO {
  id: string;
  title: string;
  notes: string | null;
  date: string; // ISO
  createdAt: string;
}

/** The synthetic origin marker: the timeline always opens three months
 *  back at "Started E10", regardless of the first real clutch. */
const ORIGIN_TITLE = "Started E10";

function threeMonthsAgo(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  d.setHours(0, 0, 0, 0);
  return d;
}

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

type TimelineNode =
  | { kind: "origin"; date: string }
  | { kind: "clutch"; clutch: ClutchDTO }
  | { kind: "today"; date: string };

/** A single dot + connector on the spine. `tone` colours the node. */
function Node({
  icon,
  tone = "accent",
  children,
  last = false,
}: {
  icon: React.ReactNode;
  tone?: "accent" | "muted" | "amber";
  children: React.ReactNode;
  last?: boolean;
}) {
  const dotBg =
    tone === "muted"
      ? "var(--panel-strong)"
      : tone === "amber"
        ? "var(--amber-soft)"
        : "var(--accent-soft)";
  const dotColor =
    tone === "muted"
      ? "var(--muted)"
      : tone === "amber"
        ? "var(--amber)"
        : "var(--accent-bright)";
  return (
    <div className="relative flex gap-4">
      {/* spine column */}
      <div className="relative flex w-8 shrink-0 flex-col items-center">
        <span
          className="relative z-10 mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border border-hairline"
          style={{ background: dotBg, color: dotColor }}
        >
          {icon}
        </span>
        {!last ? (
          <span
            aria-hidden
            className="absolute top-8 bottom-[-1.5rem] w-px"
            style={{ background: "var(--hairline-strong)" }}
          />
        ) : null}
      </div>
      {/* content */}
      <div className="min-w-0 flex-1 pb-6">{children}</div>
    </div>
  );
}

function ClutchNode({
  clutch,
  onPatch,
  onDelete,
}: {
  clutch: ClutchDTO;
  onPatch: (id: string, patch: object) => Promise<boolean>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(clutch.title);
  const [date, setDate] = useState(inputDate(clutch.date));
  const [notes, setNotes] = useState(clutch.notes ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const t = title.trim();
    if (!t) return;
    setBusy(true);
    const ok = await onPatch(clutch.id, {
      title: t,
      date,
      notes: notes.trim() || null,
    });
    setBusy(false);
    if (ok) setEditing(false);
  };

  const cancel = () => {
    setTitle(clutch.title);
    setDate(inputDate(clutch.date));
    setNotes(clutch.notes ?? "");
    setEditing(false);
  };

  return (
    <Node icon={<GitCommitVertical size={15} aria-hidden />}>
      <div className="surface group rounded-card p-4">
        <div className="flex items-center gap-2">
          <span className="num text-[11px] font-medium tracking-wide text-accent-bright uppercase">
            {dayLabel(clutch.date)}
          </span>
          {!editing ? (
            <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <Button
                variant="subtle"
                size="sm"
                aria-label="Edit clutch"
                onClick={() => setEditing(true)}
              >
                <Pencil size={12} aria-hidden />
              </Button>
              <Button
                variant="subtle"
                size="sm"
                aria-label="Delete clutch"
                onClick={() => onDelete(clutch.id)}
              >
                <Trash2 size={12} aria-hidden />
              </Button>
            </div>
          ) : null}
        </div>

        {!editing ? (
          <>
            <p className="mt-1 text-sm font-semibold text-ink">
              {clutch.title}
            </p>
            {clutch.notes ? (
              <p className="mt-1.5 text-xs whitespace-pre-wrap text-muted">
                {clutch.notes}
              </p>
            ) : null}
          </>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What did you knock down?"
              aria-label="Clutch title"
            />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Clutch date"
              className="w-full rounded-control border border-hairline bg-[var(--panel-soft)] px-3 py-2 text-sm text-ink focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)] focus:outline-none"
            />
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              aria-label="Clutch notes"
            />
            <div className="flex items-center gap-1.5">
              <Button
                variant="primary"
                size="sm"
                disabled={busy}
                onClick={save}
              >
                <Check size={12} aria-hidden />
                Save
              </Button>
              <Button variant="ghost" size="sm" onClick={cancel}>
                <X size={12} aria-hidden />
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </Node>
  );
}

/** The Clutch Timeline: origin → chronological clutches → today. */
export function ClutchTimeline({ initial }: { initial: ClutchDTO[] }) {
  const router = useRouter();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(inputDate(new Date()));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const originIso = useMemo(() => threeMonthsAgo().toISOString(), []);
  const todayIso = useMemo(() => new Date().toISOString(), []);

  // Origin is fixed at three months back; clutches already arrive
  // chronologically (date asc) from the server.
  const nodes: TimelineNode[] = useMemo(() => {
    const list: TimelineNode[] = [{ kind: "origin", date: originIso }];
    for (const c of initial) list.push({ kind: "clutch", clutch: c });
    list.push({ kind: "today", date: todayIso });
    return list;
  }, [initial, originIso, todayIso]);

  const add = async () => {
    const t = title.trim();
    if (!t) {
      toast({ title: "Give the clutch a title", tone: "info" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/clutches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t,
          date,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "failed");
      setTitle("");
      setNotes("");
      setDate(inputDate(new Date()));
      toast({ title: "Clutch logged onto the timeline", tone: "success" });
      router.refresh();
    } catch (e) {
      toast({
        title: "Couldn't log the clutch",
        description: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const patch = async (id: string, body: object): Promise<boolean> => {
    const res = await fetch(`/api/clutches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      toast({ title: "Update failed", tone: "error" });
      return false;
    }
    router.refresh();
    return true;
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/clutches/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast({ title: "Delete failed", tone: "error" });
      return;
    }
    toast({ title: "Clutch removed", tone: "info" });
    router.refresh();
  };

  const total = initial.length;

  // Track month boundaries so we can drop a month header the first time
  // a new month appears while walking the nodes.
  let lastMonth = "";

  return (
    <div className="flex flex-col gap-6">
      {/* Add a clutch */}
      <div className="surface flex flex-col gap-3 rounded-card p-4">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-widest text-muted uppercase">
          <Plus size={13} aria-hidden /> Log a clutch
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void add();
            }}
            placeholder='What did you knock down? — e.g. "Imported 60 Top Dog products"'
            aria-label="Clutch title"
          />
          <input
            type="date"
            value={date}
            max={inputDate(new Date())}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Clutch date"
            className="rounded-control border border-hairline bg-[var(--panel-soft)] px-3 py-2 text-sm text-ink focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)] focus:outline-none"
          />
        </div>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional) — what was in this batch, links, anything worth remembering"
          aria-label="Clutch notes"
        />
        <div className="flex items-center gap-3">
          <Button variant="primary" size="sm" disabled={busy} onClick={add}>
            <Plus size={14} aria-hidden />
            Add to timeline
          </Button>
          <span className="text-xs text-muted">
            {total === 0
              ? "No clutches yet — the timeline starts at the origin below."
              : `${total} clutch${total === 1 ? "" : "es"} on the line.`}
          </span>
        </div>
      </div>

      {/* The timeline */}
      <div className="surface rounded-panel p-5 sm:p-6">
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {nodes.map((node, i) => {
              const last = i === nodes.length - 1;

              if (node.kind === "origin") {
                lastMonth = monthKey(node.date);
                return (
                  <div key="origin">
                    <MonthHeader label={monthLabel(node.date)} />
                    <Node
                      icon={<Sparkles size={15} aria-hidden />}
                      tone="amber"
                    >
                      <div className="surface-muted rounded-card p-4">
                        <span className="num text-[11px] font-medium tracking-wide text-amber uppercase">
                          {dayLabel(node.date)} · Origin
                        </span>
                        <p className="mt-1 text-sm font-semibold text-ink">
                          {ORIGIN_TITLE}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          Where the timeline begins — three months back. Every
                          clutch since lands above the{" "}
                          <span className="text-ink">Today</span> cap.
                        </p>
                      </div>
                    </Node>
                  </div>
                );
              }

              if (node.kind === "today") {
                return (
                  <Node
                    key="today"
                    icon={<Flag size={15} aria-hidden />}
                    tone="muted"
                    last={last}
                  >
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="num text-[11px] font-medium tracking-wide text-muted uppercase">
                        {dayLabel(node.date)}
                      </span>
                      <span className="rounded-full bg-[var(--panel-strong)] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-ink uppercase">
                        Today
                      </span>
                    </div>
                  </Node>
                );
              }

              // clutch node — emit a month header when the month changes
              const mk = monthKey(node.clutch.date);
              const header =
                mk !== lastMonth ? monthLabel(node.clutch.date) : null;
              if (header) lastMonth = mk;

              return (
                <motion.div
                  key={node.clutch.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  {header ? <MonthHeader label={header} /> : null}
                  <ClutchNode
                    clutch={node.clutch}
                    onPatch={patch}
                    onDelete={remove}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function MonthHeader({ label }: { label: string }) {
  return (
    <div className="mb-3 flex items-center gap-2 pl-1">
      <CalendarDays size={13} className="text-muted" aria-hidden />
      <span className="text-xs font-semibold tracking-widest text-muted uppercase">
        {label}
      </span>
      <span className="h-px flex-1 bg-[var(--hairline)]" aria-hidden />
    </div>
  );
}
