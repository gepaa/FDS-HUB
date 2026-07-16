"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  CLOSED_SUPPLIER_STAGES,
  type RecordDTO,
} from "@/lib/domain";
import { shortDate } from "@/lib/utils";
import { DataTable, type Column } from "@/components/kit/DataTable";
import { GlassPanel } from "@/components/kit/GlassPanel";
import { Chip } from "@/components/kit/Chip";
import { Input } from "@/components/kit/Field";
import { RankBadge, StageBadge } from "@/components/crm/badges";

interface ClosedViewProps {
  /** Closed suppliers only (AUTHORIZED / DECLINED). */
  records: RecordDTO[];
  onSelect: (id: string) => void;
}

/**
 * The closed book: every supplier whose deal is decided, out of the
 * pipeline's way. Filter by outcome, search, click a row to manage
 * the record. Reopening = changing status in the drawer.
 */
export function ClosedView({ records, onSelect }: ClosedViewProps) {
  const [stage, setStage] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of records) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [records]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (stage && r.status !== stage) return false;
      if (
        q &&
        ![r.name, r.niche, r.email, r.mainContact, r.company, r.cluster]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(q))
      )
        return false;
      return true;
    });
  }, [records, stage, search]);

  const columns: Column<RecordDTO>[] = [
    {
      key: "name",
      header: "Supplier",
      accessor: (r) => (
        <div className="max-w-56 min-w-0">
          <p className="truncate font-medium text-ink">{r.name}</p>
          <p className="truncate text-xs text-muted">{r.niche ?? ""}</p>
        </div>
      ),
      sortValue: (r) => r.name.toLowerCase(),
    },
    {
      key: "status",
      header: "Outcome",
      accessor: (r) => <StageBadge stage={r.status} />,
      sortValue: (r) => r.status,
      width: "160px",
    },
    {
      key: "rank",
      header: "Rank",
      accessor: (r) => <RankBadge rank={r.rank} />,
      sortValue: (r) => r.rank ?? "zz",
      width: "100px",
    },
    {
      key: "cluster",
      header: "Cluster",
      accessor: (r) => <span className="text-xs text-muted">{r.cluster}</span>,
      sortValue: (r) => r.cluster,
    },
    {
      key: "contact",
      header: "Contact",
      accessor: (r) => (
        <div className="max-w-52 text-xs">
          <p className="truncate text-ink">{r.mainContact ?? "—"}</p>
          <p className="truncate text-muted">{r.email ?? ""}</p>
        </div>
      ),
      sortValue: (r) => r.mainContact ?? r.email ?? "",
    },
    {
      key: "updated",
      header: "Last update",
      accessor: (r) => (
        <span className="num text-xs text-muted">{shortDate(r.updatedAt)}</span>
      ),
      sortValue: (r) => new Date(r.updatedAt).getTime(),
      width: "110px",
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-52 flex-1 md:max-w-xs">
          <Search
            size={14}
            aria-hidden
            className="absolute top-1/2 left-3 -translate-y-1/2 text-muted"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search closed suppliers…"
            className="pl-8"
            aria-label="Search closed suppliers"
          />
        </div>
        <Chip
          label="All closed"
          count={records.length}
          active={stage === null}
          onClick={() => setStage(null)}
        />
        {CLOSED_SUPPLIER_STAGES.map((s) => (
          <Chip
            key={s.id}
            label={s.label}
            count={counts[s.id] ?? 0}
            dot={s.color}
            active={stage === s.id}
            onClick={() => setStage(stage === s.id ? null : s.id)}
          />
        ))}
      </div>

      <GlassPanel className="p-2">
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(r) => r.id}
          onRowClick={(r) => onSelect(r.id)}
          initialSort={{ key: "updated", dir: "desc" }}
          emptyMessage="No closed suppliers yet. Drag a card onto “Close →” on the board, or set a record's status to Authorized Dealer or Declined."
        />
      </GlassPanel>
    </div>
  );
}
