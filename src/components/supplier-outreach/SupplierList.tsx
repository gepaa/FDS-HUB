import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { StageBadge } from "@/components/crm/badges";
import type { RecordDTO } from "@/lib/domain";

function displayWebsite(value: string | null) {
  if (!value) return "—";
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  }
}

export function SupplierList({
  records,
  total,
  emptyMessage = "No suppliers match this view.",
  detailFrom,
}: {
  records: RecordDTO[];
  total: number;
  emptyMessage?: string;
  detailFrom?: "closed" | "rejected";
}) {
  const detailQuery = detailFrom ? `?from=${detailFrom}` : "";

  return (
    <>
      <div className="hidden grid-cols-[minmax(0,2fr)_160px_180px_minmax(150px,1fr)_32px] items-center border-b border-hairline bg-[var(--panel)] px-4 py-2 text-[10px] font-semibold tracking-[0.12em] text-muted uppercase lg:grid">
        <span>Name</span>
        <span>Status</span>
        <span>Phone number</span>
        <span>Website</span>
        <span className="sr-only">Open</span>
      </div>

      <div>
        {records.map((record) => (
          <Link
            key={record.id}
            href={`/supplier-outreach/${record.id}${detailQuery}`}
            prefetch={false}
            className="group grid gap-3 border-b border-hairline bg-[var(--panel)] px-4 py-4 transition last:border-b-0 hover:bg-[var(--accent-soft)] focus-visible:bg-[var(--accent-soft)] focus-visible:outline-none sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_160px_180px_minmax(150px,1fr)_32px] lg:items-center lg:gap-0 lg:py-3"
          >
            <div className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink">
                {record.name}
              </span>
            </div>
            <div>
              <span className="mb-1 block text-[10px] font-semibold tracking-wide text-muted uppercase lg:hidden">
                Status
              </span>
              <StageBadge stage={record.status} />
            </div>
            <div className="min-w-0">
              <span className="mb-1 block text-[10px] font-semibold tracking-wide text-muted uppercase lg:hidden">
                Phone number
              </span>
              <span className="block truncate font-mono text-xs text-ink">
                {record.phone || "—"}
              </span>
            </div>
            <div className="min-w-0">
              <span className="mb-1 block text-[10px] font-semibold tracking-wide text-muted uppercase lg:hidden">
                Website
              </span>
              <span className="block truncate text-xs text-muted">
                {displayWebsite(record.websiteUrl)}
              </span>
            </div>
            <ArrowRight
              size={16}
              className="hidden text-muted transition group-hover:translate-x-0.5 group-hover:text-[var(--accent-bright)] lg:block"
              aria-hidden
            />
          </Link>
        ))}

        {records.length === 0 ? (
          <div className="flex min-h-40 items-center justify-center px-4 text-center text-sm text-muted">
            {emptyMessage}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-hairline bg-[var(--panel-soft)] px-4 py-3 text-[11px] text-muted">
        <span>
          {records.length} of {total} suppliers
        </span>
        <span>Open a supplier to see and edit everything else.</span>
      </div>
    </>
  );
}
