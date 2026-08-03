"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlarmClock,
  BellRing,
  CalendarClock,
  Check,
  History,
  Pencil,
  Plus,
  Repeat,
  Send,
  Trash2,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/kit/Button";
import { Field, Input, Select, Textarea } from "@/components/kit/Field";
import { Modal } from "@/components/kit/Modal";
import { StatTile } from "@/components/kit/StatTile";
import { SegmentedControl } from "@/components/kit/SegmentedControl";
import { useToast } from "@/components/kit/Toast";
import {
  PRIORITIES,
  REPEATS,
  duePhrase,
  isOverdue,
  repeatLabel,
  type RepeatId,
  type ReminderPriority,
} from "@/lib/reminders";
import { cn, fullDate, inputDate } from "@/lib/utils";

export interface ReminderEventDTO {
  id: string;
  kind: string;
  channel: string;
  delivered: boolean;
  detail: string | null;
  createdAt: string;
}

export interface ReminderDTO {
  id: string;
  title: string;
  detail: string | null;
  dueAt: string;
  repeat: string;
  status: string;
  priority: string;
  category: string | null;
  lastFiredAt: string | null;
  fireCount: number;
  createdBy: string;
  events: ReminderEventDTO[];
}

type Tab = "upcoming" | "past";

interface FormState {
  title: string;
  detail: string;
  dueAt: string;
  repeat: RepeatId;
  priority: ReminderPriority;
  category: string;
}

const emptyForm = (): FormState => ({
  title: "",
  detail: "",
  // Default to today so a reminder created without touching the date
  // fires on the next sweep rather than silently never firing.
  dueAt: new Date().toISOString().slice(0, 10),
  repeat: "none",
  priority: "normal",
  category: "",
});

/**
 * Reminders — everything scheduled, everything that already went out,
 * and the form to add more. Delivery is Discord (src/lib/notify.ts),
 * swept once a day by /api/cron/send-reminders.
 */
