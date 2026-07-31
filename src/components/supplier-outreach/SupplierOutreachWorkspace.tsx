"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  BellRing,
  Check,
  ExternalLink,
  FileSpreadsheet,
  Filter,
  Plus,
  Search,
  Users,
} from "lucide-react";
import {
  CLOSED_SUPPLIER_STAGE_SET,
  needsFollowUp,
  PRIORITIES,
  RANKS,
  SUPPLIER_STAGES,
  type InteractionType,
  type Priority,
  type RecordDTO,
  type TeamProfileDTO,
} from "@/lib/domain";
import { api } from "@/lib/api";
import { cn, shortDate } from "@/lib/utils";
import { Button } from "@/components/kit/Button";
import { Modal } from "@/components/kit/Modal";
import { useToast } from "@/components/kit/Toast";
import {
  RecordDrawer,
  type RecordFormData,
} from "@/components/crm/RecordDrawer";

interface SupplierOutreachWorkspaceProps {
  initial: RecordDTO[];
  profiles: TeamProfileDTO[];
  initialRecordId?: string;
  initialCreate?: boolean;
}

type Scope = "profile" | "closed";

const controlClass =
  "h-9 rounded-control border border-hairline bg-[var(--panel)] px-3 text-[13px] text-ink outline-none transition focus:border-[var(--accent)]";

const spreadsheetColumns = [
  ["A", "Supplier / Brand", "240px"],
  ["B", "Niche", "220px"],
  ["C", "Best Seller", "220px"],
  ["D", "Rank", "90px"],
  ["E", "Supplier URL", "120px"],
  ["F", "Main Contact", "170px"],
  ["G", "Main Email", "220px"],
  ["H", "Phone", "160px"],
  ["I", "Apply Online", "130px"],
  ["J", "Status", "165px"],
  ["K", "Warmth", "110px"],
  ["L", "Form Signed", "105px"],
  ["M", "Emailed", "90px"],
  ["N", "Follow-up", "130px"],
  ["O", "Next Step", "210px"],
  ["P", "Notes", "360px"],
] as const;

const gridTemplate = `48px ${spreadsheetColumns
  .map((column) => column[2])
  .join(" ")}`;

