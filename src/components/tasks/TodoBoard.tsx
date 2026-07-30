"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/kit/Button";
import { Chip } from "@/components/kit/Chip";
import { Input } from "@/components/kit/Field";
import { Menu, MenuItem } from "@/components/kit/Menu";
import { Modal } from "@/components/kit/Modal";
import { useToast } from "@/components/kit/Toast";
import { SeatAvatar, TodoCard } from "@/components/tasks/TodoCard";
import {
  CLAUDE,
  UNASSIGNED,
  ownerKey,
  type SeatDTO,
  type TodoDTO,
} from "@/lib/tasks/board";

/**
 * The shared to-do board.
 *
 * Order is decided on the server (src/lib/tasks/sort.ts) and this
 * component preserves it — after any change it calls router.refresh(),
 * which re-runs the sort with fresh data. Sorting here as well would
 * mean the server and the browser each picking an order from their own
 * clock, and the list flickering into a different shape on hydration.
 */
export function TodoBoard({
  initial,
  seats,
}: {
  initial: TodoDTO[];
  seats: SeatDTO[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [captureOwner, setCaptureOwner] = useState<string>(UNASSIGNED);
  const [filter, setFilter] = useState<string>("all");
  const [busy, setBusy] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [editingTeam, setEditingTeam] = useState(false);

  const fail = (e: unknown, what: string) =>
    toast({
      title: what,
      description: e instanceof Error ? e.message : undefined,
      tone: "error",
    });

  const post = async (url: string, init: RequestInit) => {
    const res = await fetch(url, init);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `Request failed (${res.status})`);
    }
    return res;
  };

  const add = async () => {
    const t = title.trim();
    if (!t) return;
    setBusy(true);
    try {
      await post("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t, owner: captureOwner }),
      });
      setTitle("");
      router.refresh();
    } catch (e) {
      fail(e, "Couldn't add that");
    } finally {
      setBusy(false);
    }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    try {
      await post(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      router.refresh();
    } catch (e) {
      fail(e, "Update failed");
    }
  };

  const remove = async (id: string) => {
    try {
      await post(`/api/tasks/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      fail(e, "Couldn't delete that");
    }
  };

  const run = async (id: string) => {
    setRunningId(id);
    router.refresh();
    try {
      await post(`/api/tasks/${id}/run`, { method: "POST" });
      toast({ title: "Task done — result is on the card", tone: "success" });
    } catch (e) {
      fail(e, "Agent run failed");
    } finally {
      setRunningId(null);
      router.refresh();
    }
  };

  const explain = async (id: string) => {
    try {
      const res = await post(`/api/tasks/${id}/explain`, { method: "POST" });
      const body = (await res.json()) as {
        suggestion?: { priority: string | null; dueDate: string | null };
      };
      router.refresh();
      return body.suggestion ?? null;
    } catch (e) {
      fail(e, "Couldn't write the brief");
      return null;
    }
  };

  const attach = async (id: string, payload: FormData | { url: string }) => {
    try {
      await post(
        `/api/tasks/${id}/attachments`,
        payload instanceof FormData
          ? { method: "POST", body: payload }
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            },
      );
      router.refresh();
    } catch (e) {
      fail(e, "Couldn't attach that");
    }
  };

  const detach = async (taskId: string, attachmentId: string) => {
    try {
      await post(`/api/tasks/${taskId}/attachments/${attachmentId}`, {
        method: "DELETE",
      });
      router.refresh();
    } catch (e) {
      fail(e, "Couldn't remove that");
    }
  };

  const open = useMemo(
    () => initial.filter((t) => t.status === "queued" || t.status === "running"),
    [initial],
  );
  const proposed = useMemo(
    () => initial.filter((t) => t.status === "suggested"),
    [initial],
  );
  const finished = useMemo(
    () =>
      initial
        .filter((t) => t.status === "done" || t.status === "cancelled")
        .slice(0, 20),
    [initial],
  );

  const matches = (t: TodoDTO) => filter === "all" || ownerKey(t) === filter;
  const countFor = (key: string) =>
    open.filter((t) => key === "all" || ownerKey(t) === key).length;

  const visible = open.filter(matches);
  const activeSeats = seats.filter((s) => s.active);
  const captureSeat = seats.find((s) => s.id === captureOwner);

  const cardProps = {
    seats,
    onPatch: patch,
    onDelete: remove,
    onRun: run,
    onExplain: explain,
    onAttach: attach,
    onDetach: detach,
  };

  return (
    <div className="flex flex-col gap-5">
      {/* ---- Quick capture: type it, hit enter, sort it out later ---- */}
      <div className="surface flex items-center gap-2 rounded-card p-3">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void add();
          }}
          placeholder="Note something down — “chase Wexford on the pallet quote”"
          aria-label="New to-do"
        />
        <Menu
          label="Who is this for?"
          trigger={<SeatAvatar seat={captureSeat} owner={captureOwner} />}
          triggerClassName="h-8 w-8 shrink-0"
        >
          {(close) => (
            <>
              {activeSeats.map((s) => (
                <MenuItem
                  key={s.id}
                  onSelect={() => {
                    setCaptureOwner(s.id);
                    close();
                  }}
                >
                  {s.name}
                </MenuItem>
              ))}
              <MenuItem
                onSelect={() => {
                  setCaptureOwner(CLAUDE);
                  close();
                }}
              >
                Claude (the agent)
              </MenuItem>
              <MenuItem
                onSelect={() => {
                  setCaptureOwner(UNASSIGNED);
                  close();
                }}
              >
                Nobody yet
              </MenuItem>
            </>
          )}
        </Menu>
        <Button variant="primary" size="sm" disabled={busy} onClick={add}>
          <Plus size={14} aria-hidden />
          Add
        </Button>
      </div>

      {/* ---- Who's it for ---- */}
      <div className="flex flex-wrap items-center gap-2">
        <Chip
          label="Everyone"
          active={filter === "all"}
          count={countFor("all")}
          onClick={() => setFilter("all")}
        />
        {activeSeats.map((s) => (
          <Chip
            key={s.id}
            label={s.name}
            dot={s.color}
            active={filter === s.id}
            count={countFor(s.id)}
            onClick={() => setFilter(s.id)}
          />
        ))}
        <Chip
          label="Claude"
          dot="#7C6BE8"
          active={filter === CLAUDE}
          count={countFor(CLAUDE)}
          onClick={() => setFilter(CLAUDE)}
        />
        <Chip
          label="Nobody yet"
          active={filter === UNASSIGNED}
          count={countFor(UNASSIGNED)}
          onClick={() => setFilter(UNASSIGNED)}
        />
        <span className="flex-1" />
        <Button variant="subtle" size="sm" onClick={() => setEditingTeam(true)}>
          <Users size={13} aria-hidden />
          Team
        </Button>
      </div>

      {/* ---- The list ---- */}
      <section className="flex flex-col gap-2.5">
        <h2 className="text-xs font-semibold tracking-widest text-muted uppercase">
          To do ({visible.length}) · sorted by what&apos;s most urgent
        </h2>
        {visible.map((t) => (
          <TodoCard
            key={t.id}
            task={t}
            running={runningId === t.id}
            {...cardProps}
          />
        ))}
        {visible.length === 0 ? (
          <p className="text-xs text-muted">
            {open.length === 0
              ? "Nothing on the board. Note something down above — you can assign it, date it and explain it later."
              : "Nothing for this person right now."}
          </p>
        ) : null}
      </section>

      {proposed.length > 0 ? (
        <section className="flex flex-col gap-2.5">
          <h2 className="flex items-center gap-2 text-xs font-semibold tracking-widest text-muted uppercase">
            <Sparkles size={12} aria-hidden /> Proposed by Claude ({proposed.length})
          </h2>
          {proposed.filter(matches).map((t) => (
            <div key={t.id} className="flex flex-col gap-1.5">
              <TodoCard task={t} running={runningId === t.id} {...cardProps} />
              <div className="flex items-center gap-1.5 pl-7">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => patch(t.id, { status: "queued", humanConfirmed: true })}
                >
                  Put it on the board
                </Button>
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={() => patch(t.id, { status: "cancelled" })}
                >
                  No thanks
                </Button>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {finished.length > 0 ? (
        <section className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            aria-expanded={showDone}
            className="press self-start text-xs font-semibold tracking-widest text-muted uppercase hover:text-ink"
          >
            {showDone ? "Hide" : "Show"} finished ({finished.length})
          </button>
          {showDone
            ? finished
                .filter(matches)
                .map((t) => (
                  <TodoCard
                    key={t.id}
                    task={t}
                    running={false}
                    {...cardProps}
                  />
                ))
            : null}
        </section>
      ) : null}

      <TeamModal
        open={editingTeam}
        seats={seats}
        onClose={() => setEditingTeam(false)}
        onSaved={() => router.refresh()}
        onError={(e) => fail(e, "Couldn't save the team")}
      />
    </div>
  );
}

/** Rename the three seats. Seats are never deleted — see the API route. */
function TeamModal({
  open,
  seats,
  onClose,
  onSaved,
  onError,
}: {
  open: boolean;
  seats: SeatDTO[];
  onClose: () => void;
  onSaved: () => void;
  onError: (e: unknown) => void;
}) {
  const [names, setNames] = useState<Record<string, string>>({});
  const [discordIds, setDiscordIds] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const nameFor = (s: SeatDTO) => names[s.id] ?? s.name;
  const discordIdFor = (s: SeatDTO) =>
    discordIds[s.id] ?? s.discordUserId ?? "";

  const save = async () => {
    setSaving(true);
    try {
      for (const seat of seats) {
        const next = nameFor(seat).trim();
        const nextDiscordId = discordIdFor(seat).trim();
        if (
          !next ||
          (next === seat.name &&
            nextDiscordId === (seat.discordUserId ?? ""))
        ) {
          continue;
        }
        const res = await fetch(`/api/team-members/${seat.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: next.slice(0, 60),
            // Initials follow the name unless someone set them by hand.
            initials: next
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0]?.toUpperCase() ?? "")
              .join(""),
            discordUserId: nextDiscordId || null,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `Failed to rename ${seat.name}`);
        }
      }
      onSaved();
      onClose();
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="The team"
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={saving} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <p className="mb-3 text-xs text-muted">
        Three seats share this board. Renaming one re-labels every task it
        owns, past and present.
      </p>
      <div className="flex flex-col gap-2">
        {seats.map((s) => (
          <div key={s.id} className="surface-muted flex items-center gap-2 rounded-card p-2">
            <SeatAvatar seat={s} owner={s.id} />
            <div className="grid flex-1 grid-cols-2 gap-2">
              <Input
                value={nameFor(s)}
                onChange={(e) =>
                  setNames((prev) => ({ ...prev, [s.id]: e.target.value }))
                }
                aria-label={`Name for ${s.name}`}
              />
              <Input
                value={discordIdFor(s)}
                onChange={(e) =>
                  setDiscordIds((prev) => ({
                    ...prev,
                    [s.id]: e.target.value,
                  }))
                }
                inputMode="numeric"
                placeholder="Discord user ID"
                aria-label={`Discord user ID for ${s.name}`}
              />
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