export function RemindersWorkspace({
  initial,
  channelReady,
  dedicatedChannel = false,
}: {
  initial: ReminderDTO[];
  channelReady: boolean;
  /** True when reminders have their own #reminders webhook. */
  dedicatedChannel?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ReminderDTO | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ReminderDTO | null>(null);

  const set = (patch: Partial<FormState>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const { upcoming, past, dueToday, overdue } = useMemo(() => {
    const now = new Date();
    const up: ReminderDTO[] = [];
    const pa: ReminderDTO[] = [];
    for (const r of initial) {
      if (r.status === "scheduled") up.push(r);
      else pa.push(r);
    }
    up.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    // Past: most recently finished first.
    pa.sort((a, b) => (b.lastFiredAt ?? b.dueAt).localeCompare(a.lastFiredAt ?? a.dueAt));
    return {
      upcoming: up,
      past: pa,
      dueToday: up.filter((r) => duePhrase(r.dueAt, now) === "Today").length,
      overdue: up.filter((r) => isOverdue(r, now)).length,
    };
  }, [initial]);

  const rows = tab === "upcoming" ? upcoming : past;

  // ---------- actions ----------

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (r: ReminderDTO) => {
    setEditing(r);
    setForm({
      title: r.title,
      detail: r.detail ?? "",
      dueAt: inputDate(r.dueAt),
      repeat: r.repeat as RepeatId,
      priority: r.priority as ReminderPriority,
      category: r.category ?? "",
    });
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) {
      toast({ title: "Give the reminder a title", tone: "error" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        detail: form.detail.trim() || null,
        dueAt: form.dueAt,
        repeat: form.repeat,
        priority: form.priority,
        category: form.category.trim() || null,
      };
      const res = await fetch(
        editing ? `/api/reminders/${editing.id}` : "/api/reminders",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      toast({
        title: editing ? "Reminder updated" : "Reminder scheduled",
        description: editing ? undefined : "It'll push to Discord when due.",
        tone: "success",
      });
      setFormOpen(false);
      setEditing(null);
      router.refresh();
    } catch (e) {
      toast({
        title: "Couldn't save",
        description: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const patch = async (r: ReminderDTO, body: object, okTitle: string) => {
    try {
      const res = await fetch(`/api/reminders/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      toast({ title: okTitle, tone: "success" });
      router.refresh();
    } catch (e) {
      toast({
        title: "Couldn't update",
        description: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
    }
  };

  const remove = async () => {
    if (!confirmDelete) return;
    try {
      const res = await fetch(`/api/reminders/${confirmDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Delete failed");
      }
      toast({ title: `"${confirmDelete.title}" deleted`, tone: "info" });
      setConfirmDelete(null);
      router.refresh();
    } catch (e) {
      toast({
        title: "Couldn't delete",
        description: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
    }
  };

  const sendOne = async (r: ReminderDTO) => {
    try {
      const res = await fetch("/api/reminders/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminderId: r.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      toast({
        title: data.delivered
          ? "Test pushed — check your phone"
          : "No push channel wired yet",
        description: data.delivered
          ? "Discord should have buzzed."
          : "Add DISCORD_WEBHOOK_URL to send real reminders.",
        tone: data.delivered ? "success" : "info",
      });
      router.refresh();
    } catch (e) {
      toast({
        title: "Couldn't send",
        description: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
    }
  };

  const runSweep = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/reminders/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sweep failed");
      const fired = (data.fired ?? []).filter(
        (o: { fired: boolean }) => o.fired,
      ).length;
      toast({
        title: fired
          ? `${fired} reminder${fired === 1 ? "" : "s"} sent`
          : "Nothing due right now",
        description: fired
          ? "Repeating ones rolled to their next date."
          : "Everything scheduled is still in the future.",
        tone: fired ? "success" : "info",
      });
      router.refresh();
    } catch (e) {
      toast({
        title: "Couldn't run the sweep",
        description: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Reminders</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted">
            Nudges pushed to your phone through Discord. The sweep runs every
            morning — anything due that day goes out then.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={runSweep}
            disabled={sending}
          >
            <Send size={14} aria-hidden />
            {sending ? "Sending…" : "Send due now"}
          </Button>
          <Button variant="primary" size="sm" onClick={openCreate}>
            <Plus size={14} aria-hidden />
            New reminder
          </Button>
        </div>
      </header>

      {!channelReady ? (
        <div className="flex items-start gap-2.5 rounded-card border border-[var(--amber)]/40 bg-[var(--amber)]/10 p-3.5 text-sm">
          <TriangleAlert
            size={15}
            aria-hidden
            className="mt-0.5 shrink-0 text-amber"
          />
          <p className="text-ink">
            <span className="font-medium">Discord isn&apos;t wired yet.</span>{" "}
            Reminders will still be tracked and marked as sent, but nothing will
            reach your phone until{" "}
            <code className="num text-xs">DISCORD_WEBHOOK_URL</code> is set in
            the environment.
          </p>
        </div>
      ) : !dedicatedChannel ? (
        <div className="flex items-start gap-2.5 rounded-card border border-hairline bg-[var(--panel-soft)] p-3.5 text-sm">
          <TriangleAlert
            size={15}
            aria-hidden
            className="mt-0.5 shrink-0 text-muted"
          />
          <p className="text-muted">
            Reminders are posting to the same Discord channel as the budget
            alerts. To give them their own{" "}
            <span className="font-medium text-ink">#reminders</span> channel,
            create it in Discord, add a webhook there, and set{" "}
            <code className="num text-xs">DISCORD_REMINDERS_WEBHOOK_URL</code>.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile
          label="Scheduled"
          value={upcoming.length}
          sub="waiting to fire"
          icon={CalendarClock}
          tone="accent"
        />
        <StatTile
          label="Due today"
          value={dueToday}
          sub="going out this morning"
          icon={AlarmClock}
          tone={dueToday > 0 ? "amber" : "default"}
        />
        <StatTile
          label="Overdue"
          value={overdue}
          sub="past their date"
          icon={TriangleAlert}
          tone={overdue > 0 ? "danger" : "default"}
        />
        <StatTile
          label="History"
          value={past.length}
          sub="done or cancelled"
          icon={History}
        />
      </div>

      <SegmentedControl
        ariaLabel="Reminder list"
        segments={[
          { id: "upcoming", label: `Active (${upcoming.length})` },
          { id: "past", label: `Past (${past.length})` },
        ]}
        value={tab}
        onChange={(id) => setTab(id as Tab)}
        className="self-start"
      />

      {rows.length === 0 ? (
        <div className="rounded-xl border border-hairline bg-[var(--panel)] px-4 py-12 text-center">
          <BellRing
            size={20}
            aria-hidden
            className="mx-auto mb-2 text-muted opacity-60"
          />
          <p className="text-sm text-muted">
            {tab === "upcoming"
              ? "No active reminders. Add one and it'll push to Discord when it's due."
              : "Nothing here yet — reminders land in Past once they're done or cancelled."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <ReminderRow
              key={r.id}
              reminder={r}
              tab={tab}
              onEdit={() => openEdit(r)}
              onDelete={() => setConfirmDelete(r)}
              onSend={() => sendOne(r)}
              onComplete={() =>
                patch(r, { status: "done" }, `"${r.title}" marked done`)
              }
              onReopen={() =>
                patch(r, { status: "scheduled" }, `"${r.title}" reactivated`)
              }
            />
          ))}
        </ul>
      )}

      {/* ---- create / edit ---- */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit reminder" : "New reminder"}
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFormOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={save}
              disabled={saving}
            >
              {saving ? "Saving…" : editing ? "Save changes" : "Schedule it"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="What's the reminder?">
            {(id) => (
              <Input
                id={id}
                value={form.title}
                onChange={(e) => set({ title: e.target.value })}
                placeholder="e.g. Top up the Google Ads account"
                autoFocus
              />
            )}
          </Field>

          <Field label="Details" hint="Optional — included in the Discord message.">
            {(id) => (
              <Textarea
                id={id}
                value={form.detail}
                onChange={(e) => set({ detail: e.target.value })}
                rows={3}
                placeholder="Anything you'll want to know when it buzzes."
              />
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Due date">
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={form.dueAt}
                  onChange={(e) => set({ dueAt: e.target.value })}
                />
              )}
            </Field>
            <Field label="Repeat">
              {(id) => (
                <Select
                  id={id}
                  value={form.repeat}
                  onChange={(e) => set({ repeat: e.target.value as RepeatId })}
                >
                  {REPEATS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Priority"
              hint={
                form.priority === "urgent"
                  ? "Urgent pings @everyone in Discord."
                  : undefined
              }
            >
              {(id) => (
                <Select
                  id={id}
                  value={form.priority}
                  onChange={(e) =>
                    set({ priority: e.target.value as ReminderPriority })
                  }
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Category" hint="Optional grouping.">
              {(id) => (
                <Input
                  id={id}
                  value={form.category}
                  onChange={(e) => set({ category: e.target.value })}
                  placeholder="Ads, Suppliers…"
                />
              )}
            </Field>
          </div>

          <p className="text-[11px] text-muted">
            Reminders are swept once each morning, so this fires on its due date
            — not at a specific time of day.
          </p>
        </div>
      </Modal>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete reminder?"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(null)}
            >
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={remove}>
              Delete permanently
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {confirmDelete
            ? `“${confirmDelete.title}” and its delivery history will be removed. This cannot be undone.`
            : ""}
        </p>
      </Modal>
    </div>
  );
}

/** One reminder row — the whole state of a nudge at a glance. */
function ReminderRow({
  reminder: r,
  tab,
  onEdit,
  onDelete,
  onSend,
  onComplete,
  onReopen,
}: {
  reminder: ReminderDTO;
  tab: Tab;
  onEdit: () => void;
  onDelete: () => void;
  onSend: () => void;
  onComplete: () => void;
  onReopen: () => void;
}) {
  const overdue = isOverdue(r);
  const priority = PRIORITIES.find((p) => p.id === r.priority);
  const lastEvent = r.events[0];

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border bg-[var(--panel)] px-4 py-3 transition-colors duration-150",
        overdue
          ? "border-[var(--red)]/40"
          : "border-hairline hover:border-[var(--hairline-strong)]",
      )}
    >
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: priority?.color ?? "var(--muted)" }}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p
            className={cn(
              "truncate font-medium",
              r.status === "cancelled"
                ? "text-muted line-through"
                : "text-ink",
            )}
          >
            {r.title}
          </p>
          {r.repeat !== "none" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--panel-soft)] px-1.5 py-0.5 text-[10px] font-medium text-muted">
              <Repeat size={9} aria-hidden />
              {repeatLabel(r.repeat)}
            </span>
          ) : null}
          {r.category ? (
            <span className="rounded-full bg-[var(--panel-soft)] px-1.5 py-0.5 text-[10px] text-muted">
              {r.category}
            </span>
          ) : null}
        </div>
        {r.detail ? (
          <p className="mt-0.5 truncate text-xs text-muted">{r.detail}</p>
        ) : null}
      </div>

      <div className="shrink-0 text-right">
        {tab === "upcoming" ? (
          <>
            <p
              className={cn(
                "text-xs font-medium",
                overdue ? "text-red" : "text-ink",
              )}
            >
              {duePhrase(r.dueAt)}
            </p>
            <p className="num text-[11px] text-muted">{fullDate(r.dueAt)}</p>
          </>
        ) : (
          <>
            <p className="text-xs font-medium text-muted">
              {r.status === "cancelled" ? "Cancelled" : "Done"}
            </p>
            <p className="num text-[11px] text-muted">
              {r.lastFiredAt
                ? `sent ${fullDate(r.lastFiredAt)}`
                : fullDate(r.dueAt)}
            </p>
          </>
        )}
        {r.fireCount > 0 ? (
          <p className="num text-[10px] text-muted">
            {r.fireCount} push{r.fireCount === 1 ? "" : "es"}
            {lastEvent && !lastEvent.delivered ? " · undelivered" : ""}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {tab === "upcoming" ? (
          <>
            <IconButton label="Send now as a test" onClick={onSend}>
              <Send size={13} aria-hidden />
            </IconButton>
            <IconButton label="Edit" onClick={onEdit}>
              <Pencil size={13} aria-hidden />
            </IconButton>
            <IconButton label="Mark done" onClick={onComplete}>
              <Check size={13} aria-hidden />
            </IconButton>
          </>
        ) : (
          <IconButton label="Reactivate" onClick={onReopen}>
            <Undo2 size={13} aria-hidden />
          </IconButton>
        )}
        <IconButton label="Delete" onClick={onDelete} danger>
          <Trash2 size={13} aria-hidden />
        </IconButton>
      </div>
    </li>
  );
}

function IconButton({
  label,
  onClick,
  children,
  danger,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "press inline-flex h-7 w-7 items-center justify-center rounded-control border border-transparent text-muted transition-colors duration-150",
        danger
          ? "hover:border-[var(--red)]/40 hover:text-red"
          : "hover:border-hairline hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
