"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  BadgeCheck,
  Bot,
  Clock,
  Download,
  Medal,
  Plus,
  Upload,
  UserRound,
  Users,
  Waypoints,
  XCircle,
} from "lucide-react";
import {
  ACTIVE_SUPPLIER_STAGES,
  CLOSED_SUPPLIER_STAGE_SET,
  CLUSTERS,
  isClosedSupplier,
  needsFollowUp,
  RANKS,
  RECORD_TYPES,
  stagesFor,
  STAGE_MAP,
  CLOSED_SUPPLIER_STAGES,
  type InteractionType,
  type RecordDTO,
  type RecordType,
  type StageId,
  type TeamProfileDTO,
} from "@/lib/domain";
import type { ParsedSupplier } from "@/lib/csv";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/kit/Toast";
import { Button } from "@/components/kit/Button";
import { StatTile } from "@/components/kit/StatTile";
import { Modal } from "@/components/kit/Modal";
import { SegmentedControl } from "@/components/kit/SegmentedControl";
import { Board } from "@/components/crm/Board";
import { TableView } from "@/components/crm/TableView";
import { ClosedView } from "@/components/crm/ClosedView";
import {
  FilterBar,
  isFiltered,
  type CrmFilters,
  type FilterOption,
} from "@/components/crm/FilterBar";
import {
  RecordDrawer,
  type RecordFormData,
} from "@/components/crm/RecordDrawer";
import { ImportModal } from "@/components/crm/ImportModal";
import {
  APPLIED_STAGE,
  QuickActionDialog,
  type QuickAction,
} from "@/components/crm/QuickActions";

interface CrmWorkspaceProps {
  initial: RecordDTO[];
  profiles: TeamProfileDTO[];
  initialRecordId?: string;
  initialCreate?: boolean;
  /** Stage to pre-filter on, from /crm?stage=<id> (pipeline drill-in). */
  initialStage?: string;
}

const defaultFilters: CrmFilters = {
  search: "",
  cluster: null,
  rank: null,
  stage: null,
  owner: null,
  followUpOnly: false,
};

type Scope = "pipeline" | "closed";

