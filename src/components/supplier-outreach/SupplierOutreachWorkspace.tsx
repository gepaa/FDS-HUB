"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Archive,
  ArrowRight,
  BellRing,
  FileSpreadsheet,
  Plus,
  Search,
  Users,
} from "lucide-react";
import {
  CLOSED_SUPPLIER_STAGE_SET,
  needsFollowUp,
  SUPPLIER_STAGES,
  type RecordDTO,
  type TeamProfileDTO,
} from "@/lib/domain";
import { cn } from "@/lib/utils";
import { StageBadge } from "@/components/crm/badges";

interface SupplierOutreachWorkspaceProps {
  initial: RecordDTO[];
  profiles: TeamProfileDTO[];
}

type Scope = "profile" | "closed";

const controlClass =
  "h-10 rounded-control border border-hairline bg-[var(--panel)] px-3 text-[13px] text-ink outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]";

function displayWebsite(value: string | null) {
  if (!value) return "—";
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  }
}

export function SupplierOutreachWorkspace({
  initial,
  profiles,
}: SupplierOutreachWorkspaceProps) {
  const [activeProfileId, setActiveProfileId] = useState(
    profiles[0]?.id ?? "seat_1",
  );
  const [scope, setScope] = useState<Scope>("profile");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [followUpOnly, setFollowUpOnly] = useState(false);

  const closed = useMemo(
    () =>
      initial.filter((record) =>
        CLOSED_SUPPLIER_STAGE_SET.has(record.status),
      ),
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

  const scoped = scope === "closed" ? closed : profileRecords;
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return scoped.filter((record) => {
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
  }, [followUpOnly, scoped, search, status]);

  const dueCount = scoped.filter(needsFollowUp).length;
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
            Choose a profile, scan the essentials, then open a supplier to work
            the full record.
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

      <section className="surface-raised overflow-hidden rounded-panel">
        <div className="flex flex-wrap items-center gap-2 border-b border-hairline p-3">
          {profiles.map((profile) => {
            const count = initial.filter(
              (record) =>
                record.supplierOwnerId === profile.id &&
                !CLOSED_SUPPLIER_STAGE_SET.has(record.status),
            ).length;
            const active =
              scope === "profile" && activeProfileId === profile.id;
            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => {
                  setActiveProfileId(profile.id);
                  setScope("profile");
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
          <button
            type="button"
            onClick={() => {
              setScope("closed");
              setStatus("");
            }}
            className={cn(
              "press flex h-10 items-center gap-2 rounded-control border px-3 text-sm font-medium transition",
              scope === "closed"
                ? "border-[var(--green)] bg-[var(--green-soft)] text-ink"
                : "border-hairline bg-[var(--panel)] text-muted hover:text-ink",
            )}
          >
            <Archive size={15} aria-hidden />
            Closed
            <span className="num text-[11px] text-muted">{closed.length}</span>
          </button>
          <div className="ml-auto hidden items-center gap-3 text-xs text-muted md:flex">
            <span className="flex items-center gap-1.5">
              <Users size={14} aria-hidden />
              {scoped.length} suppliers
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
            <option value="">All statuses</option>
            {SUPPLIER_STAGES.filter((stage) =>
              scope === "closed"
                ? CLOSED_SUPPLIER_STAGE_SET.has(stage.id)
                : !CLOSED_SUPPLIER_STAGE_SET.has(stage.id),
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
          {(search || status || followUpOnly) && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-2 text-xs font-medium text-muted hover:text-ink"
            >
              Clear
            </button>
          )}
        </div>

        <div className="hidden grid-cols-[minmax(0,2fr)_160px_180px_minmax(150px,1fr)_32px] items-center border-b border-hairline bg-[var(--panel)] px-4 py-2 text-[10px] font-semibold tracking-[0.12em] text-muted uppercase lg:grid">
          <span>Name</span>
          <span>Status</span>
          <span>Phone number</span>
          <span>Website</span>
          <span className="sr-only">Open</span>
        </div>

        <div>
          {filtered.map((record) => (
            <Link
              key={record.id}
              href={`/supplier-outreach/${record.id}`}
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

          {filtered.length === 0 && (
            <div className="flex min-h-40 items-center justify-center px-4 text-center text-sm text-muted">
              No suppliers match this view.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-hairline bg-[var(--panel-soft)] px-4 py-3 text-[11px] text-muted">
          <span>
            {filtered.length} of {scoped.length} suppliers
          </span>
          <span>Open a supplier to see and edit everything else.</span>
        </div>
      </section>
    </div>
  );
}
