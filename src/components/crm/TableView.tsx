"use client";

import {
  needsFollowUp,
  stagesFor,
  type RecordDTO,
  type RecordType,
} from "@/lib/domain";
import { shortDate } from "@/lib/utils";
import { DataTable, type Column } from "@/components/kit/DataTable";
import {
  OwnerBadge,
  PriorityBadge,
  RankBadge,
  StageBadge,
} from "@/components/crm/badges";
import { GlassPanel } from "@/components/kit/GlassPanel";

const RANK_ORDER: Record<string, number> = { Gold: 0, Silver: 1, Bronze: 2 };
const PRIORITY_ORDER: Record<string, number> = { hot: 0, warm: 1, cold: 2 };

interface TableViewProps {
  records: RecordDTO[];
  recordType: RecordType;
  onSelect: (id: string) => void;
}

export function TableView({ records, recordType, onSelect }: TableViewProps) {
  const stageOrder = Object.fromEntries(
    stagesFor(recordType).map((s, i) => [s.id, i]),
  );

  const columns: Column<RecordDTO>[] = [
    {
      key: "name",
      header: recordType === "lead" ? "Lead" : "Supplier",
      accessor: (r) => (
        <div className="max-w-56 min-w-0">
          <p className="truncate font-medium text-ink">{r.name}</p>
          <p className="truncate text-xs text-muted">
            {r.type === "lead"
              ? (r.productInterest ?? r.company ?? "")
              : (r.niche ?? "")}
          </p>
        </div>
      ),
      sortValue: (r) => r.name.toLowerCase(),
    },
    ...(recordType === "supplier"
      ? [
          {
            key: "rank",
            header: "Rank",
            accessor: (r) => <RankBadge rank={r.rank} />,
            sortValue: (r) => (r.rank ? (RANK_ORDER[r.rank] ?? 3) : 4),
            width: "90px",
          } as Column<RecordDTO>,
          {
            key: "cluster",
            header: "Cluster",
            accessor: (r) => (
              <span className="text-xs text-muted">{r.cluster}</span>
            ),
            sortValue: (r) => r.cluster,
          } as Column<RecordDTO>,
        ]
      : []),
    {
      key: "status",
      header: "Status",
      accessor: (r) => <StageBadge stage={r.status} />,
      sortValue: (r) => stageOrder[r.status] ?? 99,
      width: "150px",
    },
    {
      key: "priority",
      header: "Priority",
      accessor: (r) =>
        r.priority ? (
          <PriorityBadge priority={r.priority} />
        ) : (
          <span className="text-xs text-muted">—</span>
        ),
      sortValue: (r) => (r.priority ? (PRIORITY_ORDER[r.priority] ?? 3) : 4),
      width: "80px",
    },
    {
      key: "owner",
      header: "Owner",
      accessor: (r) =>
        r.owner === "unassigned" ? (
          <span className="text-xs text-muted">—</span>
        ) : (
          <OwnerBadge owner={r.owner} />
        ),
      sortValue: (r) => r.owner,
      width: "90px",
    },
    {
      key: "context",
      header: "Context",
      accessor: (r) => (
        <p className="max-w-64 truncate text-xs text-muted">
          {r.contextSummary ?? "—"}
        </p>
      ),
    },
    {
      key: "nextAction",
      header: "Next action",
      accessor: (r) => {
        const due = needsFollowUp(r);
        return (
          <div className="max-w-40 text-xs">
            <p className="truncate text-ink">{r.nextAction ?? "—"}</p>
            {r.nextActionDate ? (
              <p className={due ? "font-medium text-amber" : "text-muted"}>
                {due ? "Due " : ""}
                {shortDate(r.nextActionDate)}
              </p>
            ) : null}
          </div>
        );
      },
      sortValue: (r) =>
        r.nextActionDate ? new Date(r.nextActionDate).getTime() : null,
    },
    {
      key: "log",
      header: "Log",
      accessor: (r) => (
        <span className="num text-xs text-muted">
          {r.interactions.length || "—"}
        </span>
      ),
      sortValue: (r) => r.interactions.length,
      width: "60px",
      align: "right",
    },
  ];

  return (
    <GlassPanel className="p-2">
      <DataTable
        columns={columns}
        rows={records}
        rowKey={(r) => r.id}
        onRowClick={(r) => onSelect(r.id)}
        initialSort={{ key: "name", dir: "asc" }}
        emptyMessage="No records match the current filters."
      />
    </GlassPanel>
  );
}
