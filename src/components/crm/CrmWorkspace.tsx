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
  type InteractionType,
  type StageId,
  type SupplierDTO,
} from "@/lib/domain";
import type { ParsedSupplier } from "@/lib/csv";
import { api } from "@/lib/api";
import { useToast } from "@/components/kit/Toast";
import { Button } from "@/components/kit/Button";
import { StatTile } from "@/components/kit/StatTile";
import { Modal } from "@/components/kit/Modal";
import { Board } from "@/components/crm/Board";
import { TableView } from "@/components/crm/TableView";
import { FilterBar, type CrmFilters } from "@/components/crm/FilterBar";
import {
  SupplierDrawer,
  type SupplierFormData,
} from "@/components/crm/SupplierDrawer";
import { ImportModal } from "@/components/crm/ImportModal";

interface CrmWorkspaceProps {
  initial: SupplierDTO[];
  initialSupplierId?: string;
  initialCreate?: boolean;
}

const defaultFilters: CrmFilters = {
  search: "",
  cluster: null,
  rank: null,
  stage: null,
  followUpOnly: false,
};

export function CrmWorkspace({
  initial,
  initialSupplierId,
  initialCreate,
}: CrmWorkspaceProps) {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<SupplierDTO[]>(initial);
  const [view, setView] = useState<"board" | "table">("board");
  const [filters, setFilters] = useState<CrmFilters>(defaultFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Deep links: /crm?supplier=<id> and /crm?new=1
  useEffect(() => {
    if (initialSupplierId) setSelectedId(initialSupplierId);
  }, [initialSupplierId]);
  useEffect(() => {
    if (initialCreate) setCreating(true);
  }, [initialCreate]);

  const selected = useMemo(
    () => suppliers.find((s) => s.id === selectedId) ?? null,
    [suppliers, selectedId],
  );

  const replace = (dto: SupplierDTO) =>
    setSuppliers((prev) => prev.map((s) => (s.id === dto.id ? dto : s)));

  // ---------- derived ----------
  const clusterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of suppliers) counts[s.cluster] = (counts[s.cluster] ?? 0) + 1;
    return counts;
  }, [suppliers]);

  const followUpCount = useMemo(
    () => suppliers.filter(needsFollowUp).length,
    [suppliers],
  );

  const goldCount = suppliers.filter((s) => s.rank === "Gold").length;
  const silverCount = suppliers.filter((s) => s.rank === "Silver").length;
  const bronzeCount = suppliers.filter((s) => s.rank === "Bronze").length;
  const inMotion = suppliers.filter(
    (s) => s.stage !== "NOT_CONTACTED" && s.stage !== "REJECTED",
  ).length;

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return suppliers.filter((s) => {
      if (
        q &&
        ![s.name, s.niche, s.email, s.mainContact, s.phone, s.bestSeller]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(q))
      )
        return false;
      if (filters.cluster && s.cluster !== filters.cluster) return false;
      if (filters.rank === "unranked") {
        if (s.rank) return false;
      } else if (filters.rank && s.rank !== filters.rank) {
        return false;
      }
      if (view === "table" && filters.stage && s.stage !== filters.stage)
        return false;
      if (filters.followUpOnly && !needsFollowUp(s)) return false;
      return true;
    });
  }, [suppliers, filters, view]);

  // ---------- mutations ----------
  const moveStage = async (id: string, stage: StageId) => {
    const before = suppliers;
    setSuppliers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, stage } : s)),
    );
    try {
      const dto = await api.updateSupplier(id, { stage });
      replace(dto);
    } catch (e) {
      setSuppliers(before);
      toast({
        title: "Couldn't move supplier",
        description: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
    }
  };

  const saveSupplier = async (data: SupplierFormData) => {
    try {
      if (creating) {
        const dto = await api.createSupplier(data);
        setSuppliers((prev) =>
          [...prev, dto].sort((a, b) => a.name.localeCompare(b.name)),
        );
        setCreating(false);
        setSelectedId(dto.id);
        toast({ title: `${dto.name} added to the pipeline`, tone: "success" });
      } else if (selected) {
        const dto = await api.updateSupplier(selected.id, data);
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

  const quickPatch = async (patch: Partial<SupplierFormData>) => {
    if (!selected) return;
    try {
      const dto = await api.updateSupplier(selected.id, patch);
      replace(dto);
      toast({ title: "Updated", tone: "success" });
    } catch (e) {
      toast({
        title: "Update failed",
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

  const deleteSupplier = async () => {
    if (!selected) return;
    const name = selected.name;
    try {
      await api.deleteSupplier(selected.id);
      setSuppliers((prev) => prev.filter((s) => s.id !== selected.id));
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
      const result = await api.importSuppliers(rows);
      const fresh = await fetch("/api/suppliers").then(
        (r) => r.json() as Promise<SupplierDTO[]>,
      );
      setSuppliers(fresh);
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

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Supplier CRM
          </h1>
          <p className="mt-1 text-sm text-muted">
            {suppliers.length} suppliers ·{" "}
            {followUpCount > 0
              ? `${followUpCount} need follow-up`
              : "no follow-ups due"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setImportOpen(true)}>
            <Upload size={14} aria-hidden />
            Import
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              window.location.href = "/api/suppliers/export";
            }}
          >
            <Download size={14} aria-hidden />
            Export
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setSelectedId(null);
              setCreating(true);
            }}
          >
            <Plus size={14} aria-hidden />
            New supplier
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          label="Total suppliers"
          value={suppliers.length}
          icon={Users}
          tone="accent"
        />
        <StatTile
          label="Gold rank"
          value={goldCount}
          sub={`${silverCount} Silver · ${bronzeCount} Bronze`}
          icon={Medal}
        />
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
        filters={filters}
        onChange={setFilters}
        view={view}
        onViewChange={setView}
        clusterCounts={clusterCounts}
        followUpCount={followUpCount}
      />

      {view === "board" ? (
        <Board
          suppliers={filtered}
          onMoveStage={moveStage}
          onSelect={setSelectedId}
        />
      ) : (
        <TableView suppliers={filtered} onSelect={setSelectedId} />
      )}

      <SupplierDrawer
        supplier={creating ? null : selected}
        open={creating || selected !== null}
        onClose={() => {
          setCreating(false);
          setSelectedId(null);
        }}
        onSave={saveSupplier}
        onDelete={() => setConfirmDelete(true)}
        onLogInteraction={logInteraction}
        onQuickAction={quickPatch}
      />

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete supplier?"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={deleteSupplier}>
              Delete permanently
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {selected
            ? `“${selected.name}” and its interaction log will be permanently removed. This cannot be undone.`
            : ""}
        </p>
      </Modal>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        existing={suppliers}
        onImport={importRows}
      />
    </div>
  );
}
