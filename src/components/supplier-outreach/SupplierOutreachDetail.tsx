"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  PhoneCall,
  Plus,
  Save,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import {
  INTERACTION_TYPES,
  PRIORITIES,
  RANKS,
  SUPPLIER_STAGES,
  type InteractionType,
  type RecordDTO,
  type SupplierContactDTO,
  type TeamProfileDTO,
} from "@/lib/domain";
import { api } from "@/lib/api";
import { shortDate } from "@/lib/utils";
import { Button } from "@/components/kit/Button";
import { Field, Input, Select, Textarea } from "@/components/kit/Field";
import {
  PriorityBadge,
  StageBadge,
  TeamProfileBadge,
} from "@/components/crm/badges";
import { CallTimeline } from "@/components/crm/CallTimeline";
import { DialButton } from "@/components/crm/DialButton";
import { useToast } from "@/components/kit/Toast";

interface SupplierOutreachDetailProps {
  initialRecord: RecordDTO | null;
  profiles: TeamProfileDTO[];
  clusterOptions: string[];
  backHref?: string;
  backLabel?: string;
}

interface SupplierForm {
  name: string;
  company: string;
  niche: string;
  cluster: string;
  bestSeller: string;
  rank: string;
  websiteUrl: string;
  dealerAppUrl: string;
  mainContact: string;
  email: string;
  phone: string;
  status: string;
  supplierOwnerId: string;
  priority: string;
  contextSummary: string;
  mapPolicy: string;
  dropship: "" | "yes" | "no";
  freightModel: string;
  leadTime: string;
  warranty: string;
  productCategories: string;
  dealerProgram: string;
  mediaPermission: string;
  authorizationStatus: string;
  dealerApplicationSigned: boolean;
  initialEmailSent: boolean;
  supplierContacts: SupplierContactDTO[];
  lastContactDate: string;
  nextAction: string;
  nextActionDate: string;
  notes: string;
  tags: string;
}

type Errors = Partial<
  Record<"name" | "email" | "nextActionDate" | "lastContactDate" | "contacts", string>
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const dateInput = (value: string | null | undefined) =>
  value ? value.slice(0, 10) : "";

function buildForm(
  record: RecordDTO | null,
  defaultProfileId: string,
): SupplierForm {
  return {
    name: record?.name ?? "",
    company: record?.company ?? "",
    niche: record?.niche ?? "",
    cluster: record?.cluster ?? "Other",
    bestSeller: record?.bestSeller ?? "",
    rank: record?.rank ?? "",
    websiteUrl: record?.websiteUrl ?? "",
    dealerAppUrl: record?.dealerAppUrl ?? "",
    mainContact: record?.mainContact ?? "",
    email: record?.email ?? "",
    phone: record?.phone ?? "",
    status: record?.status ?? "SOURCED",
    supplierOwnerId: record?.supplierOwnerId ?? defaultProfileId,
    priority: record?.priority ?? "",
    contextSummary: record?.contextSummary ?? "",
    mapPolicy: record?.mapPolicy ?? "",
    dropship:
      record?.dropship === true
        ? "yes"
        : record?.dropship === false
          ? "no"
          : "",
    freightModel: record?.freightModel ?? "",
    leadTime: record?.leadTime ?? "",
    warranty: record?.warranty ?? "",
    productCategories: record?.productCategories.join(", ") ?? "",
    dealerProgram: record?.dealerProgram ?? "",
    mediaPermission: record?.mediaPermission ?? "",
    authorizationStatus: record?.authorizationStatus ?? "",
    dealerApplicationSigned: record?.dealerApplicationSigned ?? false,
    initialEmailSent: record?.initialEmailSent ?? false,
    supplierContacts: record?.supplierContacts ?? [],
    lastContactDate: dateInput(record?.lastContactDate),
    nextAction: record?.nextAction ?? "",
    nextActionDate: dateInput(record?.nextActionDate),
    notes: record?.notes ?? "",
    tags: record?.tags.join(", ") ?? "",
  };
}

function validate(form: SupplierForm): Errors {
  const errors: Errors = {};
  if (!form.name.trim()) errors.name = "Supplier name is required.";
  if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  for (const field of ["nextActionDate", "lastContactDate"] as const) {
    if (form[field] && Number.isNaN(new Date(form[field]).getTime())) {
      errors[field] = "Use a valid date.";
    }
  }
  const invalidContact = form.supplierContacts.find(
    (contact) =>
      !contact.name.trim() ||
      (contact.email.trim() && !EMAIL_RE.test(contact.email.trim())),
  );
  if (invalidContact) {
    errors.contacts =
      "Each contact needs a name and, when provided, a valid email.";
  }
  return errors;
}

