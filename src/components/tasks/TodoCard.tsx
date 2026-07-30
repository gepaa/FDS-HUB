"use client";

import { useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Link2,
  Loader2,
  Paperclip,
  Pin,
  Play,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/kit/Button";
import { Input, Select, Textarea } from "@/components/kit/Field";
import { GlassCard } from "@/components/kit/GlassCard";
import { Menu, MenuItem } from "@/components/kit/Menu";
import { PriorityBadge } from "@/components/crm/badges";
import type { Priority } from "@/lib/domain";
import { humanSize } from "@/lib/tasks/attachments";
import {
  CLAUDE,
  UNASSIGNED,
  ownerKey,
  type SeatDTO,
  type TodoDTO,
} from "@/lib/tasks/board";
import { reasonFor, urgencyOf, type Urgency } from "@/lib/tasks/sort";
import { cn, inputDate, shortDate } from "@/lib/utils";

const URGENCY_STYLES: Record<Urgency, string> = {
  pinned: "text-accent-bright",
  overdue: "text-danger",
  today: "text-accent-bright",
  soon: "text-ink",
  normal: "text-muted",
};

/** Seat initials in the seat's colour — the at-a-glance "whose is this". */
export function SeatAvatar({
  seat,
  owner,
  size = 24,
}: {
  seat?: SeatDTO;
  owner: string;
  size?: number;
}) {
  const label =
    seat?.name ?? (owner === CLAUDE ? "Claude" : "Nobody yet");
  const initials = seat?.initials ?? (owner === CLAUDE ? "AI" : "–");
  const color = seat?.color ?? (owner === CLAUDE ? "#7C6BE8" : "#8a8f98");
  return (
    <span
      title={label}
      aria-label={`Owner: ${label}`}
      className="inline-flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
      style={{
        width: size,
        height: size,
        background: `${color}24`,
        color,
        border: `1px solid ${color}55`,
      }}
    >
      {initials}
    </span>
  );
}

interface Props {
  task: TodoDTO;
  seats: SeatDTO[];
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRun: (id: string) => Promise<void>;
  onExplain: (id: string) => Promise<{ priority: string | null; dueDate: string | null } | null>;
  onAttach: (id: string, payload: FormData | { url: string }) => Promise<void>;
  onDetach: (taskId: string, attachmentId: string) => Promise<void>;
  running: boolean;
}

export function TodoCard({
  task,
  seats,
  onPatch,
  onDelete,
  onRun,
  onExplain,
  onAttach,
  onDetach,
  running,
}: Props) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(task.detail ?? "");
  const [linkDraft, setLinkDraft] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [suggestion, setSuggestion] = useState<{
    priority: string | null;
    dueDate: string | null;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const owner = ownerKey(task);
  const seat = seats.find((s) => s.id === task.assigneeId);
  const urgency = urgencyOf(task);
  const finished = task.status === "done" || task.status === "cancelled";

  const explain = async () => {
    setExplaining(true);
    try {
      setSuggestion(await onExplain(task.id));
    } finally {
      setExplaining(false);
    }
  };

  const applySuggestion = async () => {
    if (!suggestion) return;
    await onPatch(task.id, {
      ...(suggestion.priority ? { priority: suggestion.priority } : {}),
      ...(suggestion.dueDate ? { dueDate: suggestion.dueDate } : {}),
    });
    setSuggestion(null);
  };

  return (
    <GlassCard className={cn("flex flex-col gap-2 p-3", finished && "opacity-60")}>
      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-label={task.pinned ? "Unpin from the top" : "Pin to the top"}
          aria-pressed={task.pinned}
          onClick={() => onPatch(task.id, { pinned: !task.pinned })}
          className={cn(
            "press mt-0.5 rounded-control p-1",
            task.pinned
              ? "text-accent-bright"
              : "text-muted opacity-0 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100",
            "opacity-100",
          )}
        >
          <Pin size={13} fill={task.pinned ? "currentColor" : "none"} aria-hidden />
        </button>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="min-w-0 flex-1 text-left"
        >
          <p
            className={cn(
              "text-sm font-medium text-ink",
              finished && "line-through",
            )}
          >
            {task.title}
          </p>
          <p className={cn("mt-0.5 text-[11px]", URGENCY_STYLES[urgency])}>
            {finished
              ? task.status === "done"
                ? `Done ${shortDate(task.completedAt)}`
                : "Cancelled"
              : reasonFor(task)}
            {task.attachments.length > 0 ? (
              <span className="text-muted">
                {" · "}
                {task.attachments.length} attached
              </span>
            ) : null}
            {task.aiBrief ? <span className="text-muted"> · explained</span> : null}
          </p>
        </button>

        <div className="flex shrink-0 items-center gap-1.5">
          <PriorityBadge priority={task.priority as Priority | null} />
          {task.dueDate ? (
            <span className="num text-[11px] text-muted">
              {shortDate(task.dueDate)}
            </span>
          ) : null}

          <Menu
            label={`Assign "${task.title}"`}
            trigger={<SeatAvatar seat={seat} owner={owner} />}
            triggerClassName="h-7 w-7"
          >
            {(close) => (
              <>
                {seats
                  .filter((s) => s.active || s.id === task.assigneeId)
                  .map((s) => (
                    <MenuItem
                      key={s.id}
                      onSelect={() => {
                        void onPatch(task.id, { owner: s.id });
                        close();
                      }}
                    >
                      {s.name}
                      {owner === s.id ? " ✓" : ""}
                    </MenuItem>
                  ))}
                <MenuItem
                  onSelect={() => {
                    void onPatch(task.id, { owner: CLAUDE });
                    close();
                  }}
                >
                  Claude (the agent){owner === CLAUDE ? " ✓" : ""}
                </MenuItem>
                <MenuItem
                  onSelect={() => {
                    void onPatch(task.id, { owner: UNASSIGNED });
                    close();
                  }}
                >
                  Nobody yet{owner === UNASSIGNED ? " ✓" : ""}
                </MenuItem>
              </>
            )}
          </Menu>

          <button
            type="button"
            aria-label={open ? "Collapse task" : "Expand task"}
            onClick={() => setOpen((v) => !v)}
            className="press rounded-control p-1 text-muted hover:text-ink"
          >
            <ChevronDown
              size={14}
              aria-hidden
              className={cn("transition-transform", open && "rotate-180")}
            />
          </button>
        </div>
      </div>

      {/* Collapsed: the note, one line. */}
      {!open && task.detail ? (
        <p className="line-clamp-2 pl-7 text-xs text-muted">{task.detail}</p>
      ) : null}

      {open ? (
        <div className="flex flex-col gap-3 pl-7">
          <Textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            onBlur={() => {
              if (detail !== (task.detail ?? "")) {
                void onPatch(task.id, { detail: detail || null });
              }
            }}
            placeholder="Notes — anything you'd want to know when you pick this up."
            aria-label="Task notes"
            className="min-h-16 text-xs"
          />

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[11px] text-muted">
              Due
              <Input
                type="date"
                value={inputDate(task.dueDate)}
                onChange={(e) =>
                  onPatch(task.id, {
                    dueDate: e.target.value
                      ? new Date(`${e.target.value}T09:00:00`).toISOString()
                      : null,
                  })
                }
                className="ml-1.5 inline-block w-auto py-1 text-xs"
              />
            </label>
            <label className="text-[11px] text-muted">
              Priority
              <Select
                value={task.priority ?? ""}
                onChange={(e) =>
                  onPatch(task.id, { priority: e.target.value || null })
                }
                className="ml-1.5 inline-block w-auto py-1 text-xs"
              >
                <option value="">None</option>
                <option value="hot">Hot</option>
                <option value="warm">Warm</option>
                <option value="cold">Cold</option>
              </Select>
            </label>
          </div>

          {/* ---- AI brief ---- */}
          {task.aiBrief ? (
            <div className="rounded-card border border-hairline bg-[var(--panel-soft)] p-2.5">
              <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold tracking-widest text-muted uppercase">
                <Sparkles size={11} aria-hidden /> What this means
              </p>
              <p className="text-xs whitespace-pre-wrap text-ink">{task.aiBrief}</p>
            </div>
          ) : null}

          {suggestion && (suggestion.priority || suggestion.dueDate) ? (
            <div className="flex flex-wrap items-center gap-2 rounded-card border border-[var(--accent)] bg-[var(--accent-soft)] p-2 text-xs text-ink">
              <span>
                Claude suggests
                {suggestion.priority ? ` priority ${suggestion.priority}` : ""}
                {suggestion.priority && suggestion.dueDate ? " and" : ""}
                {suggestion.dueDate ? ` due ${shortDate(suggestion.dueDate)}` : ""}.
              </span>
              <Button variant="primary" size="sm" onClick={applySuggestion}>
                Apply
              </Button>
              <Button variant="subtle" size="sm" onClick={() => setSuggestion(null)}>
                Dismiss
              </Button>
            </div>
          ) : null}

          {/* ---- Attachments ---- */}
          {task.attachments.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {task.attachments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-2 rounded-control bg-[var(--panel-soft)] px-2 py-1"
                >
                  {a.kind === "link" ? (
                    <Link2 size={12} className="shrink-0 text-muted" aria-hidden />
                  ) : (
                    <Paperclip size={12} className="shrink-0 text-muted" aria-hidden />
                  )}
                  {a.kind === "link" && a.url ? (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 truncate text-xs text-accent-bright hover:underline"
                    >
                      {a.label}
                    </a>
                  ) : (
                    <a
                      href={`/api/tasks/${task.id}/attachments/${a.id}`}
                      className="min-w-0 flex-1 truncate text-xs text-accent-bright hover:underline"
                    >
                      {a.label}
                    </a>
                  )}
                  {a.sizeBytes ? (
                    <span className="num shrink-0 text-[10px] text-muted">
                      {humanSize(a.sizeBytes)}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    aria-label={`Remove ${a.label}`}
                    onClick={() => onDetach(task.id, a.id)}
                    className="press shrink-0 rounded-control p-0.5 text-muted hover:text-danger"
                  >
                    <X size={12} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {showLink ? (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                value={linkDraft}
                onChange={(e) => setLinkDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && linkDraft.trim()) {
                    void onAttach(task.id, { url: linkDraft.trim() });
                    setLinkDraft("");
                    setShowLink(false);
                  }
                  if (e.key === "Escape") setShowLink(false);
                }}
                placeholder="Paste a link — Drive doc, spec sheet, invoice…"
                aria-label="Link to attach"
                className="py-1 text-xs"
              />
              <Button
                variant="primary"
                size="sm"
                disabled={!linkDraft.trim()}
                onClick={() => {
                  void onAttach(task.id, { url: linkDraft.trim() });
                  setLinkDraft("");
                  setShowLink(false);
                }}
              >
                Add
              </Button>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => setShowLink((v) => !v)}>
              <Link2 size={12} aria-hidden />
              Link
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip size={12} aria-hidden />
              Doc
            </Button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const fd = new FormData();
                fd.append("file", file);
                void onAttach(task.id, fd);
                e.target.value = "";
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              disabled={explaining}
              onClick={explain}
            >
              {explaining ? (
                <Loader2 size={12} className="animate-spin" aria-hidden />
              ) : (
                <Sparkles size={12} aria-hidden />
              )}
              {task.aiBrief ? "Re-explain" : "Explain with AI"}
            </Button>

            <span className="flex-1" />

            {!finished && owner === CLAUDE && task.status === "queued" ? (
              <Button
                variant="primary"
                size="sm"
                disabled={running}
                onClick={() => onRun(task.id)}
              >
                {running ? (
                  <Loader2 size={12} className="animate-spin" aria-hidden />
                ) : (
                  <Play size={12} aria-hidden />
                )}
                {running ? "Working…" : "Run now"}
              </Button>
            ) : null}
            {!finished ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onPatch(task.id, { status: "done" })}
              >
                <Check size={12} aria-hidden />
                Done
              </Button>
            ) : null}
            <Button variant="subtle" size="sm" onClick={() => onDelete(task.id)}>
              <Trash2 size={12} aria-hidden />
            </Button>
          </div>

          {task.result ? (
            <p className="rounded-md bg-[var(--accent-soft)] px-2 py-1 text-xs whitespace-pre-wrap text-accent-bright">
              {task.result}
            </p>
          ) : null}
        </div>
      ) : null}
    </GlassCard>
  );
}
