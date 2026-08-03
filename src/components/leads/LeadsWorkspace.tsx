"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Flame,
  Plus,
  RefreshCw,
  Search,
  Trophy,
  Users,
} from "lucide-react";
import {
  LEAD_STAGES,
  needsFollowUp,
  type RecordDTO,
  type StageId,
} from "@/lib/domain";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/kit/Toast";
import { LeadRow } from "@/components/leads/LeadRow";
import { LeadDrawer } from "@/components/leads/LeadDrawer";

/**
 * Leads CRM — customers and buyers, kept deliberately separate from the
 * supplier side (which lives in /supplier-outreach).
 *
 * No kanban, no drag-and-drop: this is a flat, sortable list where the
 * two fields you actually change while working a list — stage and next
 * action — are editable inline. Clicking a row opens the full record.
 */

const CLOSED = new Set<string>(["WON", "LOST"]);

const controlClass =
  "h-10 rounded-control border border-hairline bg-[var(--panel)] px-3 text-[13px] text-ink outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]";

type Tab = "open" | "won" | "all";

export function LeadsWorkspace({
  initial,
  shopifyConnected,
  initialRecordId,
}: {
  initial: RecordDTO[];
  shopifyConnected: boolean;
  /** Deep link from /leads?record=<id> (e.g. a retired /crm link). */
  initialRecordId?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [records, setRecords] = useState<RecordDTO[]>(initial);
  // A deep-linked record may be Won/Lost, which the default "Open" tab
  // hides — start on "All" so the row behind the drawer is actually there.
  const [tab, setTab] = useState<Tab>(initialRecordId ? "all" : "open");
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialRecordId ?? null,
  );
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const selected = useMemo(
    () => records.find((r) => r.id === selectedId) ?? null,
    [records, selectedId],
  );

  const replace = (dto: RecordDTO) =>
    setRecords((prev) => prev.map((r) => (r.id === dto.id ? dto : r)));

  const open = records.filter((r) => !CLOSED.has(r.status));
  const won = records.filter((r) => r.status === "WON");
  const hot = records.filter((r) => r.priority === "hot").length;
  const followUps = records.filter(needsFollowUp).length;

  const visible = useMemo(() => {
    const base =
      tab === "open" ? open : tab === "won" ? won : records;
    const q = search.trim().toLowerCase();
    return base
      .filter((r) => {
        if (stage && r.status !== stage) return false;
        if (!q) return true;
        return [
          r.name,
          r.email,
          r.phone,
          r.company,
          r.productInterest,
          r.recordId,
          r.source,
          r.contextSummary,
        ]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(q));
      })
      .sort((a, b) => {
        // Anything needing follow-up floats up; then newest first.
        const af = needsFollowUp(a) ? 0 : 1;
        const bf = needsFollowUp(b) ? 0 : 1;
        if (af !== bf) return af - bf;
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [tab, open, won, records, search, stage]);

  /** Inline stage change — optimistic, rolls back on failure. */
  const changeStage = async (id: string, next: StageId) => {
    const before = records;
    setRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: next } : r)),
    );
    try {
      const res = await fetch(`/api/records/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      replace(data);
    } catch (e) {
      setRecords(before);
      toast({
        title: "Couldn't move that lead",
        description: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
    }
  };

  const syncShopify = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/leads/sync-shopify", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      const { created = 0, updated = 0 } = data;
      toast({
        title:
          created || updated
            ? `${created} new · ${updated} updated`
            : "Already up to date",
        description:
          created || updated
            ? "Pulled from your Shopify customers."
            : "No new Shopify customers since the last sync.",
        tone: "success",
      });
      router.refresh();
    } catch (e) {
      toast({
        title: "Shopify sync failed",
        description: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
    } finally {
      setSyncing(false);
    }
  };

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "open", label: "Open", count: open.length },
    { id: "won", label: "Won", count: won.length },
    { id: "all", label: "All", count: records.length },
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Leads CRM</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted">
            Customers and buyers. New Shopify customers land here
            automatically — work them from New to Won.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {shopifyConnected ? (
            <button
              type="button"
              onClick={syncShopify}
              disabled={syncing}
              className="press inline-flex h-9 items-center gap-1.5 rounded-control border border-hairline bg-[var(--panel)] px-3 text-[13px] font-medium text-ink transition hover:border-[var(--hairline-strong)] disabled:opacity-60"
            >
              <RefreshCw
                size={14}
                aria-hidden
                className={syncing ? "animate-spin" : undefined}
              />
              {syncing ? "Syncing…" : "Sync Shopify"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setSelectedId(null);
              setCreating(true);
            }}
            className="press inline-flex h-9 items-center gap-1.5 rounded-control bg-[var(--accent)] px-3 text-[13px] font-semibold text-white transition hover:brightness-110"
          >
            <Plus size={14} aria-hidden />
            New lead
          </button>
        </div>
      </header>

      {/* stat strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open leads" value={open.length} icon={Users} />
        <Stat label="Hot" value={hot} icon={Flame} tone="amber" />
        <Stat label="Won" value={won.length} icon={Trophy} tone="green" />
        <Stat
          label="Needs follow-up"
          value={followUps}
          icon={Check}
          tone={followUps > 0 ? "amber" : undefined}
        />
      </div>

      {/* tabs + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-control border border-hairline bg-[var(--panel)] p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "press rounded-[7px] px-3 py-1.5 text-[13px] font-medium transition",
                tab === t.id
                  ? "bg-[var(--accent-soft)] text-ink"
                  : "text-muted hover:text-ink",
              )}
            >
              {t.label}
              <span className="num ml-1.5 text-[11px] text-muted">
                {t.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative min-w-52 flex-1 md:max-w-xs">
          <Search
            size={14}
            aria-hidden
            className="absolute top-1/2 left-3 -translate-y-1/2 text-muted"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone, interest…"
            aria-label="Search leads"
            className={cn(controlClass, "w-full pl-8")}
          />
        </div>

        <select
          value={stage}
          onChange={(e) => setStage(e.target.value)}
          aria-label="Filter by stage"
          className={cn(controlClass, "w-44")}
        >
          <option value="">All stages</option>
          {LEAD_STAGES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>

        {visible.length !== records.length ? (
          <span className="num ml-auto text-xs text-muted">
            {visible.length} of {records.length}
          </span>
        ) : null}
      </div>

      {/* the list */}
      <div className="overflow-hidden rounded-xl border border-hairline">
        <div className="hidden grid-cols-[minmax(0,2fr)_180px_190px_minmax(0,1fr)_110px] items-center border-b border-hairline bg-[var(--panel)] px-4 py-2 text-[10px] font-semibold tracking-[0.12em] text-muted uppercase lg:grid">
          <span>Lead</span>
          <span>Stage</span>
          <span>Phone / Email</span>
          <span>Interested in</span>
          <span className="text-right">Next action</span>
        </div>

        {visible.length === 0 ? (
          <div className="bg-[var(--panel)] px-4 py-12 text-center">
            <Users
              size={20}
              aria-hidden
              className="mx-auto mb-2 text-muted opacity-60"
            />
            <p className="text-sm text-muted">
              {records.length === 0
                ? shopifyConnected
                  ? "No leads yet. Hit “Sync Shopify” to pull in your customers."
                  : "No leads yet. Add one, or connect Shopify to pull customers in."
                : "No leads match this view."}
            </p>
          </div>
        ) : (
          visible.map((r) => (
            <LeadRow
              key={r.id}
              record={r}
              onOpen={() => setSelectedId(r.id)}
              onStageChange={(next) => changeStage(r.id, next)}
            />
          ))
        )}
      </div>

      <LeadDrawer
        // Remount when the target changes so the form re-seeds from the
        // new record without an effect syncing props into state.
        key={creating ? "new" : (selectedId ?? "none")}
        record={creating ? null : selected}
        open={creating || selected !== null}
        onClose={() => {
          setCreating(false);
          setSelectedId(null);
        }}
        onSaved={(dto, wasCreate) => {
          if (wasCreate) {
            setRecords((prev) => [dto, ...prev]);
            setCreating(false);
            setSelectedId(dto.id);
          } else {
            replace(dto);
          }
        }}
        onDeleted={(id) => {
          setRecords((prev) => prev.filter((r) => r.id !== id));
          setSelectedId(null);
        }}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Users;
  tone?: "amber" | "green";
}) {
  return (
    <div className="rounded-xl border border-hairline bg-[var(--panel)] px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">
          {label}
        </span>
        <Icon
          size={14}
          aria-hidden
          className={cn(
            "text-muted",
            tone === "amber" && value > 0 && "text-amber",
            tone === "green" && value > 0 && "text-green",
          )}
        />
      </div>
      <p className="num mt-1 text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}
