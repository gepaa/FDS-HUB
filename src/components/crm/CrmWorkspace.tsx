"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Clock,
  Download,
  Medal,
  Plus,
  Upload,
  Users,
  Waypoints,
} from "lucide-react";
import {
  needsFollowUp,
  RECORD_TYPES,
  type InteractionType,
  type RecordDTO,
  type RecordType,
  type StageId,
} from "@/lib/domain";
import type { ParsedSupplier } from "@/lib/csv";
import { api } from "@/lib/api";
import { useToast } from "@/components/kit/Toast";
import { Button } from "@/components/kit/Button";
import { StatTile } from "@/components/kit/StatTile";
import { Modal } from "@/components/kit/Modal";
import { SegmentedControl } from "@/components/kit/SegmentedControl";
import { Board } from "@/components/crm/Board";
import { TableView } from "@/components/crm/TableView";
import { FilterBar, type CrmFilters } from "@/components/crm/FilterBar";
import {
  RecordDrawer,
  type RecordFormData,
} from "@/components/crm/RecordDrawer";
import { ImportModal } from "@/components/crm/ImportModal";

interface CrmWorkspaceProps {
  initial: RecordDTO[];
  initialRecordId?: string;
  initialCreate?: boolean;
}

const defaultFilters: CrmFilters = {
  search: "",
  cluster: null,
  rank: null,
  stage: null,
  owner: null,
  followUpOnly: false,
};

export function CrmWorkspace({
  initial,
  initialRecordId,
  initialCreate,
}: CrmWorkspaceProps) {
  const { toast } = useToast();
  const [records, setRecords] = useState<RecordDTO[]>(initial);
  const [recordType, setRecordType] = useState<RecordType>("supplier");
  const [view, setView] = useState<"board" | "table">("board");
  const [filters, setFilters] = useState<CrmFilters>(defaultFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Deep links: /crm?record=<id> and /crm?new=1
  useEffect(() => {
    if (initialRecordId) {
      setSelectedId(initialRecordId);
      const r = initial.find((x) => x.id === initialRecordId);
      if (r) setRecordType(r.type);
    }
  }, [initialRecordId, initial]);
  useEffect(() => {
    if (initialCreate) setCreating(true);
  }, [initialCreate]);

  const selected = useMemo(
    () => records.find((r) => r.id === selectedId) ?? null,
    [records, selectedId],
  );

  const replace = (dto: RecordDTO) =>
    setRecords((prev) => prev.map((r) => (r.id === dto.id ? dto : r)));

  // ---------- derived ----------
  const ofType = useMemo(
    () => records.filter((r) => r.type === recordType),
    [records, recordType],
  );

  const clusterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of ofType) counts[r.cluster] = (counts[r.cluster] ?? 0) + 1;
    return counts;
  }, [ofType]);

  const followUpCount = useMemo(
    () => ofType.filter(needsFollowUp).length,
    [ofType],
  );

  const goldCount = ofType.filter((r) => r.rank === "Gold").length;
  const silverCount = ofType.filter((r) => r.rank === "Silver").length;
  const bronzeCount = ofType.filter((r) => r.rank === "Bronze").length;
  const claudeOwned = ofType.filter((r) => r.owner === "claude").length;
  const inMotion = ofType.filter(
    (r) => !["SOURCED", "QUALIFIED", "NEW", "DECLINED", "LOST"].includes(r.status),
  ).length;

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return ofType.filter((r) => {
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
      if (filters.owner && r.owner !== filters.owner) return false;
      if (view === "table" && filters.stage && r.status !== filters.stage)
        return false;
      if (filters.followUpOnly && !needsFollowUp(r)) return false;
      return true;
    });
  }, [ofType, filters, view]);

  // ---------- mutations ----------
  const moveStage = async (id: string, status: StageId) => {
    const before = records;
    setRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r)),
    );
    try {
      const dto = await api.updateRecord(id, { status });
      replace(dto);
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

  const logInteraction = async (type: InteractionType, body: string) => {
    if (!selected) return;
    try {
      const dto = await api.logInteraction(selected.id, { type, body });
      replace(dto);
      toast({ title: "Interaction logged", tone: "success" });
    } catch (e) {
      toast({
        title: "Couldn't log interaction",
        description: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
    }
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

  const importRows = async (rows: ParsedSupplier[]) => {
    try {
      const result = await api.importRecords(rows);
      const fresh = await api.listRecords();
      setRecords(fresh);
      toast({
        title: "Import complete",
        description: `${result.created} created · ${result.updated} updated`,
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

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            CRM
          </h1>
          <p className="mt-1 text-sm text-muted">
            {supplierCount} suppliers · {leadCount} leads ·{" "}
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
              setFilters(defaultFilters);
            }}
          />
          {recordType === "supplier" ? (
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
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setSelectedId(null);
              setCreating(true);
            }}
          >
            <Plus size={14} aria-hidden />
            {recordType === "lead" ? "New lead" : "New supplier"}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          label={recordType === "lead" ? "Total leads" : "Total suppliers"}
          value={ofType.length}
          icon={Users}
          tone="accent"
        />
        {recordType === "supplier" ? (
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
      </div>

      <FilterBar
        recordType={recordType}
        filters={filters}
        onChange={setFilters}
        view={view}
        onViewChange={setView}
        clusterCounts={clusterCounts}
        followUpCount={followUpCount}
      />

      {view === "board" ? (
        <Board
          records={filtered}
          recordType={recordType}
          onMoveStage={moveStage}
          onSelect={setSelectedId}
        />
      ) : (
        <TableView
          records={filtered}
          recordType={recordType}
          onSelect={setSelectedId}
        />
      )}

      <RecordDrawer
        record={creating ? null : selected}
        createType={recordType}
        open={creating || selected !== null}
        onClose={() => {
          setCreating(false);
          setSelectedId(null);
        }}
        onSave={saveRecord}
        onDelete={() => setConfirmDelete(true)}
        onLogInteraction={logInteraction}
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
