"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Send, Trash2 } from "lucide-react";
import {
  CLUSTERS,
  INTERACTION_TYPES,
  OWNERS,
  PRIORITIES,
  RANKS,
  stagesFor,
  type InteractionType,
  type RecordDTO,
  type RecordType,
} from "@/lib/domain";
import { shortDate } from "@/lib/utils";
import { Drawer } from "@/components/kit/Drawer";
import { Button } from "@/components/kit/Button";
import { Field, Input, Select, Textarea } from "@/components/kit/Field";
import { Chip } from "@/components/kit/Chip";
import { OwnerBadge, PriorityBadge, StageBadge } from "@/components/crm/badges";

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
  onClose: () => void;
  onSave: (data: RecordFormData) => void | Promise<void>;
  onDelete: () => void;
  onLogInteraction: (type: InteractionType, body: string) => void | Promise<void>;
}

const dateInput = (iso: string | null | undefined) =>
  iso ? iso.slice(0, 10) : "";

function buildForm(r: RecordDTO | null, createType: RecordType): RecordFormData {
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
  onClose,
  onSave,
  onDelete,
  onLogInteraction,
}: RecordDrawerProps) {
  const creating = record === null;
  const [form, setForm] = useState<RecordFormData>(() =>
    buildForm(record, createType),
  );
  const [logType, setLogType] = useState<InteractionType>("note");
  const [logBody, setLogBody] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(buildForm(record, createType));
  }, [open, record, createType]);

  const type: RecordType = (form.type as RecordType) ?? "supplier";
  const stages = useMemo(() => stagesFor(type), [type]);

  const set = (patch: Partial<RecordFormData>) =>
    setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
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
    if (!body) return;
    await onLogInteraction(logType, body);
    setLogBody("");
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
            <OwnerBadge owner={record.owner} />
          </span>
        )
      }
      footer={
        <div className="flex items-center gap-2">
          {!creating ? (
            <Button variant="ghost" size="sm" onClick={onDelete}>
              <Trash2 size={13} aria-hidden />
              Delete
            </Button>
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
                      set({ type: t, status: t === "lead" ? "NEW" : "SOURCED" });
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
            <Field label="Due">
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={form.nextActionDate ?? ""}
                  onChange={(e) => set({ nextActionDate: e.target.value })}
                />
              )}
            </Field>
          </div>
        </section>

        {/* ---- Identity ---- */}
        <section className="grid grid-cols-2 gap-3">
          <Field label="Name" className="col-span-2">
            {(id) => (
              <Input
                id={id}
                value={form.name ?? ""}
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
          <Field label="Email">
            {(id) => (
              <Input
                id={id}
                type="email"
                value={form.email ?? ""}
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
        </section>

        {/* ---- Type-specific ---- */}
        {type === "supplier" ? (
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold tracking-widest text-muted uppercase">
              Supplier details
            </h3>
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
                    {CLUSTERS.map((c) => (
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
              <Input
                value={logBody}
                onChange={(e) => setLogBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submitLog();
                }}
                placeholder="Log an email, call, or note…"
                aria-label="Interaction body"
              />
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
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-ink">{i.body}</p>
                </li>
              ))}
              {record.interactions.length === 0 ? (
                <li className="text-xs text-muted">No activity yet.</li>
              ) : null}
            </ul>
          </section>
        ) : null}
      </div>
    </Drawer>
  );
}
