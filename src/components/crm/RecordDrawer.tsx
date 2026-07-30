"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  PhoneCall,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import {
  INTERACTION_TYPES,
  OWNERS,
  PRIORITIES,
  RANKS,
  stagesFor,
  type InteractionType,
  type RecordDTO,
  type RecordType,
  type SupplierContactDTO,
  type TeamProfileDTO,
} from "@/lib/domain";
import { shortDate } from "@/lib/utils";
import { Drawer } from "@/components/kit/Drawer";
import { Button } from "@/components/kit/Button";
import { Field, Input, Select, Textarea } from "@/components/kit/Field";
import { Chip } from "@/components/kit/Chip";
import {
  OwnerBadge,
  PriorityBadge,
  StageBadge,
  TeamProfileBadge,
} from "@/components/crm/badges";
import { QuickActionBar, type QuickAction } from "@/components/crm/QuickActions";
import { CallTimeline } from "@/components/crm/CallTimeline";
import { DialButton } from "@/components/crm/DialButton";

/** Flat form payload — matches the PATCH/POST body of /api/records. */
export interface RecordFormData {
  type?: RecordType;
  name?: string;
  company?: string | null;
  niche?: string | null;
  cluster?: string;
  bestSeller?: string | null;
  rank?: string | null;
  websiteUrl?: string | null;
  dealerAppUrl?: string | null;
  mainContact?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string;
  owner?: string;
  supplierOwnerId?: string | null;
  priority?: string | null;
  contextSummary?: string | null;
  mapPolicy?: string | null;
  dropship?: boolean | null;
  freightModel?: string | null;
  leadTime?: string | null;
  warranty?: string | null;
  dealerProgram?: string | null;
  mediaPermission?: string | null;
  authorizationStatus?: string | null;
  dealerApplicationSigned?: boolean;
  initialEmailSent?: boolean;
  supplierContacts?: SupplierContactDTO[];
  productInterest?: string | null;
  intent?: string | null;
  quoteAmount?: number | null;
  lastContactDate?: string | null;
  nextAction?: string | null;
  nextActionDate?: string | null;
  notes?: string | null;
}

interface RecordDrawerProps {
  record: RecordDTO | null; // null = create mode
  open: boolean;
  createType?: RecordType;
  profiles: TeamProfileDTO[];
  defaultSupplierOwnerId: string;
  /** Cluster values present in the DB, so an off-list one survives a save. */
  clusterOptions: string[];
  onClose: () => void;
  onSave: (data: RecordFormData) => void | Promise<void>;
  onDelete: () => void;
  onLogInteraction: (type: InteractionType, body: string) => void | Promise<void>;
  onDeleteInteraction: (interactionId: string) => void | Promise<void>;
  onQuickAction?: (record: RecordDTO, action: QuickAction) => void;
}

const dateInput = (iso: string | null | undefined) =>
  iso ? iso.slice(0, 10) : "";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FormErrors = Partial<
  Record<"name" | "email" | "nextActionDate" | "lastContactDate", string>
>;

/**
 * Client-side mirror of the zod rules in src/lib/validation.ts. The
 * server is still the authority; this exists so the operator sees which
 * field is wrong instead of a toast with a joined error string.
 */
function validate(form: RecordFormData): FormErrors {
  const errors: FormErrors = {};
  if (!(form.name ?? "").trim()) errors.name = "A name is required.";
  const email = (form.email ?? "").trim();
  if (email && !EMAIL_RE.test(email))
    errors.email = "That doesn't look like an email address.";
  for (const key of ["nextActionDate", "lastContactDate"] as const) {
    const value = (form[key] ?? "").trim();
    if (value && Number.isNaN(new Date(value).getTime()))
      errors[key] = "Use a real date (YYYY-MM-DD).";
  }
  return errors;
}

