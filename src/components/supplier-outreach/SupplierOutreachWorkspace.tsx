"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Archive,
  BellRing,
  FileSpreadsheet,
  Plus,
  Search,
  Users,
  XCircle,
} from "lucide-react";
import {
  APPROVED_SUPPLIER_STAGE_SET,
  CLOSED_SUPPLIER_STAGE_SET,
  needsFollowUp,
  REJECTED_SUPPLIER_STAGE_SET,
  SUPPLIER_STAGES,
  type RecordDTO,
  type TeamProfileDTO,
} from "@/lib/domain";
import { cn } from "@/lib/utils";
import { SupplierCloseGoal } from "@/components/supplier-outreach/SupplierCloseGoal";
import { SupplierList } from "@/components/supplier-outreach/SupplierList";

interface SupplierOutreachWorkspaceProps {
  initial: RecordDTO[];
  profiles: TeamProfileDTO[];
}

const controlClass =
  "h-10 rounded-control border border-hairline bg-[var(--panel)] px-3 text-[13px] text-ink outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]";

export function SupplierOutreachWorkspace({
  initial,
  profiles,
}: SupplierOutreachWorkspaceProps) {
  const [activeProfileId, setActiveProfileId] = useState(
    profiles[0]?.id ?? "seat_1",
  );
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [followUpOnly, setFollowUpOnly] = useState(false);

  const approved = useMemo(
    () =>
      initial.filter((record) =>
        APPROVED_SUPPLIER_STAGE_SET.has(record.status),
      ),
    [initial],
  );
  const rejectedCount = useMemo(
    () =>
      initial.filter((record) =>
        REJECTED_SUPPLIER_STAGE_SET.has(record.status),
      ).length,
    [initial],
  );
  const profileRecords = useMemo(
    () =>
      initial.filter(
        (record) =>
          !CLOSED_SUPPLIER_STAGE_SET.has(record.status) &&
          record.supplierOwnerId === activeProfileId,
      ),
    [activeProfileId, initial],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return profileRecords.filter((record) => {
      if (
        query &&
        ![record.name, record.phone, record.websiteUrl]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      ) {
        return false;
      }
      if (status && record.status !== status) return false;
      if (followUpOnly && !needsFollowUp(record)) return false;
      return true;
    });
  }, [followUpOnly, profileRecords, search, status]);

  const dueCount = profileRecords.filter(needsFollowUp).length;
  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setFollowUpOnly(false);
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-muted uppercase">
            <FileSpreadsheet size={14} aria-hidden />
            Supplier calling workspace
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Supplier Outreach
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Active outreach only. Approved and rejected suppliers are kept in
            separate books.
          </p>
        </div>
        <Link
          href="/supplier-outreach/new"
          className="press inline-flex h-10 items-center justify-center gap-2 rounded-control border border-transparent bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-fg)] shadow-sm hover:brightness-105"
        >
          <Plus size={15} aria-hidden />
          Add supplier
        </Link>
      </header>

      <SupplierCloseGoal authorizedCount={approved.length} />

      <section className="surface-raised overflow-hidden rounded-panel">
        <div className="flex flex-wrap items-center gap-2 border-b border-hairline p-3">
          {profiles.map((profile) => {
            const count = initial.filter(
              (record) =>
                record.supplierOwnerId === profile.id &&
                !CLOSED_SUPPLIER_STAGE_SET.has(record.status),
            ).length;
            const active = activeProfileId === profile.id;
            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => {
                  setActiveProfileId(profile.id);
                  setStatus("");
                }}
                className={cn(
                  "press flex h-10 items-center gap-2 rounded-control border px-3 text-sm font-medium transition",
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-ink"
                    : "border-hairline bg-[var(--panel)] text-muted hover:text-ink",
                )}
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white"
                  style={{ backgroundColor: profile.color }}
                >
                  {profile.initials}
                </span>
                {profile.name}
                <span className="num text-[11px] text-muted">{count}</span>
              </button>
            );
          })}

          <div className="mx-1 hidden h-6 w-px bg-[var(--hairline)] sm:block" />

          <Link
            href="/supplier-outreach/closed"
            className="press flex h-10 items-center gap-2 rounded-control border border-hairline bg-[var(--panel)] px-3 text-sm font-medium text-muted transition hover:border-[var(--green)] hover:text-ink"
          >
            <Archive size={15} aria-hidden />
            Approved / Closed
            <span className="num text-[11px] text-muted">{approved.length}</span>
          </Link>

          <Link
            href="/supplier-outreach/rejected"
            className="press flex h-10 items-center gap-2 rounded-control border border-hairline px-3 text-sm font-medium text-muted transition hover:text-ink"
          >
            <XCircle size={15} aria-hidden />
            Rejected
            <span className="num text-[11px] text-muted">{rejectedCount}</span>
          </Link>

          <div className="ml-auto hidden items-center gap-3 text-xs text-muted md:flex">
            <span className="flex items-center gap-1.5">
              <Users size={14} aria-hidden />
              {profileRecords.length} suppliers
            </span>
            <span
              className={cn(
                "flex items-center gap-1.5",
                dueCount > 0 && "font-medium text-amber",
              )}
            >
              <BellRing size={14} aria-hidden />
              {dueCount} due
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-b border-hairline bg-[var(--panel-soft)] p-3 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, phone, or website…"
              className={cn(controlClass, "w-full pl-9")}
            />
          </label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className={cn(controlClass, "sm:w-44")}
            aria-label="Filter by status"
          >
            <option value="">All active statuses</option>
            {SUPPLIER_STAGES.filter(
              (stage) => !CLOSED_SUPPLIER_STAGE_SET.has(stage.id),
            ).map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setFollowUpOnly((value) => !value)}
            className={cn(
              controlClass,
              "inline-flex items-center justify-center gap-2 whitespace-nowrap",
              followUpOnly &&
                "border-[var(--amber)] bg-[var(--amber-soft)] text-ink",
            )}
          >
            <BellRing size={14} aria-hidden />
            Due only
          </button>
          {search || status || followUpOnly ? (
            <button
              type="button"
              onClick={clearFilters}
              className="px-2 text-xs font-medium text-muted hover:text-ink"
            >
              Clear
            </button>
          ) : null}
        </div>

        <SupplierList records={filtered} total={profileRecords.length} />
      </section>
    </div>
  );
}
