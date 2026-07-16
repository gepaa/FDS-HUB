"use client";

import { Columns3, Search, TableProperties } from "lucide-react";
import {
  CLUSTERS,
  OWNERS,
  RANKS,
  type RecordType,
} from "@/lib/domain";
import { Chip } from "@/components/kit/Chip";
import { Input, Select } from "@/components/kit/Field";
import { SegmentedControl } from "@/components/kit/SegmentedControl";

export interface CrmFilters {
  search: string;
  cluster: string | null;
  rank: string | null;
  stage: string | null;
  owner: string | null;
  followUpOnly: boolean;
}

interface FilterBarProps {
  recordType: RecordType;
  /** Stages offered in the table's stage filter. */
  stages: readonly { id: string; label: string }[];
  filters: CrmFilters;
  onChange: (next: CrmFilters) => void;
  view: "board" | "table";
  onViewChange: (view: "board" | "table") => void;
  clusterCounts: Record<string, number>;
  followUpCount: number;
}

export function FilterBar({
  recordType,
  stages,
  filters,
  onChange,
  view,
  onViewChange,
  clusterCounts,
  followUpCount,
}: FilterBarProps) {
  const set = (patch: Partial<CrmFilters>) =>
    onChange({ ...filters, ...patch });

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
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
            placeholder="Filter by name, niche, contact…"
            className="pl-8"
            aria-label="Filter records"
          />
        </div>

        {recordType === "supplier" ? (
          <div className="w-32 shrink-0">
            <Select
              value={filters.rank ?? ""}
              onChange={(e) => set({ rank: e.target.value || null })}
              aria-label="Filter by rank"
            >
              <option value="">All ranks</option>
              {RANKS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
              <option value="unranked">Unranked</option>
            </Select>
          </div>
        ) : null}

        <div className="w-36 shrink-0">
          <Select
            value={filters.owner ?? ""}
            onChange={(e) => set({ owner: e.target.value || null })}
            aria-label="Filter by owner"
          >
            <option value="">All owners</option>
            {OWNERS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        {view === "table" ? (
          <div className="w-44 shrink-0">
            <Select
              value={filters.stage ?? ""}
              onChange={(e) => set({ stage: e.target.value || null })}
              aria-label="Filter by stage"
            >
              <option value="">All stages</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
        ) : null}

        <Chip
          label={`Needs follow-up`}
          count={followUpCount}
          dot="var(--amber)"
          active={filters.followUpOnly}
          onClick={() => set({ followUpOnly: !filters.followUpOnly })}
        />

        <div className="ml-auto">
          <SegmentedControl
            ariaLabel="CRM view"
            segments={[
              { id: "board", label: "Board", icon: Columns3 },
              { id: "table", label: "Table", icon: TableProperties },
            ]}
            value={view}
            onChange={(id) => onViewChange(id as "board" | "table")}
          />
        </div>
      </div>

      {recordType === "supplier" ? (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Chip
            label="All clusters"
            active={filters.cluster === null}
            onClick={() => set({ cluster: null })}
          />
          {CLUSTERS.map((c) => (
            <Chip
              key={c}
              label={c}
              count={clusterCounts[c] ?? 0}
              active={filters.cluster === c}
              onClick={() => set({ cluster: filters.cluster === c ? null : c })}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
