"use client";

import { useRef, useState } from "react";
import { FileUp, Upload } from "lucide-react";
import { parseSupplierCsv, type ParsedSupplier } from "@/lib/csv";
import type { SupplierDTO } from "@/lib/domain";
import { Modal } from "@/components/kit/Modal";
import { Button } from "@/components/kit/Button";

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  existing: SupplierDTO[];
  onImport: (rows: ParsedSupplier[]) => Promise<void>;
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
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setRows(null);
    setFileName("");
    setError(null);
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

  const existingNames = new Set(existing.map((s) => s.name.trim().toLowerCase()));
  const newCount = rows
    ? rows.filter((r) => !existingNames.has(r.name.trim().toLowerCase())).length
    : 0;
  const updateCount = rows ? rows.length - newCount : 0;

  const doImport = async () => {
    if (!rows) return;
    setBusy(true);
    try {
      await onImport(rows);
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
          <Button variant="ghost" size="sm" onClick={onClose}>
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
          <div className="glass-soft rounded-card px-4 py-3 text-sm">
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
      </div>
    </Modal>
  );
}