function buildForm(
  r: RecordDTO | null,
  createType: RecordType,
  defaultSupplierOwnerId: string,
): RecordFormData {
  return {
    type: r?.type ?? createType,
    name: r?.name ?? "",
    company: r?.company ?? "",
    niche: r?.niche ?? "",
    cluster: r?.cluster ?? "Other",
    bestSeller: r?.bestSeller ?? "",
    rank: r?.rank ?? "",
    websiteUrl: r?.websiteUrl ?? "",
    dealerAppUrl: r?.dealerAppUrl ?? "",
    mainContact: r?.mainContact ?? "",
    email: r?.email ?? "",
    phone: r?.phone ?? "",
    status: r?.status ?? (createType === "lead" ? "NEW" : "SOURCED"),
    owner: r?.owner ?? "unassigned",
    supplierOwnerId: r?.supplierOwnerId ?? defaultSupplierOwnerId,
    priority: r?.priority ?? "",
    contextSummary: r?.contextSummary ?? "",
    mapPolicy: r?.mapPolicy ?? "",
    dropship: r?.dropship ?? null,
    freightModel: r?.freightModel ?? "",
    leadTime: r?.leadTime ?? "",
    warranty: r?.warranty ?? "",
    dealerProgram: r?.dealerProgram ?? "",
    mediaPermission: r?.mediaPermission ?? "",
    authorizationStatus: r?.authorizationStatus ?? "",
    dealerApplicationSigned: r?.dealerApplicationSigned ?? false,
    initialEmailSent: r?.initialEmailSent ?? false,
    supplierContacts: r?.supplierContacts ?? [],
    productInterest: r?.productInterest ?? "",
    intent: r?.intent ?? "",
    quoteAmount: r?.quoteAmount ?? null,
    nextAction: r?.nextAction ?? "",
    nextActionDate: dateInput(r?.nextActionDate),
    lastContactDate: dateInput(r?.lastContactDate),
    notes: r?.notes ?? "",
  };
}

/** Record detail drawer — the spec's "open a record, instantly know the
 *  story and the move": status, context, next action first. */
