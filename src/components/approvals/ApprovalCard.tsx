"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock3, Pencil, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/kit/Button";
import { Textarea } from "@/components/kit/Field";
import { useToast } from "@/components/kit/Toast";
import { shortDate } from "@/lib/utils";

export interface ApprovalDTO {
  id: string;
  kind: string;
  title: string;
  recordId: string | null;
  record: { name: string; recordId: string | null; type: string } | null;
  draftSubject: string | null;
  draftBody: string;
  reasoning: string | null;
  status: string;
  createdAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
}

const KIND_LABELS: Record<string, { label: string; className: string }> = {
  outbound_email: { label: "OUTBOUND EMAIL", className: "bg-[var(--amber-soft)] text-amber" },
  publish_product: { label: "PUBLISH PRODUCT", className: "bg-[var(--accent-soft)] text-accent-bright" },
  price_quote: { label: "HARD STOP · PRICE", className: "bg-[#e5484d1f] text-danger" },
  discount: { label: "DISCOUNT", className: "bg-[#e5484d1f] text-danger" },
  other: { label: "GATED ACTION", className: "bg-[var(--panel-soft)] text-muted" },
};

/** One gate item: the draft, why Claude queued it, one-tap decisions. */
export function ApprovalCard({ approval }: { approval: ApprovalDTO }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(approval.draftBody);
  const [busy, setBusy] = useState(false);

  const kind = KIND_LABELS[approval.kind] ?? KIND_LABELS.other;
  const pending = approval.status === "pending";

  const decide = async (
    status: "approved" | "rejected" | "snoozed",
    extra?: Record<string, unknown>,
  ) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/approvals/${approval.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          ...(editing ? { draftBody: draft } : {}),
          ...extra,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "failed");
      toast({
        title:
          status === "approved"
            ? "Approved — the agent will execute it on its next run"
            : status === "rejected"
              ? "Rejected — the agent will not act"
              : "Snoozed until tomorrow",
        tone: status === "rejected" ? "info" : "success",
      });
      router.refresh();
    } catch (e) {
      toast({
        title: "Decision failed",
        description: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="glass rounded-card p-4">
      <header className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${kind.className}`}
        >
          {kind.label}
        </span>
        <span className="font-semibold text-ink">{approval.title}</span>
        {approval.record ? (
          <Link
            href={`/crm?record=${approval.recordId}`}
            className="text-xs text-muted underline-offset-2 hover:text-ink hover:underline"
          >
            {approval.record.recordId ?? approval.record.name} ·{" "}
            {approval.record.name}
          </Link>
        ) : null}
        <span className="num ml-auto text-xs text-muted">
          {shortDate(approval.createdAt)}
        </span>
      </header>

      {approval.draftSubject ? (
        <p className="mt-3 text-sm font-medium text-ink">
          Subject: {approval.draftSubject}
        </p>
      ) : null}

      {editing ? (
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="mt-2 min-h-40 font-mono text-xs"
          aria-label="Edit draft"
        />
      ) : (
        <pre className="glass-soft mt-2 max-h-64 overflow-y-auto rounded-card border-l-2 border-[var(--accent)] px-4 py-3 font-sans text-[13px] whitespace-pre-wrap text-ink">
          {draft}
        </pre>
      )}

      {pending ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            disabled={busy}
            onClick={() => decide("approved")}
          >
            <Check size={14} aria-hidden />
            Approve
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => setEditing((v) => !v)}
          >
            <Pencil size={13} aria-hidden />
            {editing ? "Preview" : "Edit"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() =>
              decide("snoozed", {
                snoozedUntil: new Date(Date.now() + 86_400_000).toISOString(),
              })
            }
          >
            <Clock3 size={13} aria-hidden />
            Snooze
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={busy}
            onClick={() => decide("rejected")}
          >
            <X size={14} aria-hidden />
            Reject
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-xs font-medium text-muted">
          {approval.status.toUpperCase()}
          {approval.decidedAt ? ` · ${shortDate(approval.decidedAt)}` : ""}
          {approval.decisionNote ? ` — ${approval.decisionNote}` : ""}
        </p>
      )}

      {approval.reasoning ? (
        <p className="mt-3 text-xs text-muted">
          <span className="font-semibold">Why Claude queued this:</span>{" "}
          {approval.reasoning}
        </p>
      ) : null}
    </article>
  );
}
