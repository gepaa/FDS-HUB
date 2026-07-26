"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, FileUp, Upload } from "lucide-react";
import { parseSupplierCsv, type ParsedSupplier } from "@/lib/csv";
import { STAGE_MAP, type RecordDTO } from "@/lib/domain";
import { Modal } from "@/components/kit/Modal";
import { Button } from "@/components/kit/Button";

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  existing: RecordDTO[];
  onImport: (rows: ParsedSupplier[], updateStages: boolean) => Promise<void>;
}

/**
 * CSV import: accepts the raw FDS Supplier Outreach sheet or the
 * hub's own export format. Matches by name — existing suppliers are
 * updated, new ones created.
 */
export function ImportModal({ open, onClose, existing, onImport }: ImportModalProps) {
  const [rows, setRows] = useState<ParsedSupplier[] | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [updateStages, setUpdateStages] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setRows(null);
    setFileName("");
    setError(null);
    setUpdateStages(false);
  };

  const handleFile = async (file: File) => {
    setError(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const parsed = parseSupplierCsv(text);
      if (!parsed.length) {
        setError(
          "No suppliers found. Expected the FDS outreach sheet or a hub export.",
        );
        setRows(null);
        return;
      }
      setRows(parsed);
    } catch {
      setError("Could not read that file.");
      setRows(null);
    }
  };

  const byName = useMemo(
    () => new Map(existing.map((s) => [s.name.trim().toLowerCase(), s])),
    [existing],
  );
  const newCount = rows
    ? rows.filter((r) => !byName.has(r.name.trim().toLowerCase())).length
    : 0;
  const updateCount = rows ? rows.length - newCount : 0;

  /** Existing suppliers whose ladder position the CSV disagrees with. */
  const stageConflicts = useMemo(() => {
    if (!rows) return [];
    return rows.flatMap((r) => {
      const match = byName.get(r.name.trim().toLowerCase());
      if (!match || match.status === r.status) return [];
      return [{ name: match.name, from: match.status, to: r.status }];
    });
  }, [rows, byName]);

  const doImport = async () => {
    if (!rows) return;
    setBusy(true);
    try {
      await onImport(rows, updateStages);
      reset();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Import suppliers from CSV"
      footer={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!rows || busy}
            onClick={doImport}
          >
            {busy
              ? "Importing…"
              : rows
                ? `Import ${rows.length} suppliers`
                : "Import"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="press flex flex-col items-center gap-2 rounded-card border border-dashed border-[var(--hairline-strong)] bg-[var(--panel-soft)] px-4 py-8 text-sm text-muted hover:border-[var(--accent)] hover:text-ink"
        >
          <FileUp size={22} aria-hidden className="text-accent-bright" />
          {fileName ? (
            <span className="font-medium text-ink">{fileName}</span>
          ) : (
            <>
              <span className="font-medium text-ink">Choose a CSV file</span>
              <span className="text-xs">
                FDS outreach sheet or a hub export — matched by supplier name
              </span>
            </>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        {rows ? (
          <div className="surface-muted rounded-card px-4 py-3 text-sm">
            <p className="flex items-center gap-2 font-medium text-ink">
              <Upload size={14} aria-hidden className="text-accent-bright" />
              {rows.length} suppliers parsed
            </p>
            <p className="num mt-1 text-xs text-muted">
              {newCount} new · {updateCount} will update existing records
            </p>
            <p className="mt-2 truncate text-xs text-muted">
              {rows
                .slice(0, 5)
                .map((r) => r.name)
                .join(", ")}
              {rows.length > 5 ? ` +${rows.length - 5} more` : ""}
            </p>
          </div>
        ) : null}

        {rows && stageConflicts.length > 0 ? (
          <div className="rounded-card border border-[var(--amber)] bg-[var(--amber-soft)] px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-medium text-amber">
              <AlertTriangle size={14} aria-hidden />
              {stageConflicts.length} supplier
              {stageConflicts.length === 1 ? "" : "s"} sit at a different
              pipeline stage in this CSV
            </p>
            <ul className="mt-2 flex flex-col gap-0.5 text-xs text-muted">
              {stageConflicts.slice(0, 4).map((c) => (
                <li key={c.name} className="truncate">
                  {c.name}: {STAGE_MAP[c.from]?.label ?? c.from} →{" "}
                  {STAGE_MAP[c.to]?.label ?? c.to}
                </li>
              ))}
              {stageConflicts.length > 4 ? (
                <li>+{stageConflicts.length - 4} more</li>
              ) : null}
            </ul>
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-ink">
              <input
                type="checkbox"
                checked={updateStages}
                onChange={(e) => setUpdateStages(e.target.checked)}
                className="mt-0.5 accent-[var(--accent)]"
              />
              <span>
                Overwrite pipeline stage from the CSV.{" "}
                <span className="text-muted">
                  Left off, everything else imports and the stages above stay
                  as they are in the hub. Either way the change is written to
                  each supplier&rsquo;s activity log.
                </span>
              </span>
            </label>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
