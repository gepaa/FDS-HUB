"use client";

import { needsFollowUp, STAGES, type SupplierDTO } from "@/lib/domain";
import { shortDate } from "@/lib/utils";
import { DataTable, type Column } from "@/components/kit/DataTable";
import { RankBadge, StageBadge } from "@/components/crm/badges";
import { GlassPanel } from "@/components/kit/GlassPanel";

const RANK_ORDER: Record<string, number> = { Gold: 0, Silver: 1, Bronze: 2 };
const STAGE_ORDER = Object.fromEntries(STAGES.map((s, i) => [s.id, i]));

interface TableViewProps {
  suppliers: SupplierDTO[];
  onSelect: (id: string) => void;
}

export function TableView({ suppliers, onSelect }: TableViewProps) {
  const columns: Column<SupplierDTO>[] = [
    {
      key: "name",
      header: "Supplier",
      accessor: (s) => (
        <div className="min-w-0 max-w-56">
          <p className="truncate font-medium text-ink">{s.name}</p>
          {s.niche ? (
            <p className="truncate text-xs text-muted">{s.niche}</p>
          ) : null}
        </div>
      ),
      sortValue: (s) => s.name.toLowerCase(),
    },
    {
      key: "rank",
      header: "Rank",
      accessor: (s) => <RankBadge rank={s.rank} />,
      sortValue: (s) => (s.rank ? RANK_ORDER[s.rank] ?? 3 : 4),
      width: "90px",
    },
    {
      key: "cluster",
      header: "Cluster",
      accessor: (s) => (
        <span className="text-xs text-muted">{s.cluster}</span>
      ),
      sortValue: (s) => s.cluster,
    },
    {
      key: "stage",
      header: "Stage",
      accessor: (s) => <StageBadge stage={s.stage} />,
      sortValue: (s) => STAGE_ORDER[s.stage] ?? 99,
      width: "140px",
    },
    {
      key: "contact",
      header: "Contact",
      accessor: (s) => (
        <div className="max-w-48 text-xs">
          {s.email ? <p className="truncate text-ink">{s.email}</p> : null}
          {s.phone ? <p className="truncate text-muted">{s.phone}</p> : null}
          {!s.email && !s.phone ? (
            <span className="text-muted">—</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "lastContact",
      header: "Last contact",
      accessor: (s) => (
        <span className="num text-xs text-muted">
          {shortDate(s.lastContactDate)}
        </span>
      ),
      sortValue: (s) =>
        s.lastContactDate ? new Date(s.lastContactDate).getTime() : null,
      width: "110px",
    },
    {
      key: "nextAction",
      header: "Next action",
      accessor: (s) => {
        const due = needsFollowUp(s);
        return (
          <div className="max-w-40 text-xs">
            <p className="truncate text-ink">{s.nextAction ?? "—"}</p>
            {s.nextActionDate ? (
              <p className={due ? "font-medium text-amber" : "text-muted"}>
                {due ? "Due " : ""}
                {shortDate(s.nextActionDate)}
              </p>
            ) : null}
          </div>
        );
      },
      sortValue: (s) =>
        s.nextActionDate ? new Date(s.nextActionDate).getTime() : null,
    },
    {
      key: "log",
      header: "Log",
      accessor: (s) => (
        <span className="num text-xs text-muted">
          {s.interactions.length || "—"}
        </span>
      ),
      sortValue: (s) => s.interactions.length,
      width: "60px",
      align: "right",
    },
  ];

  return (
    <GlassPanel className="p-2">
      <DataTable
        columns={columns}
        rows={suppliers}
        rowKey={(s) => s.id}
        onRowClick={(s) => onSelect(s.id)}
        initialSort={{ key: "name", dir: "asc" }}
        emptyMessage="No suppliers match the current filters."
      />
    </GlassPanel>
  );
}