function Cell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-12 min-w-0 items-center border-r border-b border-hairline px-3 py-2 text-[12px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function CheckCell({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className="flex w-full cursor-pointer items-center justify-center"
      onClick={(event) => event.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={label}
        className="peer sr-only"
      />
      <span className="flex h-5 w-5 items-center justify-center rounded border border-hairline bg-[var(--panel)] text-transparent transition peer-checked:border-[var(--accent)] peer-checked:bg-[var(--accent)] peer-checked:text-white">
        <Check size={13} strokeWidth={3} aria-hidden />
      </span>
    </label>
  );
}

export function SupplierOutreachWorkspace({
  initial,
  profiles,
  initialRecordId,
  initialCreate,
}: SupplierOutreachWorkspaceProps) {
  const { toast } = useToast();
  const initialRecord = initialRecordId
    ? initial.find((record) => record.id === initialRecordId)
    : undefined;
  const [records, setRecords] = useState(initial);
  const [activeProfileId, setActiveProfileId] = useState(
    initialRecord &&
      !CLOSED_SUPPLIER_STAGE_SET.has(initialRecord.status) &&
      initialRecord.supplierOwnerId
      ? initialRecord.supplierOwnerId
      : (profiles[0]?.id ?? "seat_1"),
  );
  const [scope, setScope] = useState<Scope>(
    initialRecord && CLOSED_SUPPLIER_STAGE_SET.has(initialRecord.status)
      ? "closed"
      : "profile",
  );
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [rank, setRank] = useState("");
  const [followUpOnly, setFollowUpOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialRecordId ?? null,
  );
  const [creating, setCreating] = useState(initialCreate === true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [savingCell, setSavingCell] = useState<string | null>(null);

  const selected = useMemo(
    () => records.find((record) => record.id === selectedId) ?? null,
    [records, selectedId],
  );

  const closed = useMemo(
    () =>
      records.filter((record) =>
        CLOSED_SUPPLIER_STAGE_SET.has(record.status),
      ),
    [records],
  );

  const profileRecords = useMemo(
    () =>
      records.filter(
        (record) =>
          !CLOSED_SUPPLIER_STAGE_SET.has(record.status) &&
          record.supplierOwnerId === activeProfileId,
      ),
    [activeProfileId, records],
  );

  const scoped = scope === "closed" ? closed : profileRecords;
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return scoped.filter((record) => {
      if (
        query &&
        ![
          record.name,
          record.niche,
          record.bestSeller,
          record.mainContact,
          record.email,
          record.phone,
          record.notes,
          record.nextAction,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      ) {
        return false;
      }
      if (status && record.status !== status) return false;
      if (rank && record.rank !== rank) return false;
      if (followUpOnly && !needsFollowUp(record)) return false;
      return true;
    });
  }, [followUpOnly, rank, scoped, search, status]);

  const allClusters = useMemo(
    () =>
      [...new Set(records.map((record) => record.cluster))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [records],
  );

  const replace = (next: RecordDTO) => {
    setRecords((current) =>
      current.map((record) => (record.id === next.id ? next : record)),
    );
  };

  const patchInline = async (
    record: RecordDTO,
    data: Partial<RecordFormData>,
    field: string,
  ) => {
    const key = `${record.id}:${field}`;
    setSavingCell(key);
    try {
      const next = await api.updateRecord(record.id, data);
      replace(next);
      if (
        data.status &&
        CLOSED_SUPPLIER_STAGE_SET.has(data.status) &&
        !CLOSED_SUPPLIER_STAGE_SET.has(record.status)
      ) {
        toast({
          title: `${record.name} moved to Closed`,
          tone: "success",
        });
      }
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    } finally {
      setSavingCell(null);
    }
  };

  const saveRecord = async (data: RecordFormData) => {
    try {
      if (creating) {
        const next = await api.createRecord({
          ...data,
          type: "supplier",
          supplierOwnerId: data.supplierOwnerId ?? activeProfileId,
        });
        setRecords((current) =>
          [...current, next].sort((a, b) => a.name.localeCompare(b.name)),
        );
        setCreating(false);
        setSelectedId(next.id);
        toast({ title: `${next.name} added`, tone: "success" });
      } else if (selected) {
        const next = await api.updateRecord(selected.id, data);
        replace(next);
        toast({ title: "Changes saved", tone: "success" });
      }
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
      throw error;
    }
  };

  const logInteraction = async (type: InteractionType, body: string) => {
    if (!selected) return;
    try {
      const next = await api.logInteraction(selected.id, { type, body });
      replace(next);
      toast({ title: "Activity logged", tone: "success" });
    } catch (error) {
      toast({
        title: "Couldn't log activity",
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
      throw error;
    }
  };

  const deleteInteraction = async (interactionId: string) => {
    if (!selected) return;
    try {
      await api.deleteInteraction(interactionId);
      setRecords((current) =>
        current.map((record) =>
          record.id === selected.id
            ? {
                ...record,
                interactions: record.interactions.filter(
                  (interaction) => interaction.id !== interactionId,
                ),
              }
            : record,
        ),
      );
    } catch (error) {
      toast({
        title: "Couldn't remove activity",
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
      throw error;
    }
  };

  const deleteRecord = async () => {
    if (!selected) return;
    try {
      await api.deleteRecord(selected.id);
      setRecords((current) =>
        current.filter((record) => record.id !== selected.id),
      );
      setSelectedId(null);
      setConfirmDelete(false);
      toast({ title: `${selected.name} removed`, tone: "info" });
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setRank("");
    setFollowUpOnly(false);
  };

  const activeProfile =
    profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0];
  const dueCount = scoped.filter(needsFollowUp).length;

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
            The supplier sheet, rebuilt inside FDS Hub. Pick a profile, work
            the rows, and click any supplier for the full record and activity.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setCreating(true);
            setSelectedId(null);
          }}
        >
          <Plus size={15} aria-hidden />
          Add supplier
        </Button>
      </header>

      <section className="surface-raised overflow-hidden rounded-panel">
        <div className="flex flex-wrap items-center gap-2 border-b border-hairline p-3">
          {profiles.map((profile) => {
            const count = records.filter(
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
          <div className="mx-1 h-6 w-px bg-[var(--hairline)]" />
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
            Closed suppliers
            <span className="num text-[11px] text-muted">{closed.length}</span>
          </button>
          <div className="ml-auto flex items-center gap-3 text-xs text-muted">
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

        <div className="flex flex-wrap items-center gap-2 border-b border-hairline bg-[var(--panel-soft)] p-3">
          <label className="relative min-w-56 flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search supplier, contact, email, phone, notes…"
              className={cn(controlClass, "w-full pl-9")}
            />
          </label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className={controlClass}
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
          <select
            value={rank}
            onChange={(event) => setRank(event.target.value)}
            className={controlClass}
            aria-label="Filter by rank"
          >
            <option value="">All ranks</option>
            {RANKS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setFollowUpOnly((value) => !value)}
            className={cn(
              controlClass,
              "inline-flex items-center gap-2",
              followUpOnly &&
                "border-[var(--amber)] bg-[var(--amber-soft)] text-ink",
            )}
          >
            <Filter size={14} aria-hidden />
            Due follow-ups
          </button>
          {(search || status || rank || followUpOnly) && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-2 text-xs font-medium text-muted hover:text-ink"
            >
              Clear
            </button>
          )}
        </div>

        <div className="overflow-auto">
          <div style={{ minWidth: "2745px" }}>
            <div
              className="sticky top-0 z-20 grid border-t border-hairline bg-[var(--panel)] shadow-sm"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              <div className="sticky left-0 z-30 flex h-7 items-center justify-center border-r border-b border-hairline bg-[var(--panel-soft)] text-[10px] font-semibold text-muted">
                #
              </div>
              {spreadsheetColumns.map(([letter]) => (
                <div
                  key={letter}
                  className="flex h-7 items-center justify-center border-r border-b border-hairline bg-[var(--panel-soft)] text-[10px] font-semibold text-muted"
                >
                  {letter}
                </div>
              ))}
              <div className="sticky left-0 z-30 flex h-9 items-center justify-center border-r border-b border-hairline bg-[var(--panel)] text-[10px] font-semibold text-muted">
                ROW
              </div>
              {spreadsheetColumns.map(([letter, label], index) => (
                <div
                  key={`${letter}-${label}`}
                  className={cn(
                    "flex h-9 items-center border-r border-b border-hairline bg-[var(--panel)] px-3 text-[10px] font-semibold tracking-wide text-muted uppercase",
                    index === 0 && "sticky left-12 z-20 shadow-[2px_0_0_var(--hairline)]",
                  )}
                >
                  {label}
                </div>
              ))}
            </div>

            {filtered.map((record, index) => (
              <div
                key={record.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setCreating(false);
                  setSelectedId(record.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    setCreating(false);
                    setSelectedId(record.id);
                  }
                }}
                className="group grid cursor-pointer bg-[var(--panel)] transition hover:bg-[var(--accent-soft)] focus:bg-[var(--accent-soft)] focus:outline-none"
                style={{ gridTemplateColumns: gridTemplate }}
              >
                <Cell className="sticky left-0 z-10 justify-center bg-[var(--panel-soft)] px-1 font-mono text-[10px] text-muted group-hover:bg-[var(--accent-soft)]">
                  {index + 1}
                </Cell>
                <Cell className="sticky left-12 z-10 flex-col items-start justify-center bg-[var(--panel)] shadow-[2px_0_0_var(--hairline)] group-hover:bg-[#eef5ff] dark:group-hover:bg-[#152641]">
                  <span className="max-w-full truncate text-[13px] font-semibold text-ink">
                    {record.name}
                  </span>
                  <span className="max-w-full truncate font-mono text-[10px] text-muted">
                    {record.recordId ?? "Supplier"}
                  </span>
                </Cell>
                <Cell>
                  <span className="line-clamp-2 text-ink">
                    {record.niche ?? "—"}
                  </span>
                </Cell>
                <Cell>
                  <span className="line-clamp-2 text-ink">
                    {record.bestSeller ?? "—"}
                  </span>
                </Cell>
                <Cell>
                  <span
                    className={cn(
                      "rounded px-2 py-1 text-[10px] font-semibold",
                      record.rank === "Gold" &&
                        "bg-[#fff0bd] text-[#755400] dark:bg-[#5d4814] dark:text-[#ffe79a]",
                      record.rank === "Silver" &&
                        "bg-[#e8edf2] text-[#4d5967] dark:bg-[#303841] dark:text-[#d9e0e7]",
                      record.rank === "Bronze" &&
                        "bg-[#f5e0ce] text-[#74441f] dark:bg-[#51321f] dark:text-[#f2c39f]",
                    )}
                  >
                    {record.rank ?? "—"}
                  </span>
                </Cell>
                <Cell>
                  {record.websiteUrl ? (
                    <a
                      href={record.websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="inline-flex items-center gap-1 font-medium text-[var(--accent-bright)] hover:underline"
                    >
                      Website
                      <ExternalLink size={12} aria-hidden />
                    </a>
                  ) : (
                    "—"
                  )}
                </Cell>
                <Cell>
                  <span className="line-clamp-2">
                    {record.mainContact ?? "—"}
                  </span>
                </Cell>
                <Cell>
                  {record.email ? (
                    <a
                      href={`mailto:${record.email}`}
                      onClick={(event) => event.stopPropagation()}
                      className="line-clamp-2 text-[var(--accent-bright)] hover:underline"
                    >
                      {record.email}
                    </a>
                  ) : (
                    "—"
                  )}
                </Cell>
                <Cell>
                  {record.phone ? (
                    <a
                      href={`tel:${record.phone}`}
                      onClick={(event) => event.stopPropagation()}
                      className="line-clamp-2 font-mono text-[11px] text-ink hover:text-[var(--accent-bright)]"
                    >
                      {record.phone}
                    </a>
                  ) : (
                    "—"
                  )}
                </Cell>
                <Cell>
                  {record.dealerAppUrl ? (
                    <a
                      href={record.dealerAppUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="inline-flex items-center gap-1 font-medium text-[var(--accent-bright)] hover:underline"
                    >
                      Open form
                      <ExternalLink size={12} aria-hidden />
                    </a>
                  ) : (
                    "—"
                  )}
                </Cell>
                <Cell>
                  <select
                    value={record.status}
                    disabled={savingCell === `${record.id}:status`}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) =>
                      void patchInline(
                        record,
                        { status: event.target.value },
                        "status",
                      )
                    }
                    className="w-full rounded border border-hairline bg-[var(--panel)] px-2 py-1.5 text-[11px] text-ink outline-none focus:border-[var(--accent)]"
                    aria-label={`Status for ${record.name}`}
                  >
                    {SUPPLIER_STAGES.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.label}
                      </option>
                    ))}
                  </select>
                </Cell>
                <Cell>
                  <select
                    value={record.priority ?? ""}
                    disabled={savingCell === `${record.id}:priority`}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) =>
                      void patchInline(
                        record,
                        {
                          priority:
                            (event.target.value as Priority | "") || null,
                        },
                        "priority",
                      )
                    }
                    className="w-full rounded border border-hairline bg-[var(--panel)] px-2 py-1.5 text-[11px] capitalize text-ink outline-none focus:border-[var(--accent)]"
                    aria-label={`Warmth for ${record.name}`}
                  >
                    <option value="">—</option>
                    {PRIORITIES.map((priority) => (
                      <option key={priority.id} value={priority.id}>
                        {priority.label}
                      </option>
                    ))}
                  </select>
                </Cell>
                <Cell>
                  <CheckCell
                    checked={record.dealerApplicationSigned}
                    label={`Dealer form signed for ${record.name}`}
                    onChange={(checked) =>
                      void patchInline(
                        record,
                        { dealerApplicationSigned: checked },
                        "dealerApplicationSigned",
                      )
                    }
                  />
                </Cell>
                <Cell>
                  <CheckCell
                    checked={record.initialEmailSent}
                    label={`Initial email sent to ${record.name}`}
                    onChange={(checked) =>
                      void patchInline(
                        record,
                        { initialEmailSent: checked },
                        "initialEmailSent",
                      )
                    }
                  />
                </Cell>
                <Cell>
                  {record.nextActionDate ? (
                    <span
                      className={cn(
                        "font-mono text-[11px]",
                        needsFollowUp(record)
                          ? "font-semibold text-amber"
                          : "text-ink",
                      )}
                    >
                      {needsFollowUp(record) ? "Due " : ""}
                      {shortDate(record.nextActionDate)}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </Cell>
                <Cell>
                  <span className="line-clamp-2 text-ink">
                    {record.nextAction ?? "—"}
                  </span>
                </Cell>
                <Cell>
                  <span className="line-clamp-2 text-muted">
                    {record.notes ?? record.contextSummary ?? "—"}
                  </span>
                </Cell>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="flex h-40 items-center justify-center border-b border-hairline bg-[var(--panel)] text-sm text-muted">
                No supplier rows match this view.
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-hairline bg-[var(--panel-soft)] px-4 py-2 text-[11px] text-muted">
          <span>
            {scope === "closed"
              ? "Shared closed supplier book"
              : `${activeProfile?.name ?? "Profile"}'s active calling list`}
          </span>
          <span className="num">
            {filtered.length} of {scoped.length} rows
          </span>
        </div>
      </section>

      <RecordDrawer
        record={creating ? null : selected}
        open={creating || selected !== null}
        createType="supplier"
        profiles={profiles}
        defaultSupplierOwnerId={activeProfileId}
        clusterOptions={allClusters}
        onClose={() => {
          setCreating(false);
          setSelectedId(null);
        }}
        onSave={saveRecord}
        onDelete={() => setConfirmDelete(true)}
        onLogInteraction={logInteraction}
        onDeleteInteraction={deleteInteraction}
      />

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete supplier?"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={deleteRecord}>
              Delete permanently
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {selected
            ? `“${selected.name}” and its activity history will be permanently removed.`
            : ""}
        </p>
      </Modal>
    </div>
  );
}
