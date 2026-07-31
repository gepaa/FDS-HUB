"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Search, XCircle } from "lucide-react";
import type { RecordDTO } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { SupplierCloseGoal } from "@/components/supplier-outreach/SupplierCloseGoal";
import { SupplierList } from "@/components/supplier-outreach/SupplierList";

const controlClass =
  "h-10 rounded-control border border-hairline bg-[var(--panel)] px-3 text-[13px] text-ink outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]";

export function SupplierOutcomeWorkspace({
  kind,
  records,
  authorizedCount,
}: {
  kind: "closed" | "rejected";
  records: RecordDTO[];
  authorizedCount?: number;
}) {
  const [search, setSearch] = useState("");
  const rejected = kind === "rejected";
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return records;
    return records.filter((record) =>
      [record.name, record.phone, record.websiteUrl]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [records, search]);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link
            href="/supplier-outreach"
            className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
          >
            <ArrowLeft size={14} aria-hidden />
            Active outreach
          </Link>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-muted uppercase">
            {rejected ? (
              <XCircle size={14} aria-hidden />
            ) : (
              <CheckCircle2 size={14} aria-hidden />
            )}
            {rejected ? "Archive" : "Approved supplier book"}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {rejected ? "Rejected Suppliers" : "Approved / Closed Suppliers"}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            {rejected
              ? "Kept outside the active pipeline and approved supplier book. Search here only when needed."
              : "Successful supplier relationships only. Rejections never count toward this list or the goal."}
          </p>
        </div>

        <Link
          href={
            rejected
              ? "/supplier-outreach/closed"
              : "/supplier-outreach/rejected"
          }
          className="press inline-flex h-10 items-center justify-center gap-2 rounded-control border border-hairline bg-[var(--panel)] px-4 text-sm font-medium text-muted hover:text-ink"
        >
          {rejected ? (
            <CheckCircle2 size={15} aria-hidden />
          ) : (
            <XCircle size={15} aria-hidden />
          )}
          {rejected ? "Approved suppliers" : "Rejected suppliers"}
        </Link>
      </header>

      {!rejected ? (
        <SupplierCloseGoal authorizedCount={authorizedCount ?? 0} />
      ) : null}

      <section className="surface-raised overflow-hidden rounded-panel">
        <div className="flex flex-col gap-2 border-b border-hairline bg-[var(--panel-soft)] p-3 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${rejected ? "rejected" : "approved"} suppliers…`}
              className={cn(controlClass, "w-full pl-9")}
            />
          </label>
          <span className="px-2 text-xs text-muted">
            {records.length} {rejected ? "rejected" : "approved"}
          </span>
        </div>

        <SupplierList
          records={filtered}
          total={records.length}
          detailFrom={kind}
          emptyMessage={`No ${rejected ? "rejected" : "approved"} suppliers match this search.`}
        />
      </section>
    </div>
  );
}
