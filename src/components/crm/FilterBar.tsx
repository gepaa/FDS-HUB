"use client";

import { Columns3, Search, TableProperties } from "lucide-react";
import { CLUSTERS, RANKS, STAGES } from "@/lib/domain";
import { Chip } from "@/components/kit/Chip";
import { Input, Select } from "@/components/kit/Field";
import { SegmentedControl } from "@/components/kit/SegmentedControl";

export interface CrmFilters {
  search: string;
  cluster: string | null;
  rank: string | null;
  stage: string | null;
  followUpOnly: boolean;
}

interface FilterBarProps {
  filters: CrmFilters;
  onChange: (next: CrmFilters) => void;
  view: "board" | "table";
  onViewChange: (view: "board" | "table") => void;
  clusterCounts: Record<string, number>;
  followUpCount: number;
}

export function FilterBar({
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
            aria-label="Filter suppliers"
          />
        </div>

        <Select
          value={filters.rank ?? ""}
          onChange={(e) => set({ rank: e.target.value || null })}
          aria-label="Filter by rank"
          className="w-32"
        >
          <option value="">All ranks</option>
          {RANKS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
          <option value="unranked">Unranked</option>
        </Select>

        {view === "table" ? (
          <Select
            value={filters.stage ?? ""}
            onChange={(e) => set({ stage: e.target.value || null })}
            aria-label="Filter by stage"
            className="w-40"
          >
            <option value="">All stages</option>
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
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
    </div>
  );
}