function splitList(value: string) {
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function externalUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function SectionCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-raised rounded-panel p-5 md:p-6">
      <div className="mb-5 flex items-start gap-3">
        {icon ? (
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-[var(--accent-soft)] text-[var(--accent-bright)]">
            {icon}
          </span>
        ) : null}
        <div>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs leading-5 text-muted">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function SupplierOutreachDetail({
  initialRecord,
  profiles,
  clusterOptions,
  backHref = "/supplier-outreach",
  backLabel = "Supplier Outreach",
}: SupplierOutreachDetailProps) {
  const creating = initialRecord === null;
  const router = useRouter();
  const { toast } = useToast();
  const [record, setRecord] = useState(initialRecord);
  const [form, setForm] = useState(() =>
    buildForm(initialRecord, profiles[0]?.id ?? "seat_1"),
  );
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [logType, setLogType] = useState<InteractionType>("note");
  const [logBody, setLogBody] = useState("");
  const [logging, setLogging] = useState(false);
  const [confirmDeleteLog, setConfirmDeleteLog] = useState<string | null>(null);

  const clusters = useMemo(() => {
    const values = new Set(clusterOptions);
    if (form.cluster) values.add(form.cluster);
    values.add("Other");
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [clusterOptions, form.cluster]);

  const selectedProfile =
    profiles.find((profile) => profile.id === form.supplierOwnerId) ?? null;
  const websiteLink = externalUrl(form.websiteUrl);
  const dealerAppLink = externalUrl(form.dealerAppUrl);

  const set = (patch: Partial<SupplierForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    const touched = Object.keys(patch) as (keyof Errors)[];
    setErrors((current) => {
      if (!touched.some((key) => current[key])) return current;
      const next = { ...current };
      for (const key of touched) delete next[key];
      return next;
    });
  };

  const payload = () => ({
    type: "supplier" as const,
    name: form.name,
    company: form.company,
    niche: form.niche,
    cluster: form.cluster,
    bestSeller: form.bestSeller,
    rank: form.rank || null,
    websiteUrl: form.websiteUrl,
    dealerAppUrl: form.dealerAppUrl,
    mainContact: form.mainContact,
    email: form.email,
    phone: form.phone,
    status: form.status,
    supplierOwnerId: form.supplierOwnerId,
    priority: form.priority || null,
    contextSummary: form.contextSummary,
    mapPolicy: form.mapPolicy,
    dropship:
      form.dropship === "yes" ? true : form.dropship === "no" ? false : null,
    freightModel: form.freightModel,
    leadTime: form.leadTime,
    warranty: form.warranty,
    productCategories: splitList(form.productCategories),
    dealerProgram: form.dealerProgram,
    mediaPermission: form.mediaPermission,
    authorizationStatus: form.authorizationStatus,
    dealerApplicationSigned: form.dealerApplicationSigned,
    initialEmailSent: form.initialEmailSent,
    supplierContacts: form.supplierContacts,
    lastContactDate: form.lastContactDate || null,
    nextAction: form.nextAction,
    nextActionDate: form.nextActionDate || null,
    notes: form.notes,
    tags: splitList(form.tags),
  });

  const save = async () => {
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast({
        title: "Check the highlighted fields",
        tone: "error",
      });
      return;
    }

    setSaving(true);
    try {
      const next = creating
        ? await api.createRecord(payload())
        : await api.updateRecord(record!.id, payload());
      setRecord(next);
      setForm(buildForm(next, profiles[0]?.id ?? "seat_1"));
      toast({
        title: creating ? `${next.name} added` : "Changes saved",
        tone: "success",
      });
      if (creating) {
        router.replace(`/supplier-outreach/${next.id}`);
      }
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
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
      isPrimary: form.supplierContacts.length === 0,
    };
    set({ supplierContacts: [...form.supplierContacts, contact] });
  };

  const updateContact = (
    id: string,
    patch: Partial<SupplierContactDTO>,
  ) => {
    set({
      supplierContacts: form.supplierContacts.map((contact) =>
        contact.id === id ? { ...contact, ...patch } : contact,
      ),
    });
    if (errors.contacts) {
      setErrors((current) => ({ ...current, contacts: undefined }));
    }
  };

  const removeContact = (id: string) => {
    set({
      supplierContacts: form.supplierContacts.filter(
        (contact) => contact.id !== id,
      ),
    });
  };

  const logInteraction = async () => {
    if (!record || !logBody.trim()) return;
    setLogging(true);
    try {
      const next = await api.logInteraction(record.id, {
        type: logType,
        body: logBody.trim(),
      });
      setRecord(next);
      // Logging should never erase other edits that have not been saved yet.
      // Only sync the date the API may advance for a call or email.
      setForm((current) => ({
        ...current,
        lastContactDate: dateInput(next.lastContactDate),
      }));
      setLogBody("");
      toast({ title: "Activity logged", tone: "success" });
    } catch (error) {
      toast({
        title: "Couldn't log activity",
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    } finally {
      setLogging(false);
    }
  };

  const deleteInteraction = async (id: string) => {
    if (!record) return;
    try {
      await api.deleteInteraction(id);
      setRecord({
        ...record,
        interactions: record.interactions.filter(
          (interaction) => interaction.id !== id,
        ),
      });
      setConfirmDeleteLog(null);
    } catch (error) {
      toast({
        title: "Couldn't remove activity",
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Link
        href={backHref}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft size={15} aria-hidden />
        {backLabel}
      </Link>

      <header className="surface-raised sticky top-16 z-20 flex flex-col gap-4 rounded-panel px-5 py-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold tracking-tight text-ink">
              {creating ? "New supplier" : record?.name}
            </h1>
            {!creating && record ? (
              <>
                <StageBadge stage={record.status} />
                <PriorityBadge priority={record.priority} />
                <TeamProfileBadge profile={record.supplierOwner} />
              </>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted">
            {creating
              ? "Add the essentials now. Everything else can be filled in later."
              : "All supplier information, follow-up planning, contacts, and history."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!creating && record ? (
            <>
              <Link
                href={`/cockpit/${record.id}`}
                className="press inline-flex h-10 items-center justify-center gap-2 rounded-control border border-hairline bg-[var(--panel)] px-4 text-sm font-medium text-ink shadow-sm hover:border-[var(--hairline-strong)]"
              >
                <PhoneCall size={15} aria-hidden />
                Open call workspace
              </Link>
              <DialButton
                phone={record.phone}
                label="Call in Quo"
                size="md"
              />
            </>
          ) : null}
          <Button
            variant="primary"
            onClick={() => void save()}
            disabled={saving}
          >
            <Save size={15} aria-hidden />
            {saving
              ? "Saving…"
              : creating
                ? "Create supplier"
                : "Save changes"}
          </Button>
        </div>
      </header>

      <SectionCard
        title="Next move"
        description="The only fields you need while actively following up."
        icon={<FileText size={16} aria-hidden />}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Status">
            {(id) => (
              <Select
                id={id}
                value={form.status}
                onChange={(event) => set({ status: event.target.value })}
              >
                {SUPPLIER_STAGES.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Assigned to">
            {(id) => (
              <Select
                id={id}
                value={form.supplierOwnerId}
                onChange={(event) =>
                  set({ supplierOwnerId: event.target.value })
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
          <Field label="Lead warmth">
            {(id) => (
              <Select
                id={id}
                value={form.priority}
                onChange={(event) => set({ priority: event.target.value })}
              >
                <option value="">Not set</option>
                {PRIORITIES.map((priority) => (
                  <option key={priority.id} value={priority.id}>
                    {priority.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            label="Follow-up date"
            error={errors.nextActionDate}
            hint={
              selectedProfile
                ? `Discord will remind ${selectedProfile.name} that day.`
                : undefined
            }
          >
            {(id) => (
              <Input
                id={id}
                type="date"
                value={form.nextActionDate}
                aria-invalid={errors.nextActionDate ? true : undefined}
                onChange={(event) =>
                  set({ nextActionDate: event.target.value })
                }
              />
            )}
          </Field>
          <Field label="Next action" className="sm:col-span-2 lg:col-span-4">
            {(id) => (
              <Input
                id={id}
                value={form.nextAction}
                onChange={(event) => set({ nextAction: event.target.value })}
                placeholder="What exactly needs to happen next?"
              />
            )}
          </Field>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="surface-muted flex cursor-pointer items-center gap-3 rounded-control px-4 py-3 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.initialEmailSent}
              onChange={(event) =>
                set({ initialEmailSent: event.target.checked })
              }
              className="h-4 w-4 accent-[var(--accent)]"
            />
            Emailed before
          </label>
          <label className="surface-muted flex cursor-pointer items-center gap-3 rounded-control px-4 py-3 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.dealerApplicationSigned}
              onChange={(event) =>
                set({ dealerApplicationSigned: event.target.checked })
              }
              className="h-4 w-4 accent-[var(--accent)]"
            />
            Dealer application signed
          </label>
        </div>
      </SectionCard>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
        <div className="flex flex-col gap-5">
          <SectionCard
            title="Contact details"
            description="The main supplier line and general point of contact."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Supplier name"
                className="sm:col-span-2"
                error={errors.name}
              >
                {(id) => (
                  <Input
                    id={id}
                    value={form.name}
                    required
                    aria-invalid={errors.name ? true : undefined}
                    onChange={(event) => set({ name: event.target.value })}
                  />
                )}
              </Field>
              <Field label="Company / legal name">
                {(id) => (
                  <Input
                    id={id}
                    value={form.company}
                    onChange={(event) => set({ company: event.target.value })}
                  />
                )}
              </Field>
              <Field label="Main contact">
                {(id) => (
                  <Input
                    id={id}
                    value={form.mainContact}
                    onChange={(event) =>
                      set({ mainContact: event.target.value })
                    }
                  />
                )}
              </Field>
              <Field label="Phone number">
                {(id) => (
                  <Input
                    id={id}
                    value={form.phone}
                    onChange={(event) => set({ phone: event.target.value })}
                  />
                )}
              </Field>
              <Field label="Email" error={errors.email}>
                {(id) => (
                  <Input
                    id={id}
                    type="email"
                    value={form.email}
                    aria-invalid={errors.email ? true : undefined}
                    onChange={(event) => set({ email: event.target.value })}
                  />
                )}
              </Field>
              <Field label="Website">
                {(id) => (
                  <div className="flex items-center gap-2">
                    <Input
                      id={id}
                      value={form.websiteUrl}
                      onChange={(event) =>
                        set({ websiteUrl: event.target.value })
                      }
                    />
                    {websiteLink ? (
                      <a
                        href={websiteLink}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open supplier website"
                        className="press rounded-control border border-hairline bg-[var(--panel)] p-2.5 text-muted hover:text-ink"
                      >
                        <ExternalLink size={14} aria-hidden />
                      </a>
                    ) : null}
                  </div>
                )}
              </Field>
              <Field label="Dealer application URL">
                {(id) => (
                  <div className="flex items-center gap-2">
                    <Input
                      id={id}
                      value={form.dealerAppUrl}
                      onChange={(event) =>
                        set({ dealerAppUrl: event.target.value })
                      }
                    />
                    {dealerAppLink ? (
                      <a
                        href={dealerAppLink}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open dealer application"
                        className="press rounded-control border border-hairline bg-[var(--panel)] p-2.5 text-muted hover:text-ink"
                      >
                        <ExternalLink size={14} aria-hidden />
                      </a>
                    ) : null}
                  </div>
                )}
              </Field>
              <Field
                label="Last contact"
                className="sm:col-span-2"
                error={errors.lastContactDate}
                hint="Updated automatically when a call or email is logged."
              >
                {(id) => (
                  <Input
                    id={id}
                    type="date"
                    value={form.lastContactDate}
                    aria-invalid={errors.lastContactDate ? true : undefined}
                    onChange={(event) =>
                      set({ lastContactDate: event.target.value })
                    }
                  />
                )}
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="Contact people"
            description="Sales reps, dealer managers, direct lines, and anyone else involved."
            icon={<Users size={16} aria-hidden />}
          >
            <div className="mb-4 flex justify-end">
              <Button variant="ghost" size="sm" onClick={addContact}>
                <Plus size={13} aria-hidden />
                Add person
              </Button>
            </div>
            {errors.contacts ? (
              <p role="alert" className="mb-3 text-xs text-danger">
                {errors.contacts}
              </p>
            ) : null}
            <div className="flex flex-col gap-3">
              {form.supplierContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="surface-muted grid gap-3 rounded-card p-4 sm:grid-cols-2"
                >
                  <Field label="Name">
                    {(id) => (
                      <Input
                        id={id}
                        value={contact.name}
                        onChange={(event) =>
                          updateContact(contact.id, {
                            name: event.target.value,
                          })
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
                        onChange={(event) =>
                          updateContact(contact.id, {
                            role: event.target.value,
                          })
                        }
                        placeholder="Sales representative"
                      />
                    )}
                  </Field>
                  <Field label="Direct phone">
                    {(id) => (
                      <div className="flex items-center gap-2">
                        <Input
                          id={id}
                          value={contact.phone}
                          onChange={(event) =>
                            updateContact(contact.id, {
                              phone: event.target.value,
                            })
                          }
                        />
                        <DialButton phone={contact.phone} label="Call" />
                      </div>
                    )}
                  </Field>
                  <Field label="Direct email">
                    {(id) => (
                      <Input
                        id={id}
                        type="email"
                        value={contact.email}
                        onChange={(event) =>
                          updateContact(contact.id, {
                            email: event.target.value,
                          })
                        }
                      />
                    )}
                  </Field>
                  <Field label="What to know" className="sm:col-span-2">
                    {(id) => (
                      <Textarea
                        id={id}
                        value={contact.notes}
                        onChange={(event) =>
                          updateContact(contact.id, {
                            notes: event.target.value,
                          })
                        }
                        placeholder="Best time to call, what they requested, decision authority…"
                      />
                    )}
                  </Field>
                  <label className="flex items-center gap-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={contact.isPrimary}
                      onChange={(event) =>
                        updateContact(contact.id, {
                          isPrimary: event.target.checked,
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
              {form.supplierContacts.length === 0 ? (
                <p className="rounded-control border border-dashed border-hairline px-4 py-6 text-center text-xs text-muted">
                  No direct contacts yet.
                </p>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            title="Notes"
            description="Keep the story and the practical details in one place."
          >
            <div className="flex flex-col gap-4">
              <Field label="Quick context">
                {(id) => (
                  <Textarea
                    id={id}
                    value={form.contextSummary}
                    onChange={(event) =>
                      set({ contextSummary: event.target.value })
                    }
                    placeholder="Who they are and where the conversation stands…"
                  />
                )}
              </Field>
              <Field label="Detailed notes">
                {(id) => (
                  <Textarea
                    id={id}
                    value={form.notes}
                    onChange={(event) => set({ notes: event.target.value })}
                    className="min-h-40"
                  />
                )}
              </Field>
            </div>
          </SectionCard>
        </div>

        <div className="flex flex-col gap-5">
          <SectionCard title="Supplier information">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Field label="Niche">
                {(id) => (
                  <Input
                    id={id}
                    value={form.niche}
                    onChange={(event) => set({ niche: event.target.value })}
                  />
                )}
              </Field>
              <Field label="Cluster">
                {(id) => (
                  <Select
                    id={id}
                    value={form.cluster}
                    onChange={(event) => set({ cluster: event.target.value })}
                  >
                    {clusters.map((cluster) => (
                      <option key={cluster} value={cluster}>
                        {cluster}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Rank">
                {(id) => (
                  <Select
                    id={id}
                    value={form.rank}
                    onChange={(event) => set({ rank: event.target.value })}
                  >
                    <option value="">Unranked</option>
                    {RANKS.map((rank) => (
                      <option key={rank} value={rank}>
                        {rank}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Best seller">
                {(id) => (
                  <Input
                    id={id}
                    value={form.bestSeller}
                    onChange={(event) =>
                      set({ bestSeller: event.target.value })
                    }
                  />
                )}
              </Field>
              <Field
                label="Product categories"
                className="sm:col-span-2 lg:col-span-1 xl:col-span-2"
                hint="Separate with commas."
              >
                {(id) => (
                  <Input
                    id={id}
                    value={form.productCategories}
                    onChange={(event) =>
                      set({ productCategories: event.target.value })
                    }
                  />
                )}
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="Program & operations">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Field label="Dealer program">
                {(id) => (
                  <Select
                    id={id}
                    value={form.dealerProgram}
                    onChange={(event) =>
                      set({ dealerProgram: event.target.value })
                    }
                  >
                    <option value="">Unknown</option>
                    <option value="dropship">Dropship</option>
                    <option value="stocking">Stocking</option>
                    <option value="none">None</option>
                  </Select>
                )}
              </Field>
              <Field label="Dropship available">
                {(id) => (
                  <Select
                    id={id}
                    value={form.dropship}
                    onChange={(event) =>
                      set({
                        dropship: event.target.value as "" | "yes" | "no",
                      })
                    }
                  >
                    <option value="">Unknown</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </Select>
                )}
              </Field>
              <Field label="Authorization">
                {(id) => (
                  <Select
                    id={id}
                    value={form.authorizationStatus}
                    onChange={(event) =>
                      set({ authorizationStatus: event.target.value })
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
                    value={form.mediaPermission}
                    onChange={(event) =>
                      set({ mediaPermission: event.target.value })
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
                    value={form.mapPolicy}
                    onChange={(event) => set({ mapPolicy: event.target.value })}
                  />
                )}
              </Field>
              <Field label="Freight model">
                {(id) => (
                  <Input
                    id={id}
                    value={form.freightModel}
                    onChange={(event) =>
                      set({ freightModel: event.target.value })
                    }
                  />
                )}
              </Field>
              <Field label="Lead time">
                {(id) => (
                  <Input
                    id={id}
                    value={form.leadTime}
                    onChange={(event) => set({ leadTime: event.target.value })}
                  />
                )}
              </Field>
              <Field label="Warranty">
                {(id) => (
                  <Input
                    id={id}
                    value={form.warranty}
                    onChange={(event) => set({ warranty: event.target.value })}
                  />
                )}
              </Field>
              <Field
                label="Tags"
                className="sm:col-span-2 lg:col-span-1 xl:col-span-2"
                hint="Separate with commas."
              >
                {(id) => (
                  <Input
                    id={id}
                    value={form.tags}
                    onChange={(event) => set({ tags: event.target.value })}
                  />
                )}
              </Field>
            </div>
          </SectionCard>

          {!creating && record ? (
            <SectionCard
              title="Quo calls"
              description="Calls to the main line or a saved contact's direct line sync here automatically."
            >
              <CallTimeline recordId={record.id} subject="supplier" />
            </SectionCard>
          ) : null}
        </div>
      </div>

      {!creating && record ? (
        <SectionCard
          title="Activity"
          description="A simple running history of calls, emails, forms, notes, and status changes."
        >
          <div className="mb-5 flex flex-col gap-2 sm:flex-row">
            <Select
              value={logType}
              onChange={(event) =>
                setLogType(event.target.value as InteractionType)
              }
              aria-label="Activity type"
              className="sm:w-36"
            >
              {INTERACTION_TYPES.filter(
                (type) => type.id !== "system" && type.id !== "status",
              ).map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </Select>
            <Input
              value={logBody}
              onChange={(event) => setLogBody(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void logInteraction();
              }}
              placeholder="What happened?"
              aria-label="Activity note"
              className="flex-1"
            />
            <Button
              variant="primary"
              onClick={() => void logInteraction()}
              disabled={logging || !logBody.trim()}
            >
              <Send size={14} aria-hidden />
              {logging ? "Logging…" : "Log activity"}
            </Button>
          </div>

          <ul className="grid gap-3 md:grid-cols-2">
            {record.interactions.map((interaction) => (
              <li
                key={interaction.id}
                className="surface-muted rounded-card px-4 py-3 text-sm"
              >
                <div className="flex items-center gap-2 text-[11px] text-muted">
                  <span className="font-semibold uppercase">
                    {interaction.type}
                  </span>
                  <span>·</span>
                  <span>{interaction.actor}</span>
                  <span className="num ml-auto">
                    {shortDate(interaction.date)}
                  </span>
                  {confirmDeleteLog === interaction.id ? (
                    <span className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void deleteInteraction(interaction.id)}
                        className="press rounded px-1.5 py-0.5 font-medium text-danger"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteLog(null)}
                        className="press rounded px-1.5 py-0.5"
                      >
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteLog(interaction.id)}
                      aria-label={`Delete ${interaction.type} activity`}
                      className="press rounded p-1 hover:text-danger"
                    >
                      <Trash2 size={11} aria-hidden />
                    </button>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-ink">
                  {interaction.body}
                </p>
              </li>
            ))}
            {record.interactions.length === 0 ? (
              <li className="text-xs text-muted">No activity logged yet.</li>
            ) : null}
          </ul>
        </SectionCard>
      ) : null}

      <div className="flex items-center justify-end gap-2 pb-6">
        <Link
          href={backHref}
          className="press inline-flex h-10 items-center justify-center rounded-control border border-hairline bg-[var(--panel)] px-4 text-sm font-medium text-ink shadow-sm"
        >
          Back to {backLabel.toLowerCase()}
        </Link>
        <Button
          variant="primary"
          onClick={() => void save()}
          disabled={saving}
        >
          <Save size={15} aria-hidden />
          {saving
            ? "Saving…"
            : creating
              ? "Create supplier"
              : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