export function RecordDrawer({
  record,
  open,
  createType = "supplier",
  profiles,
  defaultSupplierOwnerId,
  clusterOptions,
  onClose,
  onSave,
  onDelete,
  onLogInteraction,
  onDeleteInteraction,
  onQuickAction,
}: RecordDrawerProps) {
  const creating = record === null;
  const [form, setForm] = useState<RecordFormData>(() =>
    buildForm(record, createType, defaultSupplierOwnerId),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [logType, setLogType] = useState<InteractionType>("note");
  const [logBody, setLogBody] = useState("");
  const [logError, setLogError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteLog, setConfirmDeleteLog] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(buildForm(record, createType, defaultSupplierOwnerId));
      setErrors({});
      setLogError(null);
      setConfirmDeleteLog(null);
    }
  }, [open, record, createType, defaultSupplierOwnerId]);

  const type: RecordType = (form.type as RecordType) ?? "supplier";
  const stages = useMemo(() => stagesFor(type), [type]);
  const formProfile =
    profiles.find((profile) => profile.id === form.supplierOwnerId) ?? null;

  // The record's own cluster is always offered, even if a later import
  // introduced one outside the seeded 8 — otherwise the select would
  // silently rewrite it on the next save.
  const clusters = useMemo(() => {
    const current = (form.cluster ?? "").trim();
    const all = new Set(clusterOptions);
    if (current) all.add(current);
    return [...all].sort((a, b) => a.localeCompare(b));
  }, [clusterOptions, form.cluster]);

  const set = (patch: Partial<RecordFormData>) => {
    setForm((f) => ({ ...f, ...patch }));
    // Clear an error as soon as the operator edits that field.
    const touched = Object.keys(patch) as (keyof FormErrors)[];
    setErrors((e) => {
      if (!touched.some((k) => e[k])) return e;
      const next = { ...e };
      for (const k of touched) delete next[k];
      return next;
    });
  };

  const save = async () => {
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        // Normalize empty strings the zod layer treats as null anyway,
        // and date inputs back to ISO-parseable values.
        nextActionDate: form.nextActionDate || null,
        lastContactDate: form.lastContactDate || null,
        quoteAmount:
          form.quoteAmount === null || (form.quoteAmount as unknown) === ""
            ? null
            : Number(form.quoteAmount),
      });
    } finally {
      setSaving(false);
    }
  };

  const submitLog = async () => {
    const body = logBody.trim();
    if (!body) {
      setLogError("Type what happened first — an empty entry isn't logged.");
      return;
    }
    setLogError(null);
    await onLogInteraction(logType, body);
    setLogBody("");
  };

  const addContact = () => {
    const contact: SupplierContactDTO = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `contact-${Date.now()}`,
      name: "",
      role: "",
      phone: "",
      email: "",
      notes: "",
      isPrimary: (form.supplierContacts?.length ?? 0) === 0,
    };
    set({ supplierContacts: [...(form.supplierContacts ?? []), contact] });
  };

  const updateContact = (
    id: string,
    patch: Partial<SupplierContactDTO>,
  ) => {
    set({
      supplierContacts: (form.supplierContacts ?? []).map((contact) =>
        contact.id === id ? { ...contact, ...patch } : contact,
      ),
    });
  };

  const removeContact = (id: string) => {
    set({
      supplierContacts: (form.supplierContacts ?? []).filter(
        (contact) => contact.id !== id,
      ),
    });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        creating
          ? type === "lead"
            ? "New lead"
            : "New supplier"
          : record.name
      }
      subtitle={
        creating ? null : (
          <span className="flex flex-wrap items-center gap-2">
            {record.recordId ? (
              <span className="num">{record.recordId}</span>
            ) : null}
            <StageBadge stage={record.status} />
            <PriorityBadge priority={record.priority} />
            {record.type === "supplier" ? (
              <TeamProfileBadge profile={record.supplierOwner} />
            ) : (
              <OwnerBadge owner={record.owner} />
            )}
          </span>
        )
      }
      footer={
        // flex-wrap so a narrow drawer stacks the buttons cleanly
        // instead of squeezing them out of alignment.
        <div className="flex flex-wrap items-center gap-2">
          {!creating ? (
            <>
              <Link
                href={`/cockpit/${record.id}`}
                className="press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-control border border-hairline bg-[var(--panel)] px-3 text-[13px] font-medium whitespace-nowrap text-ink shadow-sm hover:border-[var(--hairline-strong)]"
              >
                <PhoneCall size={13} aria-hidden />
                Start call
              </Link>
              {/* Hands the number to Quo. "Start call" opens the
                  cockpit workspace; this actually dials. */}
              <DialButton phone={record.phone} />
              <Button variant="ghost" size="sm" onClick={onDelete}>
                <Trash2 size={13} aria-hidden />
                Delete
              </Button>
            </>
          ) : null}
          <span className="flex-1" />
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving…" : creating ? "Create record" : "Save changes"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {/* ---- The three at-a-glance fields ---- */}
        <section className="surface-muted flex flex-col gap-3 rounded-card p-4">
          <div className="grid grid-cols-2 gap-3">
            {creating ? (
              <Field label="Record type">
                {(id) => (
                  <Select
                    id={id}
                    value={type}
                    onChange={(e) => {
                      const t = e.target.value as RecordType;
                      set({
                        type: t,
                        status: t === "lead" ? "NEW" : "SOURCED",
                        supplierOwnerId:
                          t === "supplier" ? defaultSupplierOwnerId : null,
                      });
                    }}
                  >
                    <option value="supplier">Supplier</option>
                    <option value="lead">Lead</option>
                  </Select>
                )}
              </Field>
            ) : null}
            <Field label="Status">
              {(id) => (
                <Select
                  id={id}
                  value={form.status}
                  onChange={(e) => set({ status: e.target.value })}
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {type === "supplier" ? (
              <Field label="Supplier profile">
                {(id) => (
                  <Select
                    id={id}
                    value={form.supplierOwnerId ?? ""}
                    onChange={(e) =>
                      set({ supplierOwnerId: e.target.value || null })
                    }
                  >
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ) : (
              <Field label="Owner (who moves next)">
                {(id) => (
                  <Select
                    id={id}
                    value={form.owner}
                    onChange={(e) => set({ owner: e.target.value })}
                  >
                    {OWNERS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
            <Field label="Priority">
              {(id) => (
                <Select
                  id={id}
                  value={form.priority ?? ""}
                  onChange={(e) => set({ priority: e.target.value || null })}
                >
                  <option value="">—</option>
                  {PRIORITIES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <Field
            label="Context summary"
            hint="2–3 lines: who is this / what do they want"
          >
            {(id) => (
              <Textarea
                id={id}
                value={form.contextSummary ?? ""}
                onChange={(e) => set({ contextSummary: e.target.value })}
                placeholder="The story so far…"
              />
            )}
          </Field>
          <div className="grid grid-cols-[1fr_140px] gap-3">
            <Field label="Next action">
              {(id) => (
                <Input
                  id={id}
                  value={form.nextAction ?? ""}
                  onChange={(e) => set({ nextAction: e.target.value })}
                  placeholder="The single next thing to do"
                />
              )}
            </Field>
            <Field
              label="Follow-up date"
              error={errors.nextActionDate}
              hint={
                type === "supplier" && formProfile
                  ? `Discord will remind ${formProfile.name} that day.`
                  : undefined
              }
            >
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={form.nextActionDate ?? ""}
                  aria-invalid={errors.nextActionDate ? true : undefined}
                  onChange={(e) => set({ nextActionDate: e.target.value })}
                />
              )}
            </Field>
          </div>
        </section>

        {!creating && onQuickAction ? (
          <QuickActionBar record={record} onSelect={onQuickAction} />
        ) : null}

        {/* ---- Identity ---- */}
        <section className="grid grid-cols-2 gap-3">
          <Field label="Name" className="col-span-2" error={errors.name}>
            {(id) => (
              <Input
                id={id}
                value={form.name ?? ""}
                required
                aria-invalid={errors.name ? true : undefined}
                onChange={(e) => set({ name: e.target.value })}
              />
            )}
          </Field>
          <Field label="Company">
            {(id) => (
              <Input
                id={id}
                value={form.company ?? ""}
                onChange={(e) => set({ company: e.target.value })}
              />
            )}
          </Field>
          <Field label="Main contact">
            {(id) => (
              <Input
                id={id}
                value={form.mainContact ?? ""}
                onChange={(e) => set({ mainContact: e.target.value })}
              />
            )}
          </Field>
          <Field label="Email" error={errors.email}>
            {(id) => (
              <Input
                id={id}
                type="email"
                value={form.email ?? ""}
                aria-invalid={errors.email ? true : undefined}
                onChange={(e) => set({ email: e.target.value })}
              />
            )}
          </Field>
          <Field label="Phone">
            {(id) => (
              <Input
                id={id}
                value={form.phone ?? ""}
                onChange={(e) => set({ phone: e.target.value })}
              />
            )}
          </Field>
          <Field
            label="Last contact"
            className="col-span-2"
            error={errors.lastContactDate}
            hint="Set automatically when you log a call or an email."
          >
            {(id) => (
              <Input
                id={id}
                type="date"
                value={form.lastContactDate ?? ""}
                aria-invalid={errors.lastContactDate ? true : undefined}
                onChange={(e) => set({ lastContactDate: e.target.value })}
              />
            )}
          </Field>
        </section>

        {/* ---- Type-specific ---- */}
        {type === "supplier" ? (
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold tracking-widest text-muted uppercase">
              Supplier details
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <label className="surface-muted flex cursor-pointer items-center gap-2 rounded-control px-3 py-2.5 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={form.initialEmailSent === true}
                  onChange={(e) => set({ initialEmailSent: e.target.checked })}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                Emailed before
              </label>
              <label className="surface-muted flex cursor-pointer items-center gap-2 rounded-control px-3 py-2.5 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={form.dealerApplicationSigned === true}
                  onChange={(e) =>
                    set({ dealerApplicationSigned: e.target.checked })
                  }
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                Dealer application signed
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Niche">
                {(id) => (
                  <Input
                    id={id}
                    value={form.niche ?? ""}
                    onChange={(e) => set({ niche: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Cluster">
                {(id) => (
                  <Select
                    id={id}
                    value={form.cluster}
                    onChange={(e) => set({ cluster: e.target.value })}
                  >
                    {clusters.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Rank">
                {(id) => (
                  <Select
                    id={id}
                    value={form.rank ?? ""}
                    onChange={(e) => set({ rank: e.target.value || null })}
                  >
                    <option value="">Unranked</option>
                    {RANKS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Best seller">
                {(id) => (
                  <Input
                    id={id}
                    value={form.bestSeller ?? ""}
                    onChange={(e) => set({ bestSeller: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Website">
                {(id) => (
                  <span className="flex items-center gap-1.5">
                    <Input
                      id={id}
                      value={form.websiteUrl ?? ""}
                      onChange={(e) => set({ websiteUrl: e.target.value })}
                    />
                    {form.websiteUrl ? (
                      <a
                        href={form.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted hover:text-ink"
                        aria-label="Open website"
                      >
                        <ExternalLink size={14} aria-hidden />
                      </a>
                    ) : null}
                  </span>
                )}
              </Field>
              <Field label="Dealer application URL">
                {(id) => (
                  <Input
                    id={id}
                    value={form.dealerAppUrl ?? ""}
                    onChange={(e) => set({ dealerAppUrl: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Dealer program">
                {(id) => (
                  <Select
                    id={id}
                    value={form.dealerProgram ?? ""}
                    onChange={(e) => set({ dealerProgram: e.target.value || null })}
                  >
                    <option value="">Unknown</option>
                    <option value="dropship">Dropship</option>
                    <option value="stocking">Stocking</option>
                    <option value="none">None</option>
                  </Select>
                )}
              </Field>
              <Field label="Authorization">
                {(id) => (
                  <Select
                    id={id}
                    value={form.authorizationStatus ?? ""}
                    onChange={(e) =>
                      set({ authorizationStatus: e.target.value || null })
                    }
                  >
                    <option value="">None</option>
                    <option value="pending">Pending</option>
                    <option value="authorized">Authorized</option>
                  </Select>
                )}
              </Field>
              <Field label="Media permission">
                {(id) => (
                  <Select
                    id={id}
                    value={form.mediaPermission ?? ""}
                    onChange={(e) =>
                      set({ mediaPermission: e.target.value || null })
                    }
                  >
                    <option value="">None</option>
                    <option value="requested">Requested</option>
                    <option value="granted">Granted</option>
                  </Select>
                )}
              </Field>
              <Field label="MAP policy">
                {(id) => (
                  <Input
                    id={id}
                    value={form.mapPolicy ?? ""}
                    onChange={(e) => set({ mapPolicy: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Freight model">
                {(id) => (
                  <Input
                    id={id}
                    value={form.freightModel ?? ""}
                    onChange={(e) => set({ freightModel: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Lead time">
                {(id) => (
                  <Input
                    id={id}
                    value={form.leadTime ?? ""}
                    onChange={(e) => set({ leadTime: e.target.value })}
                    placeholder="e.g. 2–3 weeks"
                  />
                )}
              </Field>
              <Field label="Warranty">
                {(id) => (
                  <Input
                    id={id}
                    value={form.warranty ?? ""}
                    onChange={(e) => set({ warranty: e.target.value })}
                  />
                )}
              </Field>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold tracking-widest text-muted uppercase">
                  Contact people
                </h4>
                <p className="mt-1 text-[11px] text-muted">
                  Sales reps, dealer managers, and every direct line you are
                  redirected to.
                </p>
              </div>
              <Button variant="subtle" size="sm" onClick={addContact}>
                <Plus size={13} aria-hidden />
                Add person
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {(form.supplierContacts ?? []).map((contact) => (
                <div
                  key={contact.id}
                  className="surface-muted grid grid-cols-2 gap-2 rounded-card p-3"
                >
                  <Field label="Name">
                    {(id) => (
                      <Input
                        id={id}
                        value={contact.name}
                        onChange={(e) =>
                          updateContact(contact.id, { name: e.target.value })
                        }
                        placeholder="Mark"
                      />
                    )}
                  </Field>
                  <Field label="Role">
                    {(id) => (
                      <Input
                        id={id}
                        value={contact.role}
                        onChange={(e) =>
                          updateContact(contact.id, { role: e.target.value })
                        }
                        placeholder="Sales representative"
                      />
                    )}
                  </Field>
                  <Field label="Direct phone">
                    {(id) => (
                      <Input
                        id={id}
                        value={contact.phone}
                        onChange={(e) =>
                          updateContact(contact.id, { phone: e.target.value })
                        }
                      />
                    )}
                  </Field>
                  <Field label="Direct email">
                    {(id) => (
                      <Input
                        id={id}
                        type="email"
                        value={contact.email}
                        onChange={(e) =>
                          updateContact(contact.id, { email: e.target.value })
                        }
                      />
                    )}
                  </Field>
                  <Field label="What to know" className="col-span-2">
                    {(id) => (
                      <Textarea
                        id={id}
                        value={contact.notes}
                        onChange={(e) =>
                          updateContact(contact.id, { notes: e.target.value })
                        }
                        placeholder="Best time to call, what they asked us to email, decision authority…"
                      />
                    )}
                  </Field>
                  <label className="flex items-center gap-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={contact.isPrimary}
                      onChange={(e) =>
                        updateContact(contact.id, {
                          isPrimary: e.target.checked,
                        })
                      }
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                    Primary contact
                  </label>
                  <button
                    type="button"
                    onClick={() => removeContact(contact.id)}
                    className="press ml-auto inline-flex items-center gap-1 text-xs text-danger"
                  >
                    <Trash2 size={12} aria-hidden />
                    Remove
                  </button>
                </div>
              ))}
              {(form.supplierContacts?.length ?? 0) === 0 ? (
                <p className="rounded-control border border-dashed border-hairline px-3 py-4 text-center text-xs text-muted">
                  No direct contacts yet.
                </p>
              ) : null}
            </div>
          </section>
        ) : (
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold tracking-widest text-muted uppercase">
              Lead details
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Product interest" className="col-span-2">
                {(id) => (
                  <Input
                    id={id}
                    value={form.productInterest ?? ""}
                    onChange={(e) => set({ productInterest: e.target.value })}
                    placeholder="Which product / collection they asked about"
                  />
                )}
              </Field>
              <Field label="Intent">
                {(id) => (
                  <Select
                    id={id}
                    value={form.intent ?? ""}
                    onChange={(e) => set({ intent: e.target.value || null })}
                  >
                    <option value="">Unknown</option>
                    <option value="browsing">Browsing</option>
                    <option value="comparing">Comparing</option>
                    <option value="ready-to-buy">Ready to buy</option>
                  </Select>
                )}
              </Field>
              <Field label="Quote amount ($)">
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    min={0}
                    value={form.quoteAmount ?? ""}
                    onChange={(e) =>
                      set({
                        quoteAmount:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                )}
              </Field>
            </div>
          </section>
        )}

        <Field label="Notes">
          {(id) => (
            <Textarea
              id={id}
              value={form.notes ?? ""}
              onChange={(e) => set({ notes: e.target.value })}
            />
          )}
        </Field>

        {/* ---- Tags (read-only; maintained by imports/migrations/agent) ---- */}
        {!creating && record.tags.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {record.tags.map((t) => (
              <Chip key={t} label={t} />
            ))}
          </div>
        ) : null}

        {/* ---- Calls (Quo) ----
             Its own section above the activity log: a call carries a
             recording, a transcript and an AI read, none of which fit
             the one-line shape of an interaction. The list loads
             lazily and holds no transcript text until expanded. */}
        {!creating ? (
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold tracking-widest text-muted uppercase">
              Calls
            </h3>
            <CallTimeline recordId={record.id} />
          </section>
        ) : null}

        {/* ---- Activity log ---- */}
        {!creating ? (
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold tracking-widest text-muted uppercase">
              Activity log
            </h3>
            <div className="flex items-start gap-2">
              <div className="w-28 shrink-0">
                <Select
                  value={logType}
                  onChange={(e) => setLogType(e.target.value as InteractionType)}
                  aria-label="Interaction type"
                >
                  {INTERACTION_TYPES.filter(
                    (t) => t.id !== "system" && t.id !== "status",
                  ).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex-1">
                <Input
                  value={logBody}
                  onChange={(e) => {
                    setLogBody(e.target.value);
                    if (logError) setLogError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void submitLog();
                  }}
                  aria-invalid={logError ? true : undefined}
                  placeholder="Log an email, call, or note…"
                  aria-label="Interaction body"
                />
                {logError ? (
                  <p role="alert" className="mt-1 text-[11px] text-danger">
                    {logError}
                  </p>
                ) : null}
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={submitLog}
                aria-label="Log interaction"
              >
                <Send size={13} aria-hidden />
              </Button>
            </div>
            <ul className="flex flex-col gap-2">
              {record.interactions.map((i) => (
                <li
                  key={i.id}
                  className="surface-muted rounded-card px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2 text-[11px] text-muted">
                    <span className="font-semibold uppercase">{i.type}</span>
                    <span>·</span>
                    <span>{i.actor}</span>
                    <span className="num ml-auto">{shortDate(i.date)}</span>
                    {/* Two-step delete: the log is the CRM's memory, so
                        removing an entry asks first, inline. */}
                    {confirmDeleteLog === i.id ? (
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDeleteLog(null);
                            void onDeleteInteraction(i.id);
                          }}
                          className="press rounded-control px-1.5 py-0.5 font-medium text-danger hover:bg-[var(--red-soft)]"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteLog(null)}
                          className="press rounded-control px-1.5 py-0.5 hover:text-ink"
                        >
                          Keep
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteLog(i.id)}
                        aria-label={`Delete this ${i.type} entry`}
                        className="press rounded-control p-1 hover:bg-[var(--red-soft)] hover:text-danger"
                      >
                        <Trash2 size={11} aria-hidden />
                      </button>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-ink">{i.body}</p>
                </li>
              ))}
              {record.interactions.length === 0 ? (
                <li className="text-xs text-muted">
                  No activity yet — log the first call, email, or note above.
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}
      </div>
    </Drawer>
  );
}