export function CrmWorkspace({
  initial,
  profiles,
  initialRecordId,
  initialCreate,
  initialStage,
}: CrmWorkspaceProps) {
  const { toast } = useToast();
  const [records, setRecords] = useState<RecordDTO[]>(initial);
  const [recordType, setRecordType] = useState<RecordType>("supplier");
  const [scope, setScope] = useState<Scope>("pipeline");
  const [activeProfileId, setActiveProfileId] = useState(
    profiles[0]?.id ?? "seat_1",
  );
  const [view, setView] = useState<"board" | "table">("board");
  const [filters, setFilters] = useState<CrmFilters>(defaultFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [quick, setQuick] = useState<{ id: string; action: QuickAction } | null>(
    null,
  );

  // Deep links: /crm?record=<id> and /crm?new=1
  useEffect(() => {
    if (initialRecordId) {
      setSelectedId(initialRecordId);
      const r = initial.find((x) => x.id === initialRecordId);
      if (r) {
        setRecordType(r.type);
        if (isClosedSupplier(r)) {
          setScope("closed");
        } else if (r.type === "supplier" && r.supplierOwnerId) {
          setActiveProfileId(r.supplierOwnerId);
        }
      }
    }
  }, [initialRecordId, initial]);
  useEffect(() => {
    if (initialCreate) setCreating(true);
  }, [initialCreate]);

  // /crm?stage=<id> — the dashboard pipeline drills in here. Closed
  // stages live in their own scope, so send those to the closed book.
  useEffect(() => {
    if (!initialStage) return;
    setFilters((f) => ({ ...f, stage: initialStage as StageId }));
    setScope(CLOSED_SUPPLIER_STAGE_SET.has(initialStage) ? "closed" : "pipeline");
  }, [initialStage]);

  const selected = useMemo(
    () => records.find((r) => r.id === selectedId) ?? null,
    [records, selectedId],
  );

  // Looked up by id rather than held as a snapshot, so the dialog always
  // acts on the current version of the record.
  const quickRecord = useMemo(
    () => (quick ? (records.find((r) => r.id === quick.id) ?? null) : null),
    [records, quick],
  );

  const replace = (dto: RecordDTO) =>
    setRecords((prev) => prev.map((r) => (r.id === dto.id ? dto : r)));

  // ---------- derived ----------
  const ofType = useMemo(
    () => records.filter((r) => r.type === recordType),
    [records, recordType],
  );

  const isSupplier = recordType === "supplier";

  /** Suppliers whose deal is decided — they live in the Closed section. */
  const closedRecords = useMemo(
    () => (isSupplier ? ofType.filter((r) => CLOSED_SUPPLIER_STAGE_SET.has(r.status)) : []),
    [ofType, isSupplier],
  );

  /** All active records, before a supplier teammate profile narrows them. */
  const activeRecords = useMemo(
    () =>
      isSupplier
        ? ofType.filter((r) => !CLOSED_SUPPLIER_STAGE_SET.has(r.status))
        : ofType,
    [ofType, isSupplier],
  );

  /** What the current teammate's board/table works with. */
  const pipelineRecords = useMemo(
    () =>
      isSupplier
        ? activeRecords.filter((r) => r.supplierOwnerId === activeProfileId)
        : activeRecords,
    [activeRecords, activeProfileId, isSupplier],
  );

  const activeProfile =
    profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0];

  const pipelineStages = isSupplier
    ? ACTIVE_SUPPLIER_STAGES
    : stagesFor(recordType);

  /**
   * Filter options come off the records themselves, not the constants in
   * domain.ts: a cluster or rank introduced by a later import has to be
   * filterable, and a value that no record carries is just noise. The
   * active filter value is always kept in its list so a filter can never
   * be applied-but-invisible.
   */
  const facets = useMemo(() => {
    const clusters = new Map<string, number>();
    const ranks = new Map<string, number>();
    const statuses = new Map<string, number>();
    let unranked = 0;
    for (const r of pipelineRecords) {
      clusters.set(r.cluster, (clusters.get(r.cluster) ?? 0) + 1);
      statuses.set(r.status, (statuses.get(r.status) ?? 0) + 1);
      if (r.rank) ranks.set(r.rank, (ranks.get(r.rank) ?? 0) + 1);
      else unranked += 1;
    }

    /** Seeded order first, then whatever the DB has picked up since. */
    const order = (seeded: readonly string[], found: Iterable<string>) => {
      const all = new Set(found);
      return [
        ...seeded.filter((v) => all.has(v)),
        ...[...all]
          .filter((v) => !seeded.includes(v))
          .sort((a, b) => a.localeCompare(b)),
      ];
    };
    const withActive = (ids: string[], active: string | null) =>
      active && active !== "unranked" && !ids.includes(active)
        ? [...ids, active]
        : ids;

    const clusterOptions: FilterOption[] = withActive(
      order(CLUSTERS, clusters.keys()),
      filters.cluster,
    ).map((id) => ({ id, label: id, count: clusters.get(id) ?? 0 }));

    const rankOptions: FilterOption[] = withActive(
      order(RANKS, ranks.keys()),
      filters.rank,
    ).map((id) => ({ id, label: id, count: ranks.get(id) ?? 0 }));

    // Stages are the pipeline's definition, so the whole ladder stays —
    // plus any status the DB holds that the ladder doesn't know about.
    const ladderIds = pipelineStages.map((s) => s.id as string);
    const stageOptions: FilterOption[] = [
      ...pipelineStages.map((s) => ({
        id: s.id as string,
        label: s.label,
        count: statuses.get(s.id) ?? 0,
        color: s.color,
      })),
      ...[...statuses.keys()]
        .filter((id) => !ladderIds.includes(id))
        .sort((a, b) => a.localeCompare(b))
        .map((id) => ({
          id,
          label: STAGE_MAP[id]?.label ?? id,
          count: statuses.get(id) ?? 0,
          color: STAGE_MAP[id]?.color,
        })),
    ];

    return { clusterOptions, rankOptions, stageOptions, unranked };
  }, [pipelineRecords, pipelineStages, filters.cluster, filters.rank]);

  /** Every cluster the DB knows about — the drawer's select reads this. */
  const allClusters = useMemo(
    () => [...new Set<string>([...CLUSTERS, ...records.map((r) => r.cluster)])],
    [records],
  );

  const followUpCount = useMemo(
    () => pipelineRecords.filter(needsFollowUp).length,
    [pipelineRecords],
  );

  const goldCount = pipelineRecords.filter((r) => r.rank === "Gold").length;
  const silverCount = pipelineRecords.filter((r) => r.rank === "Silver").length;
  const bronzeCount = pipelineRecords.filter((r) => r.rank === "Bronze").length;
  const claudeOwned = pipelineRecords.filter((r) => r.owner === "claude").length;
  const inMotion = pipelineRecords.filter(
    (r) => !["SOURCED", "QUALIFIED", "NEW", "DECLINED", "LOST"].includes(r.status),
  ).length;

  const authorizedCount = closedRecords.filter(
    (r) => r.status === "AUTHORIZED",
  ).length;
  const declinedCount = closedRecords.filter(
    (r) => r.status === "DECLINED",
  ).length;
  const goldDealers = closedRecords.filter(
    (r) => r.status === "AUTHORIZED" && r.rank === "Gold",
  ).length;

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return pipelineRecords.filter((r) => {
      if (
        q &&
        ![
          r.name,
          r.niche,
          r.email,
          r.mainContact,
          r.phone,
          r.bestSeller,
          r.company,
          r.productInterest,
          r.contextSummary,
        ]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(q))
      )
        return false;
      if (filters.cluster && r.cluster !== filters.cluster) return false;
      if (filters.rank === "unranked") {
        if (r.rank) return false;
      } else if (filters.rank && r.rank !== filters.rank) {
        return false;
      }
      if (!isSupplier && filters.owner && r.owner !== filters.owner) return false;
      // Applies in both views. It used to be gated on the table, so a
      // stage filter set there went silently inert on the board.
      if (filters.stage && r.status !== filters.stage) return false;
      if (filters.followUpOnly && !needsFollowUp(r)) return false;
      return true;
    });
  }, [pipelineRecords, filters, isSupplier]);

  // ---------- mutations ----------
  const moveStage = async (id: string, status: StageId) => {
    const before = records;
    const record = records.find((r) => r.id === id);
    setRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r)),
    );
    try {
      const dto = await api.updateRecord(id, { status });
      replace(dto);
      // Closing a supplier moves it off the board — say where it went.
      if (isClosedSupplier(dto) && record && !isClosedSupplier(record)) {
        const stage = CLOSED_SUPPLIER_STAGES.find((s) => s.id === dto.status);
        toast({
          title: `${dto.name} moved to Closed`,
          description: stage ? stage.label : undefined,
          tone: "success",
        });
      }
    } catch (e) {
      setRecords(before);
      toast({
        title: "Couldn't move record",
        description: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
    }
  };

  const saveRecord = async (data: RecordFormData) => {
    try {
      if (creating) {
        const dto = await api.createRecord(data);
        setRecords((prev) =>
          [...prev, dto].sort((a, b) => a.name.localeCompare(b.name)),
        );
        setCreating(false);
        setSelectedId(dto.id);
        toast({ title: `${dto.name} added to the pipeline`, tone: "success" });
      } else if (selected) {
        const dto = await api.updateRecord(selected.id, data);
        replace(dto);
        toast({ title: "Changes saved", tone: "success" });
      }
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
    }
  };

  /**
   * Quick actions. Every one of these writes through the API and then
   * replaces the record in the single `records` array both the board and
   * the table render from — so the result shows up in whichever view is
   * open, with no refetch.
   */
  const logFor = async (
    record: RecordDTO,
    type: InteractionType,
    body: string,
  ) => {
    const dto = await api.logInteraction(record.id, { type, body });
    replace(dto);
    toast({
      title: `${type === "note" ? "Note" : type === "call" ? "Call" : "Email"} logged`,
      description: record.name,
      tone: "success",
    });
  };

  const logInteraction = async (type: InteractionType, body: string) => {
    if (!selected) return;
    try {
      await logFor(selected, type, body);
    } catch (e) {
      toast({
        title: "Couldn't log interaction",
        description: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
    }
  };

  const deleteInteraction = async (interactionId: string) => {
    const before = records;
    setRecords((prev) =>
      prev.map((r) => ({
        ...r,
        interactions: r.interactions.filter((i) => i.id !== interactionId),
      })),
    );
    try {
      await api.deleteInteraction(interactionId);
      toast({ title: "Log entry removed", tone: "info" });
    } catch (e) {
      setRecords(before);
      toast({
        title: "Couldn't remove that entry",
        description: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
    }
  };

  const setNextActionFor = async (
    record: RecordDTO,
    nextAction: string,
    nextActionDate: string | null,
  ) => {
    const dto = await api.updateRecord(record.id, {
      nextAction,
      nextActionDate,
    });
    replace(dto);
    toast({
      title: "Next action set",
      description: `${record.name} · ${nextAction}`,
      tone: "success",
    });
  };

  /** Dealer application is in — forward to In Conversation, with a note. */
  const markApplied = async (record: RecordDTO) => {
    try {
      const moved = await api.updateRecord(record.id, {
        status: APPLIED_STAGE,
        lastContactDate: new Date().toISOString(),
      });
      replace(moved);
      const logged = await api.logInteraction(record.id, {
        type: "note",
        body: "Dealer application submitted",
      });
      replace(logged);
      toast({
        title: `${record.name} marked applied`,
        description: `Moved to ${STAGE_MAP[APPLIED_STAGE]?.label ?? APPLIED_STAGE}`,
        tone: "success",
      });
    } catch (e) {
      toast({
        title: "Couldn't mark applied",
        description: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
    }
  };

  const onQuickAction = (record: RecordDTO, action: QuickAction) => {
    if (action === "open") {
      setCreating(false);
      setSelectedId(record.id);
      return;
    }
    if (action === "applied") {
      void markApplied(record);
      return;
    }
    setQuick({ id: record.id, action });
  };

  const deleteRecord = async () => {
    if (!selected) return;
    const name = selected.name;
    try {
      await api.deleteRecord(selected.id);
      setRecords((prev) => prev.filter((r) => r.id !== selected.id));
      setConfirmDelete(false);
      setSelectedId(null);
      toast({ title: `${name} removed`, tone: "info" });
    } catch (e) {
      toast({
        title: "Delete failed",
        description: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
    }
  };

  const importRows = async (rows: ParsedSupplier[], updateStages: boolean) => {
    try {
      const result = await api.importRecords(rows, updateStages);
      const fresh = await api.listRecords();
      setRecords(fresh);
      toast({
        title: "Import complete",
        description: `${result.created} created · ${result.updated} updated${
          result.stagesChanged ? ` · ${result.stagesChanged} moved stage` : ""
        }`,
        tone: "success",
      });
    } catch (e) {
      toast({
        title: "Import failed",
        description: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
      throw e;
    }
  };

  const leadCount = records.filter((r) => r.type === "lead").length;
  const supplierCount = records.filter((r) => r.type === "supplier").length;

  const showClosed = isSupplier && scope === "closed";

  const noun = recordType === "lead" ? "leads" : "suppliers";
  const clearFilters = () => setFilters(defaultFilters);
  const startCreate = () => {
    setSelectedId(null);
    setCreating(true);
  };

  /** What to say when the board/table comes back empty. */
  const emptyState = filters.followUpOnly
    ? {
        title: `No ${noun} need follow-up today`,
        body: "Nothing is due or overdue in this view. Clear the follow-up filter to see the rest of the pipeline.",
        onClearFilters: clearFilters,
      }
    : isFiltered(filters)
      ? {
          title: "Nothing matches these filters",
          body: `There are ${pipelineRecords.length} ${noun} in the pipeline, but none match the current search and filters.`,
          onClearFilters: clearFilters,
        }
      : {
          title: `No ${noun} in the pipeline yet`,
          body:
            recordType === "lead"
              ? "Leads arrive from Shopify and Gmail, or you can add one by hand."
              : "Add a supplier by hand, or import the outreach sheet to fill the board.",
          onCreate: startCreate,
          createLabel: recordType === "lead" ? "New lead" : "New supplier",
        };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">
            {isSupplier ? "Supplier CRM" : "Lead CRM"}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            {isSupplier && scope === "pipeline" && activeProfile
              ? `${activeProfile.name}'s supplier list · `
              : `${supplierCount} suppliers · ${leadCount} leads · `}
            {followUpCount > 0
              ? `${followUpCount} need follow-up`
              : "no follow-ups due"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SegmentedControl
            ariaLabel="Record type"
            segments={RECORD_TYPES.map((t) => ({ id: t.id, label: t.label }))}
            value={recordType}
            onChange={(id) => {
              setRecordType(id as RecordType);
              setScope("pipeline");
              if (id === "supplier" && profiles[0]) {
                setActiveProfileId(profiles[0].id);
              }
              setFilters(defaultFilters);
            }}
          />
          {isSupplier ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setImportOpen(true)}
              >
                <Upload size={14} aria-hidden />
                Import
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  window.location.href = `/api/records/export?type=${recordType}`;
                }}
              >
                <Download size={14} aria-hidden />
                Export
              </Button>
            </>
          ) : null}
          {/* Change the CRM itself — a real agent run, reviewed before
              it ships (see /self-modify). */}
          <Link
            href="/self-modify"
            className="press inline-flex h-8 items-center gap-1.5 rounded-control border border-hairline bg-[var(--panel)] px-3 text-[13px] font-medium text-ink shadow-sm hover:border-[var(--hairline-strong)]"
            title="Ask for a change to the CRM itself"
          >
            <Bot size={14} aria-hidden />
            Change this panel
          </Link>
          <Button
            variant="primary"
            size="sm"
            onClick={startCreate}
          >
            <Plus size={14} aria-hidden />
            {recordType === "lead" ? "New lead" : "New supplier"}
          </Button>
        </div>
      </header>

      {isSupplier ? (
        <nav
          aria-label="Supplier profiles"
          className="flex items-center gap-2 overflow-x-auto border-b border-hairline pb-2"
        >
          {profiles.map((profile) => {
            const count = activeRecords.filter(
              (record) => record.supplierOwnerId === profile.id,
            ).length;
            const active =
              scope === "pipeline" && activeProfileId === profile.id;
            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => {
                  setActiveProfileId(profile.id);
                  setScope("pipeline");
                  setFilters(defaultFilters);
                }}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "press inline-flex shrink-0 items-center gap-2 rounded-control border px-3 py-2 text-sm font-medium",
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-ink"
                    : "border-hairline bg-[var(--panel-soft)] text-muted hover:text-ink",
                )}
              >
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-[#07111f]"
                  style={{ background: profile.color }}
                  aria-hidden
                >
                  {profile.initials}
                </span>
                {profile.name}
                <span
                  className={cn(
                    "num rounded-full px-1.5 py-0.5 text-[11px]",
                    active
                      ? "bg-[var(--accent-soft)] text-accent-bright"
                      : "bg-[var(--panel-soft)] text-muted",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setScope("closed");
              setFilters(defaultFilters);
            }}
            aria-current={scope === "closed" ? "page" : undefined}
            className={cn(
              "press inline-flex shrink-0 items-center gap-2 rounded-control border px-3 py-2 text-sm font-medium",
              scope === "closed"
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-ink"
                : "border-hairline bg-[var(--panel-soft)] text-muted hover:text-ink",
            )}
          >
            <Archive size={15} aria-hidden />
            Closed suppliers
            <span className="num rounded-full bg-[var(--panel-soft)] px-1.5 py-0.5 text-[11px] text-muted">
              {closedRecords.length}
            </span>
          </button>
        </nav>
      ) : null}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {showClosed ? (
          <>
            <StatTile
              label="Closed total"
              value={closedRecords.length}
              sub="deals decided"
              icon={Archive}
            />
            <StatTile
              label="Authorized dealers"
              value={authorizedCount}
              sub="closed-won"
              icon={BadgeCheck}
              tone="green"
            />
            <StatTile
              label="Gold dealers"
              value={goldDealers}
              sub="among authorized"
              icon={Medal}
              tone={goldDealers > 0 ? "accent" : "default"}
            />
            <StatTile
              label="Declined"
              value={declinedCount}
              sub="closed-lost"
              icon={XCircle}
              tone={declinedCount > 0 ? "danger" : "default"}
            />
          </>
        ) : (
          <>
            <StatTile
              label={
                recordType === "lead"
                  ? "Total leads"
                  : `${activeProfile?.name ?? "Profile"}'s suppliers`
              }
              value={pipelineRecords.length}
              icon={isSupplier ? UserRound : Users}
              tone="accent"
            />
            {isSupplier ? (
              <StatTile
                label="Gold rank"
                value={goldCount}
                sub={`${silverCount} Silver · ${bronzeCount} Bronze`}
                icon={Medal}
              />
            ) : (
              <StatTile
                label="Claude-owned"
                value={claudeOwned}
                sub="next move is Claude's"
                icon={Medal}
              />
            )}
            <StatTile
              label="In motion"
              value={inMotion}
              sub="contacted or further"
              icon={Waypoints}
            />
            <StatTile
              label="Needs follow-up"
              value={followUpCount}
              sub="due today or overdue"
              icon={Clock}
              tone={followUpCount > 0 ? "amber" : "default"}
            />
          </>
        )}
      </div>

      {showClosed ? (
        <ClosedView records={closedRecords} onSelect={setSelectedId} />
      ) : (
        <>
          <FilterBar
            recordType={recordType}
            stageOptions={facets.stageOptions}
            clusterOptions={facets.clusterOptions}
            rankOptions={facets.rankOptions}
            unrankedCount={facets.unranked}
            filters={filters}
            onChange={setFilters}
            onClear={clearFilters}
            view={view}
            onViewChange={setView}
            followUpCount={followUpCount}
          />

          {/* Both views read `filtered` and `records`, so the board and
              the table always agree and the view toggle keeps the
              active filters. */}
          {view === "board" ? (
            <Board
              records={filtered}
              stages={pipelineStages}
              closeTargets={isSupplier ? CLOSED_SUPPLIER_STAGES : undefined}
              onMoveStage={moveStage}
              onSelect={setSelectedId}
              onQuickAction={onQuickAction}
              empty={emptyState}
            />
          ) : (
            <TableView
              records={filtered}
              recordType={recordType}
              onSelect={setSelectedId}
              onQuickAction={onQuickAction}
              emptyMessage={`${emptyState.title} — ${emptyState.body}`}
            />
          )}
        </>
      )}

      <RecordDrawer
        record={creating ? null : selected}
        createType={recordType}
        profiles={profiles}
        defaultSupplierOwnerId={activeProfileId}
        clusterOptions={allClusters}
        open={creating || selected !== null}
        onClose={() => {
          setCreating(false);
          setSelectedId(null);
        }}
        onSave={saveRecord}
        onDelete={() => setConfirmDelete(true)}
        onLogInteraction={logInteraction}
        onDeleteInteraction={deleteInteraction}
        onQuickAction={onQuickAction}
      />

      <QuickActionDialog
        key={quick ? `${quick.id}:${quick.action}` : "quick-idle"}
        record={quickRecord}
        action={quick?.action ?? null}
        onClose={() => setQuick(null)}
        onLog={logFor}
        onSetNextAction={setNextActionFor}
      />

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete record?"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={deleteRecord}>
              Delete permanently
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {selected
            ? `“${selected.name}” and its activity log will be permanently removed. This cannot be undone.`
            : ""}
        </p>
      </Modal>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        existing={records}
        onImport={importRows}
      />
    </div>
  );
}
