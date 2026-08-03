"use client";

import { useState } from "react";
import Link from "next/link";
import { PhoneCall, Trash2 } from "lucide-react";
import { LEAD_STAGES, PRIORITIES, type RecordDTO } from "@/lib/domain";
import { Drawer } from "@/components/kit/Drawer";
import { Button } from "@/components/kit/Button";
import { Field, Input, Select, Textarea } from "@/components/kit/Field";
import { Modal } from "@/components/kit/Modal";
import { useToast } from "@/components/kit/Toast";

/**
 * Create / edit a lead. Deliberately shows only lead-relevant fields —
 * none of the supplier dealer-program machinery — so the form stays
 * short enough to fill in during a call.
 */

interface FormState {
  name: string;
  company: string;
  email: string;
  phone: string;
  status: string;
  priority: string;
  productInterest: string;
  quoteAmount: string;
  nextAction: string;
  nextActionDate: string;
  contextSummary: string;
  notes: string;
}

const blank = (): FormState => ({
  name: "",
  company: "",
  email: "",
  phone: "",
  status: "NEW",
  priority: "",
  productInterest: "",
  quoteAmount: "",
  nextAction: "",
  nextActionDate: "",
  contextSummary: "",
  notes: "",
});

const fromRecord = (r: RecordDTO): FormState => ({
  name: r.name ?? "",
  company: r.company ?? "",
  email: r.email ?? "",
  phone: r.phone ?? "",
  status: r.status ?? "NEW",
  priority: r.priority ?? "",
  productInterest: r.productInterest ?? "",
  quoteAmount: r.quoteAmount == null ? "" : String(r.quoteAmount),
  nextAction: r.nextAction ?? "",
  nextActionDate: r.nextActionDate ? r.nextActionDate.slice(0, 10) : "",
  contextSummary: r.contextSummary ?? "",
  notes: r.notes ?? "",
});

export function LeadDrawer({
  record,
  open,
  onClose,
  onSaved,
  onDeleted,
}: {
  record: RecordDTO | null;
  open: boolean;
  onClose: () => void;
  onSaved: (dto: RecordDTO, wasCreate: boolean) => void;
  onDeleted: (id: string) => void;
}) {
  const { toast } = useToast();
  const creating = record === null;
  // Seeded from the record at mount. The parent remounts this component
  // via `key` whenever the selected record changes, so there's no effect
  // syncing props into state (and no cascading render).
  const [form, setForm] = useState<FormState>(() =>
    record ? fromRecord(record) : blank(),
  );
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = (patch: Partial<FormState>) =>
    setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    if (!form.name.trim()) {
      toast({ title: "Give the lead a name", tone: "error" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        type: "lead",
        name: form.name.trim(),
        company: form.company.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        status: form.status,
        priority: form.priority || null,
        productInterest: form.productInterest.trim() || null,
        quoteAmount: form.quoteAmount ? Number(form.quoteAmount) : null,
        nextAction: form.nextAction.trim() || null,
        nextActionDate: form.nextActionDate || null,
        contextSummary: form.contextSummary.trim() || null,
        notes: form.notes.trim() || null,
      };
      const res = await fetch(
        creating ? "/api/records" : `/api/records/${record.id}`,
        {
          method: creating ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      toast({
        title: creating ? `${data.name} added to leads` : "Changes saved",
        tone: "success",
      });
      onSaved(data, creating);
      if (!creating) onClose();
    } catch (e) {
      toast({
        title: "Couldn't save",
        description: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!record) return;
    try {
      const res = await fetch(`/api/records/${record.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Delete failed");
      }
      toast({ title: `${record.name} removed`, tone: "info" });
      setConfirmDelete(false);
      onDeleted(record.id);
    } catch (e) {
      toast({
        title: "Couldn't delete",
        description: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
    }
  };

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title={creating ? "New lead" : (record?.name ?? "Lead")}
        subtitle={
          creating || !record ? null : (
            <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
              {record.recordId ? (
                <span className="num">{record.recordId}</span>
              ) : null}
              {record.source ? <span>· {record.source}</span> : null}
            </span>
          )
        }
        footer={
          <div className="flex items-center gap-2">
            {!creating && record ? (
              <>
                <Link
                  href={`/cockpit/${record.id}`}
                  className="press inline-flex h-8 items-center gap-1.5 rounded-control border border-hairline bg-[var(--panel)] px-3 text-[13px] font-medium text-ink hover:border-[var(--hairline-strong)]"
                >
                  <PhoneCall size={13} aria-hidden />
                  Start call
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 size={13} aria-hidden />
                  Delete
                </Button>
              </>
            ) : null}
            <span className="flex-1" />
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={save}
              disabled={saving}
            >
              {saving ? "Saving…" : creating ? "Create lead" : "Save changes"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name">
              {(id) => (
                <Input
                  id={id}
                  value={form.name}
                  onChange={(e) => set({ name: e.target.value })}
                  placeholder="Who is it?"
                  autoFocus={creating}
                />
              )}
            </Field>
            <Field label="Company">
              {(id) => (
                <Input
                  id={id}
                  value={form.company}
                  onChange={(e) => set({ company: e.target.value })}
                  placeholder="Optional"
                />
              )}
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              {(id) => (
                <Input
                  id={id}
                  value={form.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                  placeholder="+1 555 000 1111"
                />
              )}
            </Field>
            <Field label="Email">
              {(id) => (
                <Input
                  id={id}
                  type="email"
                  value={form.email}
                  onChange={(e) => set({ email: e.target.value })}
                  placeholder="name@example.com"
                />
              )}
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Stage">
              {(id) => (
                <Select
                  id={id}
                  value={form.status}
                  onChange={(e) => set({ status: e.target.value })}
                >
                  {LEAD_STAGES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Priority">
              {(id) => (
                <Select
                  id={id}
                  value={form.priority}
                  onChange={(e) => set({ priority: e.target.value })}
                >
                  <option value="">None</option>
                  {PRIORITIES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Interested in">
              {(id) => (
                <Input
                  id={id}
                  value={form.productInterest}
                  onChange={(e) => set({ productInterest: e.target.value })}
                  placeholder="Which product?"
                />
              )}
            </Field>
            <Field label="Quote amount" hint="Numbers only.">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  value={form.quoteAmount}
                  onChange={(e) => set({ quoteAmount: e.target.value })}
                  placeholder="0.00"
                />
              )}
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Next action">
              {(id) => (
                <Input
                  id={id}
                  value={form.nextAction}
                  onChange={(e) => set({ nextAction: e.target.value })}
                  placeholder="Call back with freight quote"
                />
              )}
            </Field>
            <Field label="Next action date">
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={form.nextActionDate}
                  onChange={(e) => set({ nextActionDate: e.target.value })}
                />
              )}
            </Field>
          </div>

          <Field label="Context" hint="The one-line story of this lead.">
            {(id) => (
              <Textarea
                id={id}
                rows={2}
                value={form.contextSummary}
                onChange={(e) => set({ contextSummary: e.target.value })}
              />
            )}
          </Field>

          <Field label="Notes">
            {(id) => (
              <Textarea
                id={id}
                rows={3}
                value={form.notes}
                onChange={(e) => set({ notes: e.target.value })}
              />
            )}
          </Field>
        </div>
      </Drawer>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete lead?"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={remove}>
              Delete permanently
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {record
            ? `“${record.name}” and its activity log will be permanently removed. This cannot be undone.`
            : ""}
        </p>
      </Modal>
    </>
  );
}
