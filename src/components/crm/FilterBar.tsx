"use client";

import { Columns3, Search, TableProperties, X } from "lucide-react";
import { OWNERS, type RecordType } from "@/lib/domain";
import { Chip } from "@/components/kit/Chip";
import { Button } from "@/components/kit/Button";
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

export interface FilterOption {
  id: string;
  label: string;
  count: number;
  /** Identity dot (stage/cluster color) where one exists. */
  color?: string;
}

interface FilterBarProps {
  recordType: RecordType;
  /**
   * Options are derived from the records actually in the DB (see
   * CrmWorkspace) rather than the domain constants — a cluster or rank
   * introduced by a later import has to be filterable too.
   */
  stageOptions: FilterOption[];
  clusterOptions: FilterOption[];
  rankOptions: FilterOption[];
  unrankedCount: number;
  filters: CrmFilters;
  onChange: (next: CrmFilters) => void;
  onClear: () => void;
  view: "board" | "table";
  onViewChange: (view: "board" | "table") => void;
  followUpCount: number;
}

/** True when any filter is narrowing the list. */
export function isFiltered(f: CrmFilters): boolean {
  return Boolean(
    f.search.trim() ||
      f.cluster ||
      f.rank ||
      f.stage ||
      f.owner ||
      f.followUpOnly,
  );
}

export function FilterBar({
  recordType,
  stageOptions,
  clusterOptions,
  rankOptions,
  unrankedCount,
  filters,
  onChange,
  onClear,
  view,
  onViewChange,
  followUpCount,
}: FilterBarProps) {
  const set = (patch: Partial<CrmFilters>) =>
    onChange({ ...filters, ...patch });
  const filtered = isFiltered(filters);

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

        {recordType === "supplier" && (rankOptions.length > 0 || unrankedCount > 0) ? (
          <div className="w-32 shrink-0">
            <Select
              value={filters.rank ?? ""}
              onChange={(e) => set({ rank: e.target.value || null })}
              aria-label="Filter by rank"
            >
              <option value="">All ranks</option>
              {rankOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label} ({r.count})
                </option>
              ))}
              {unrankedCount > 0 ? (
                <option value="unranked">Unranked ({unrankedCount})</option>
              ) : null}
            </Select>
          </div>
        ) : null}

        {recordType === "lead" ? (
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
        ) : null}

        {/* Shown in both views — the filter applies in both, so hiding
            it on the board left an invisible active filter. */}
        <div className="w-44 shrink-0">
          <Select
            value={filters.stage ?? ""}
            onChange={(e) => set({ stage: e.target.value || null })}
            aria-label="Filter by stage"
          >
            <option value="">All stages</option>
            {stageOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} ({s.count})
              </option>
            ))}
          </Select>
        </div>

        <Chip
          label={`Needs follow-up`}
          count={followUpCount}
          dot="var(--amber)"
          active={filters.followUpOnly}
          onClick={() => set({ followUpOnly: !filters.followUpOnly })}
        />

        {filtered ? (
          <Button variant="subtle" size="sm" onClick={onClear}>
            <X size={13} aria-hidden />
            Clear filters
          </Button>
        ) : null}

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

      {recordType === "supplier" && clusterOptions.length > 0 ? (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Chip
            label="All clusters"
            active={filters.cluster === null}
            onClick={() => set({ cluster: null })}
          />
          {clusterOptions.map((c) => (
            <Chip
              key={c.id}
              label={c.label}
              count={c.count}
              active={filters.cluster === c.id}
              onClick={() =>
                set({ cluster: filters.cluster === c.id ? null : c.id })
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
