"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  Calculator,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Loader2,
  MessageCircleWarning,
  PackageSearch,
  Phone,
  PhoneOff,
  RefreshCw,
  Sparkles,
  Truck,
  X,
} from "lucide-react";
import { Button } from "@/components/kit/Button";
import { Input, Select, Textarea } from "@/components/kit/Field";
import { Modal } from "@/components/kit/Modal";
import { useToast } from "@/components/kit/Toast";
import { StageBadge, PriorityBadge } from "@/components/crm/badges";
import { cn, shortDate } from "@/lib/utils";
import {
  CALL_OUTCOMES,
  OBJECTION_PLAYS,
  unverifiedItems,
  type CallNote,
  type CallOutcome,
  type CockpitData,
  type NoteKind,
} from "@/lib/cockpit";

// ---------------- DTOs from the server page ----------------

export interface CockpitRecordDTO {
  id: string;
  recordId: string | null;
  type: string;
  name: string;
  company: string | null;
  status: string;
  priority: "hot" | "warm" | "cold" | null;
  email: string | null;
  phone: string | null;
  productInterest: string | null;
  quoteAmount: number | null;
  contextSummary: string | null;
  nextAction: string | null;
}

export interface CockpitInteractionDTO {
  id: string;
  date: string;
  type: string;
  actor: string;
  body: string;
}

export interface SupplierOptionDTO {
  id: string;
  name: string;
  mainContact: string | null;
  phone: string | null;
}

const NOTE_STYLES: Record<NoteKind, { label: string; cls: string }> = {
  confirmed: { label: "CONFIRMED", cls: "bg-[var(--green-soft)] text-green" },
  note: { label: "NOTE", cls: "bg-[var(--panel-soft)] text-muted" },
  objection: { label: "OBJECTION", cls: "bg-[var(--red-soft)] text-danger" },
  suggestion: { label: "SUGGESTION", cls: "bg-[var(--accent-soft)] text-accent-bright" },
};

function money(v: string): number | null {
  const n = parseFloat(v.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-bold tracking-[0.12em] text-muted uppercase">
      {children}
    </h3>
  );
}

function VerifyPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase",
        ok ? "bg-[var(--green-soft)] text-green" : "bg-[var(--amber-soft)] text-amber",
      )}
    >
      {ok ? <CheckCircle2 size={10} aria-hidden /> : <AlertTriangle size={10} aria-hidden />}
      {label}
    </span>
  );
}

// ================================================================

export function CockpitScreen({
  record,
  interactions,
  suppliers,
  sessionId,
  startedAt,
  initialData,
  initialNotes,
}: {
  record: CockpitRecordDTO;
  interactions: CockpitInteractionDTO[];
  suppliers: SupplierOptionDTO[];
  sessionId: string;
  startedAt: string;
  initialData: CockpitData;
  initialNotes: CallNote[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<CockpitData>(initialData);
  const [notes, setNotes] = useState<CallNote[]>(initialNotes);
  const [elapsed, setElapsed] = useState(() =>
    Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)),
  );
  const [noteText, setNoteText] = useState("");
  const [noteKind, setNoteKind] = useState<NoteKind>("confirmed");
  const [panel, setPanel] = useState<"stock" | "quote" | "freight" | null>(null);
  const [ending, setEnding] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const dirty = useRef(false);
  const followUpRef = useRef<HTMLInputElement>(null);

  // ---- timer ----
  useEffect(() => {
    const t0 = new Date(startedAt).getTime();
    const iv = setInterval(
      () => setElapsed(Math.max(0, Math.floor((Date.now() - t0) / 1000))),
      1000,
    );
    return () => clearInterval(iv);
  }, [startedAt]);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  // ---- autosave (debounced) ----
  const patch = useCallback(
    (fn: (d: CockpitData) => CockpitData) => {
      setData((d) => fn(structuredClone(d)));
      dirty.current = true;
    },
    [],
  );
  useEffect(() => {
    const iv = setInterval(() => {
      if (!dirty.current) return;
      dirty.current = false;
      void fetch(`/api/cockpit/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: JSON.stringify(data),
          notes: JSON.stringify(notes),
        }),
      });
    }, 1500);
    return () => clearInterval(iv);
  }, [data, notes, sessionId]);

  const addNote = useCallback(
    (kind: NoteKind, text: string) => {
      const t = text.trim();
      if (!t) return;
      setNotes((n) => [...n, { at: new Date().toISOString(), kind, text: t }]);
      dirty.current = true;
    },
    [],
  );

  const promoteNote = (i: number) => {
    setNotes((n) => n.map((x, idx) => (idx === i ? { ...x, kind: "confirmed" } : x)));
    dirty.current = true;
  };
  const deleteNote = (i: number) => {
    setNotes((n) => n.filter((_, idx) => idx !== i));
    dirty.current = true;
  };

  // ---- AI recommended questions ----
  const refreshQuestions = useCallback(async () => {
    setLoadingQuestions(true);
    try {
      const res = await fetch("/api/cockpit/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "questions",
          recordId: record.id,
          context: notes.map((n) => `[${n.kind}] ${n.text}`).join("\n").slice(0, 3800),
        }),
      });
      const json = await res.json();
      if (Array.isArray(json.questions)) {
        patch((d) => ({ ...d, questions: json.questions }));
      }
    } catch {
      toast({ title: "Couldn't refresh questions", tone: "error" });
    } finally {
      setLoadingQuestions(false);
    }
  }, [notes, patch, record.id, toast]);

  useEffect(() => {
    if (initialData.questions.length > 0) return;
    const t = setTimeout(() => void refreshQuestions(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- derived quote math ----
  const qPrice = money(data.quote.price);
  const qCost = money(data.quote.cost);
  const qFreight = money(data.quote.freight) ?? 0;
  const profit = qPrice !== null && qCost !== null ? qPrice - qCost - qFreight : null;
  const margin = profit !== null && qPrice ? (profit / qPrice) * 100 : null;

  const warnings = unverifiedItems(data);

  // ---- one-click actions ----
  const requestFreight = async () => {
    patch((d) => ({ ...d, freight: { ...d.freight, status: "requested" } }));
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Freight quote: ${data.product.title || record.productInterest || "unit"} → ${data.location || "customer location"}`,
          detail: `For ${record.name} (${record.recordId ?? record.id}). Product: ${data.product.title} (SKU ${data.product.sku || "?"}). Supplier: ${data.supplier.name || "?"}. Requested live during a call.`,
        }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Freight request queued for the agent", tone: "success" });
    } catch {
      toast({ title: "Couldn't queue freight task", tone: "error" });
    }
  };

  const askSupplierStock = async () => {
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Verify stock: ${data.product.title || "unit"} (SKU ${data.product.sku || "?"})`,
          detail: `Call/email ${data.supplier.name || "the supplier"} (${data.supplier.phone || "no phone on file"}) and confirm current availability for ${record.name}'s deal.`,
        }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Stock check queued for the agent", tone: "success" });
    } catch {
      toast({ title: "Couldn't queue stock task", tone: "error" });
    }
  };

  const queueQuoteApproval = async () => {
    if (qPrice === null) {
      toast({ title: "Set a quote price first", tone: "error" });
      return;
    }
    try {
      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "price_quote",
          title: `Quote $${qPrice.toLocaleString()} → ${record.name}`,
          recordId: record.id,
          draftSubject: `Your quote — ${data.product.title || "equipment"}`,
          draftBody: [
            `Product: ${data.product.title || "-"} (SKU ${data.product.sku || "-"})`,
            `Quote price: $${qPrice.toLocaleString()}`,
            `Our cost: ${qCost !== null ? `$${qCost.toLocaleString()}` : "unset"} · Freight: $${qFreight.toLocaleString()}`,
            profit !== null ? `Profit: $${profit.toLocaleString()} (${margin?.toFixed(1)}% margin)` : "",
            `Ship to: ${data.location || "-"}`,
            `Lead time: ${data.terms.leadTime || "-"} · Warranty: ${data.terms.warranty || "-"}`,
          ]
            .filter(Boolean)
            .join("\n"),
          reasoning: `Built live in the sales cockpit during a call with ${record.name}. HARD STOP: prices always need your sign-off before they leave the building.`,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: "Quote queued in Approvals — nothing sent yet", tone: "success" });
    } catch (e) {
      toast({
        title: "Couldn't queue quote",
        description: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
    }
  };

  const createFollowUp = () => {
    if (!data.followUpDate) {
      const d = new Date();
      d.setDate(d.getDate() + 2);
      patch((x) => ({ ...x, followUpDate: d.toISOString().slice(0, 10) }));
    }
    followUpRef.current?.focus();
    followUpRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  // ================================================================

  return (
    <div className="cockpit-bg fixed inset-0 z-50 overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-[1500px] flex-col gap-3 p-3 md:p-4">
        {/* ---------- top bar: identity · timer · exit ---------- */}
        <header className="surface flex flex-wrap items-center gap-x-4 gap-y-2 rounded-panel px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-display truncate text-xl text-ink">{record.name}</h1>
              {record.recordId ? (
                <span className="num text-xs text-muted">{record.recordId}</span>
              ) : null}
              <StageBadge stage={record.status} />
              <PriorityBadge priority={record.priority} />
            </div>
            <p className="mt-0.5 truncate text-xs text-muted">
              {record.company ? `${record.company} · ` : ""}
              {record.phone ?? "no phone"} · {record.email ?? "no email"}
              {" · "}
              <span className={cn(!data.location && "text-amber")}>
                {data.location || "location unknown"}
              </span>
            </p>
          </div>
          <span className="flex-1" />
          <div className="flex items-center gap-2 rounded-card border border-hairline bg-[var(--panel-soft)] px-3 py-1.5">
            <Phone size={14} className="text-green" aria-hidden />
            <span className="num text-lg font-semibold text-ink tabular-nums">
              {mm}:{ss}
            </span>
          </div>
          <Button variant="danger" size="sm" onClick={() => setEnding(true)}>
            <PhoneOff size={13} aria-hidden />
            End call
          </Button>
          <Link
            href="/crm"
            className="press rounded-control border border-hairline p-2 text-muted hover:text-ink"
            aria-label="Exit cockpit"
          >
            <X size={14} aria-hidden />
          </Link>
        </header>

        {/* ---------- action strip ---------- */}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={panel === "stock" ? "primary" : "ghost"} size="sm" onClick={() => setPanel(panel === "stock" ? null : "stock")}>
            <PackageSearch size={13} aria-hidden /> Check stock
          </Button>
          <Button variant={panel === "quote" ? "primary" : "ghost"} size="sm" onClick={() => setPanel(panel === "quote" ? null : "quote")}>
            <Calculator size={13} aria-hidden /> Build quote
          </Button>
          <Button variant={panel === "freight" ? "primary" : "ghost"} size="sm" onClick={() => setPanel(panel === "freight" ? null : "freight")}>
            <Truck size={13} aria-hidden /> Freight
          </Button>
          <Button variant="ghost" size="sm" onClick={createFollowUp}>
            <CalendarClock size={13} aria-hidden /> Create follow-up
          </Button>
          <span className="flex-1" />
          <span className="num text-xs text-muted">
            Deal value:{" "}
            <strong className="text-ink">
              {qPrice !== null
                ? `$${qPrice.toLocaleString()}`
                : record.quoteAmount
                  ? `$${record.quoteAmount.toLocaleString()}`
                  : "—"}
            </strong>
          </span>
        </div>

        {/* ---------- THE warning banner ---------- */}
        {warnings.length > 0 ? (
          <div
            role="alert"
            className="flex items-center gap-3 rounded-card border border-[var(--amber)] bg-[var(--amber-soft)] px-4 py-2.5"
          >
            <AlertTriangle size={18} className="shrink-0 text-amber" aria-hidden />
            <p className="text-sm font-semibold text-ink">
              UNVERIFIED — do not promise:{" "}
              <span className="font-bold text-amber">{warnings.join(" · ")}</span>
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-card border border-[var(--green)] bg-[var(--green-soft)] px-4 py-2">
            <CheckCircle2 size={16} className="shrink-0 text-green" aria-hidden />
            <p className="text-sm font-semibold text-green">
              Everything on screen is verified — safe to commit.
            </p>
          </div>
        )}

        {/* ---------- 3-column cockpit ---------- */}
        <div className="grid flex-1 grid-cols-1 gap-3 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
          {/* ======== LEFT: who + history ======== */}
          <div className="flex flex-col gap-3">
            <section className="surface rounded-panel p-3.5">
              <SectionTitle>Customer</SectionTitle>
              <div className="mt-2 flex flex-col gap-2 text-sm">
                <Input
                  value={data.location}
                  onChange={(e) => patch((d) => ({ ...d, location: e.target.value }))}
                  placeholder="Location (city, state) — ask early, drives freight"
                  aria-label="Customer location"
                />
                <div className="text-xs text-muted">
                  <p className="mb-1 font-semibold text-ink">Context</p>
                  <p className="whitespace-pre-wrap">
                    {record.contextSummary ?? "No summary yet — this call writes one."}
                  </p>
                </div>
                {record.nextAction ? (
                  <p className="rounded-md bg-[var(--accent-soft)] px-2 py-1 text-xs text-accent-bright">
                    Next on file: {record.nextAction}
                  </p>
                ) : null}
              </div>
            </section>

            <section className="surface rounded-panel p-3.5">
              <SectionTitle>Supplier line</SectionTitle>
              <div className="mt-2 flex flex-col gap-2">
                <Select
                  value={data.supplier.id}
                  aria-label="Supplier"
                  onChange={(e) => {
                    const s = suppliers.find((x) => x.id === e.target.value);
                    patch((d) => ({
                      ...d,
                      supplier: s
                        ? { id: s.id, name: s.name, contact: s.mainContact ?? "", phone: s.phone ?? "" }
                        : { id: "", name: "", contact: "", phone: "" },
                    }));
                  }}
                >
                  <option value="">— pick supplier —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
                {data.supplier.id ? (
                  <div className="rounded-card border border-hairline bg-[var(--panel-soft)] px-3 py-2 text-sm">
                    <p className="font-semibold text-ink">{data.supplier.name}</p>
                    <p className="text-xs text-muted">
                      {data.supplier.contact || "no named contact"}
                    </p>
                    <p className="num mt-1 text-base font-semibold text-accent-bright">
                      {data.supplier.phone || "no phone on file"}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-amber">
                    No supplier attached — attach one so you can dial them mid-call.
                  </p>
                )}
              </div>
            </section>

            <section className="surface flex min-h-0 flex-1 flex-col rounded-panel p-3.5">
              <SectionTitle>Previous calls & emails</SectionTitle>
              <div className="mt-2 flex max-h-[340px] flex-col gap-2 overflow-y-auto pr-1">
                {interactions.length === 0 ? (
                  <p className="text-xs text-muted">First contact — clean slate.</p>
                ) : (
                  interactions.map((i) => (
                    <div key={i.id} className="rounded-card border border-hairline bg-[var(--panel-soft)] px-2.5 py-2">
                      <p className="mb-0.5 flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-muted uppercase">
                        {i.type} · {i.actor} · {shortDate(i.date)}
                      </p>
                      <p className="line-clamp-4 text-xs whitespace-pre-wrap text-ink">{i.body}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* ======== CENTER: the deal ======== */}
          <div className="flex flex-col gap-3">
            {/* product */}
            <section className="surface rounded-panel p-4">
              <div className="flex items-center justify-between">
                <SectionTitle>Product on the table</SectionTitle>
                <VerifyPill
                  ok={data.product.specs.length > 0 && data.product.specs.every((s) => s.verified)}
                  label={
                    data.product.specs.length && data.product.specs.every((s) => s.verified)
                      ? "specs verified"
                      : "specs unverified"
                  }
                />
              </div>
              <div className="mt-3 flex gap-4">
                <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-card border border-hairline bg-[var(--panel-soft)]">
                  {data.product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={data.product.imageUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <PackageSearch size={26} className="text-muted" aria-hidden />
                  )}
                </div>
                <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                  <Input
                    className="sm:col-span-2"
                    value={data.product.title}
                    onChange={(e) => patch((d) => ({ ...d, product: { ...d.product, title: e.target.value } }))}
                    placeholder="Product title"
                    aria-label="Product title"
                  />
                  <Input
                    value={data.product.sku}
                    onChange={(e) => patch((d) => ({ ...d, product: { ...d.product, sku: e.target.value } }))}
                    placeholder="SKU"
                    aria-label="SKU"
                  />
                  <Input
                    value={data.product.price}
                    onChange={(e) => patch((d) => ({ ...d, product: { ...d.product, price: e.target.value } }))}
                    placeholder="List price ($)"
                    aria-label="List price"
                  />
                  <Input
                    className="sm:col-span-2"
                    value={data.product.imageUrl}
                    onChange={(e) => patch((d) => ({ ...d, product: { ...d.product, imageUrl: e.target.value } }))}
                    placeholder="Image URL (paste from store / supplier page)"
                    aria-label="Image URL"
                  />
                </div>
              </div>

              {/* specs */}
              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-ink">Specifications</p>
                  <Button
                    variant="subtle"
                    size="sm"
                    onClick={() =>
                      patch((d) => ({
                        ...d,
                        product: {
                          ...d.product,
                          specs: [...d.product.specs, { label: "", value: "", verified: false }],
                        },
                      }))
                    }
                  >
                    + Add spec
                  </Button>
                </div>
                {data.product.specs.length === 0 ? (
                  <p className="mt-1 text-xs text-amber">
                    No specs captured — anything you say about this unit is unverified.
                  </p>
                ) : (
                  <div className="mt-1.5 flex flex-col gap-1.5">
                    {data.product.specs.map((s, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <Input
                          className="w-40"
                          value={s.label}
                          onChange={(e) =>
                            patch((d) => {
                              d.product.specs[i].label = e.target.value;
                              return d;
                            })
                          }
                          placeholder="Spec (e.g. HP range)"
                          aria-label={`Spec ${i + 1} label`}
                        />
                        <Input
                          value={s.value}
                          onChange={(e) =>
                            patch((d) => {
                              d.product.specs[i].value = e.target.value;
                              return d;
                            })
                          }
                          placeholder="Value"
                          aria-label={`Spec ${i + 1} value`}
                        />
                        <button
                          className={cn(
                            "press shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase",
                            s.verified
                              ? "bg-[var(--green-soft)] text-green"
                              : "bg-[var(--amber-soft)] text-amber",
                          )}
                          title="Toggle verified — only mark verified if it comes from the official spec sheet"
                          onClick={() =>
                            patch((d) => {
                              d.product.specs[i].verified = !d.product.specs[i].verified;
                              return d;
                            })
                          }
                        >
                          {s.verified ? "verified" : "unverified"}
                        </button>
                        <button
                          className="shrink-0 p-1 text-muted hover:text-danger"
                          aria-label="Remove spec"
                          onClick={() =>
                            patch((d) => {
                              d.product.specs.splice(i, 1);
                              return d;
                            })
                          }
                        >
                          <X size={12} aria-hidden />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* verification grid */}
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* FitCheck */}
              <div className="surface rounded-panel p-3.5">
                <div className="flex items-center justify-between">
                  <SectionTitle>FitCheck</SectionTitle>
                  <VerifyPill
                    ok={data.fitCheck.status === "fits"}
                    label={
                      data.fitCheck.status === "fits"
                        ? "fits"
                        : data.fitCheck.status === "no_fit"
                          ? "does not fit"
                          : "not checked"
                    }
                  />
                </div>
                <div className="mt-2 flex gap-1.5">
                  {(
                    [
                      ["fits", "Fits"],
                      ["needs_check", "Needs check"],
                      ["no_fit", "No fit"],
                    ] as const
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      className={cn(
                        "press flex-1 rounded-control border px-2 py-1.5 text-xs font-medium",
                        data.fitCheck.status === v
                          ? v === "no_fit"
                            ? "border-transparent bg-[var(--red-soft)] text-danger"
                            : v === "fits"
                              ? "border-transparent bg-[var(--green-soft)] text-green"
                              : "border-transparent bg-[var(--amber-soft)] text-amber"
                          : "border-hairline text-muted hover:text-ink",
                      )}
                      onClick={() => patch((d) => ({ ...d, fitCheck: { ...d.fitCheck, status: v } }))}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <Input
                  className="mt-2"
                  value={data.fitCheck.note}
                  onChange={(e) => patch((d) => ({ ...d, fitCheck: { ...d.fitCheck, note: e.target.value } }))}
                  placeholder="Tractor model, HP, hitch cat…"
                  aria-label="FitCheck note"
                />
              </div>

              {/* Terms */}
              <div className="surface rounded-panel p-3.5">
                <div className="flex items-center justify-between">
                  <SectionTitle>Warranty & lead time</SectionTitle>
                  <VerifyPill ok={data.terms.verified} label={data.terms.verified ? "verified" : "unverified"} />
                </div>
                <div className="mt-2 flex flex-col gap-1.5">
                  <Input
                    value={data.terms.warranty}
                    onChange={(e) => patch((d) => ({ ...d, terms: { ...d.terms, warranty: e.target.value } }))}
                    placeholder="Warranty (e.g. 2yr limited)"
                    aria-label="Warranty"
                  />
                  <Input
                    value={data.terms.leadTime}
                    onChange={(e) => patch((d) => ({ ...d, terms: { ...d.terms, leadTime: e.target.value } }))}
                    placeholder="Lead time (e.g. ships in 5-7 days)"
                    aria-label="Lead time"
                  />
                  <label className="flex items-center gap-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={data.terms.verified}
                      onChange={(e) => patch((d) => ({ ...d, terms: { ...d.terms, verified: e.target.checked } }))}
                    />
                    Confirmed with supplier / official docs
                  </label>
                </div>
              </div>

              {/* Stock */}
              <div className={cn("surface rounded-panel p-3.5", panel === "stock" && "ring-2 ring-[var(--ring)]")}>
                <div className="flex items-center justify-between">
                  <SectionTitle>Stock</SectionTitle>
                  <VerifyPill
                    ok={data.stock.status === "in_stock" || data.stock.status === "low"}
                    label={
                      data.stock.status === "unverified"
                        ? "unverified"
                        : data.stock.status === "out"
                          ? "out of stock"
                          : data.stock.status === "low"
                            ? "low stock"
                            : "in stock"
                    }
                  />
                </div>
                <div className="mt-2 flex gap-1.5">
                  {(
                    [
                      ["in_stock", "In stock"],
                      ["low", "Low"],
                      ["out", "Out"],
                    ] as const
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      className={cn(
                        "press flex-1 rounded-control border px-2 py-1.5 text-xs font-medium",
                        data.stock.status === v
                          ? v === "out"
                            ? "border-transparent bg-[var(--red-soft)] text-danger"
                            : "border-transparent bg-[var(--green-soft)] text-green"
                          : "border-hairline text-muted hover:text-ink",
                      )}
                      onClick={() =>
                        patch((d) => ({
                          ...d,
                          stock: { ...d.stock, status: v, checkedAt: new Date().toISOString() },
                        }))
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <Input
                  className="mt-2"
                  value={data.stock.detail}
                  onChange={(e) => patch((d) => ({ ...d, stock: { ...d.stock, detail: e.target.value } }))}
                  placeholder="Qty + source (e.g. 6 units, supplier phone)"
                  aria-label="Stock detail"
                />
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-[10px] text-muted">
                    {data.stock.checkedAt ? `Checked ${shortDate(data.stock.checkedAt)}` : "Never checked"}
                  </p>
                  <Button variant="subtle" size="sm" onClick={askSupplierStock}>
                    Ask supplier (task)
                  </Button>
                </div>
              </div>

              {/* Freight */}
              <div className={cn("surface rounded-panel p-3.5", panel === "freight" && "ring-2 ring-[var(--ring)]")}>
                <div className="flex items-center justify-between">
                  <SectionTitle>Freight</SectionTitle>
                  <VerifyPill
                    ok={data.freight.status === "quoted"}
                    label={
                      data.freight.status === "quoted"
                        ? "quoted"
                        : data.freight.status === "requested"
                          ? "requested"
                          : "unknown"
                    }
                  />
                </div>
                <div className="mt-2 flex flex-col gap-1.5">
                  <Input
                    value={data.freight.cost}
                    onChange={(e) =>
                      patch((d) => ({
                        ...d,
                        freight: { ...d.freight, cost: e.target.value, status: e.target.value ? "quoted" : d.freight.status },
                      }))
                    }
                    placeholder="Freight cost ($) once quoted"
                    aria-label="Freight cost"
                  />
                  <Input
                    value={data.freight.note}
                    onChange={(e) => patch((d) => ({ ...d, freight: { ...d.freight, note: e.target.value } }))}
                    placeholder="Carrier / notes"
                    aria-label="Freight note"
                  />
                  <Button variant="ghost" size="sm" onClick={requestFreight}>
                    <Truck size={12} aria-hidden />
                    Request freight quote (task)
                  </Button>
                </div>
              </div>
            </section>

            {/* quote builder */}
            <section className={cn("surface rounded-panel p-4", panel === "quote" && "ring-2 ring-[var(--ring)]")}>
              <div className="flex items-center justify-between">
                <SectionTitle>Quote math</SectionTitle>
                {data.stock.status === "unverified" && qPrice !== null ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-danger">
                    <AlertTriangle size={12} aria-hidden /> Quoting with UNVERIFIED stock
                  </span>
                ) : null}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <label className="flex flex-col gap-1 text-[10px] font-bold tracking-wide text-muted uppercase">
                  Quote price
                  <Input
                    value={data.quote.price}
                    onChange={(e) => patch((d) => ({ ...d, quote: { ...d.quote, price: e.target.value } }))}
                    placeholder="$"
                    aria-label="Quote price"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold tracking-wide text-muted uppercase">
                  Our cost
                  <Input
                    value={data.quote.cost}
                    onChange={(e) => patch((d) => ({ ...d, quote: { ...d.quote, cost: e.target.value } }))}
                    placeholder="$"
                    aria-label="Our cost"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[10px] font-bold tracking-wide text-muted uppercase">
                  Freight cost
                  <Input
                    value={data.quote.freight}
                    onChange={(e) => patch((d) => ({ ...d, quote: { ...d.quote, freight: e.target.value } }))}
                    placeholder="$"
                    aria-label="Freight cost for quote"
                  />
                </label>
                <div className="flex flex-col justify-center rounded-card border border-hairline bg-[var(--panel-soft)] px-3 py-1.5">
                  <p className="num text-lg font-bold text-ink">
                    {profit !== null ? `$${profit.toLocaleString()}` : "—"}
                    <span
                      className={cn(
                        "ml-2 text-sm font-semibold",
                        margin !== null && margin < 15 ? "text-danger" : "text-green",
                      )}
                    >
                      {margin !== null ? `${margin.toFixed(1)}%` : ""}
                    </span>
                  </p>
                  <p className="text-[10px] font-bold tracking-wide text-muted uppercase">Profit · margin</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button variant="primary" size="sm" onClick={queueQuoteApproval}>
                  <ChevronRight size={13} aria-hidden />
                  Queue quote for approval
                </Button>
                <p className="text-[11px] text-muted">
                  Prices never leave the building without sign-off — this lands in Approvals.
                </p>
              </div>
            </section>
          </div>

          {/* ======== RIGHT: live assist ======== */}
          <div className="flex flex-col gap-3">
            {/* questions */}
            <section className="surface rounded-panel p-3.5">
              <div className="flex items-center justify-between">
                <SectionTitle>Ask next</SectionTitle>
                <Button variant="subtle" size="sm" disabled={loadingQuestions} onClick={refreshQuestions}>
                  {loadingQuestions ? (
                    <Loader2 size={12} className="animate-spin" aria-hidden />
                  ) : (
                    <RefreshCw size={12} aria-hidden />
                  )}
                </Button>
              </div>
              <ul className="mt-2 flex flex-col gap-1.5">
                {(data.questions.length ? data.questions : ["…"]).map((q, i) => (
                  <li key={i}>
                    <button
                      className="press w-full rounded-card border border-hairline bg-[var(--panel-soft)] px-2.5 py-1.5 text-left text-xs text-ink hover:border-[var(--hairline-strong)]"
                      title="Click when asked — logs it as a note"
                      onClick={() => addNote("note", `Asked: ${q}`)}
                    >
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            {/* objections */}
            <section className="surface rounded-panel p-3.5">
              <div className="flex items-center justify-between">
                <SectionTitle>Objection plays</SectionTitle>
                {data.objection ? (
                  <span className="flex items-center gap-1 rounded-full bg-[var(--red-soft)] px-2 py-0.5 text-[10px] font-bold text-danger uppercase">
                    <MessageCircleWarning size={10} aria-hidden />
                    {data.objection}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {OBJECTION_PLAYS.map((p) => (
                  <button
                    key={p.id}
                    className={cn(
                      "press rounded-full border px-2.5 py-1 text-[11px] font-medium",
                      data.objection === p.objection
                        ? "border-transparent bg-[var(--red-soft)] text-danger"
                        : "border-hairline text-muted hover:text-ink",
                    )}
                    onClick={() => {
                      patch((d) => ({ ...d, objection: p.objection }));
                      addNote("objection", p.objection);
                      addNote("suggestion", `Play: ${p.response}`);
                    }}
                  >
                    {p.objection}
                  </button>
                ))}
              </div>
            </section>

            {/* follow-up */}
            <section className="surface rounded-panel p-3.5">
              <SectionTitle>Follow-up</SectionTitle>
              <input
                ref={followUpRef}
                type="date"
                value={data.followUpDate}
                onChange={(e) => patch((d) => ({ ...d, followUpDate: e.target.value }))}
                className="mt-2 w-full rounded-control border border-hairline bg-[var(--panel)] px-3 py-2 text-sm text-ink"
                aria-label="Follow-up date"
              />
              <p className="mt-1 text-[10px] text-muted">
                Applied to the record when the call ends.
              </p>
            </section>

            {/* notes */}
            <section className="surface flex min-h-[260px] flex-1 flex-col rounded-panel p-3.5">
              <SectionTitle>Call notes</SectionTitle>
              <div className="mt-2 flex flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
                {notes.length === 0 ? (
                  <p className="text-xs text-muted">
                    Capture as you talk. Confirmed facts drive the summary; suggestions
                    stay clearly marked until you promote them.
                  </p>
                ) : (
                  notes.map((n, i) => (
                    <div key={i} className="group flex items-start gap-1.5 rounded-card border border-hairline bg-[var(--panel-soft)] px-2 py-1.5">
                      <span className={cn("mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold", NOTE_STYLES[n.kind].cls)}>
                        {NOTE_STYLES[n.kind].label}
                      </span>
                      <p className="min-w-0 flex-1 text-xs text-ink">{n.text}</p>
                      <div className="hidden shrink-0 gap-1 group-hover:flex">
                        {n.kind !== "confirmed" ? (
                          <button
                            className="rounded p-0.5 text-muted hover:text-green"
                            title="Promote to confirmed fact"
                            onClick={() => promoteNote(i)}
                          >
                            <CheckCircle2 size={12} aria-hidden />
                          </button>
                        ) : null}
                        <button
                          className="rounded p-0.5 text-muted hover:text-danger"
                          aria-label="Delete note"
                          onClick={() => deleteNote(i)}
                        >
                          <X size={12} aria-hidden />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-2 flex flex-col gap-1.5 border-t border-hairline pt-2">
                <div className="flex gap-1">
                  {(["confirmed", "note", "objection"] as const).map((k) => (
                    <button
                      key={k}
                      className={cn(
                        "press rounded-full px-2.5 py-1 text-[10px] font-bold uppercase",
                        noteKind === k ? NOTE_STYLES[k].cls : "text-muted hover:text-ink",
                      )}
                      onClick={() => setNoteKind(k)}
                    >
                      {NOTE_STYLES[k].label}
                    </button>
                  ))}
                </div>
                <Input
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      addNote(noteKind, noteText);
                      setNoteText("");
                    }
                  }}
                  placeholder="Type + Enter…"
                  aria-label="New note"
                />
              </div>
            </section>
          </div>
        </div>
      </div>

      <EndCallDialog
        key={String(ending)}
        open={ending}
        onClose={() => setEnding(false)}
        record={record}
        sessionId={sessionId}
        elapsed={elapsed}
        data={data}
        notes={notes}
        onDone={() => {
          toast({ title: "Call logged — record updated", tone: "success" });
          router.push("/crm");
        }}
      />
    </div>
  );
}

// ================================================================
// End-call flow: outcome → AI draft (editable) → save everything.

function EndCallDialog({
  open,
  onClose,
  record,
  sessionId,
  elapsed,
  data,
  notes,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  record: CockpitRecordDTO;
  sessionId: string;
  elapsed: number;
  data: CockpitData;
  notes: CallNote[];
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [summary, setSummary] = useState("");
  const [nextAction, setNextAction] = useState("");
  // The dialog remounts on open (keyed by the parent), so state
  // initializers pick up the latest call data — no sync effect needed.
  const [followUpDate, setFollowUpDate] = useState(data.followUpDate);
  const [drafting, setDrafting] = useState(false);
  const [aiDrafted, setAiDrafted] = useState(false);
  const [saving, setSaving] = useState(false);

  const confirmed = notes.filter((n) => n.kind === "confirmed").map((n) => n.text);
  const others = notes.filter((n) => n.kind !== "confirmed" && n.kind !== "suggestion").map((n) => n.text);
  const qPrice = money(data.quote.price);

  const draft = useCallback(
    async (chosen: CallOutcome) => {
      setDrafting(true);
      try {
        const res = await fetch("/api/cockpit/assist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "summary",
            recordId: record.id,
            outcome: chosen,
            confirmedNotes: confirmed,
            otherNotes: others,
            objection: data.objection || undefined,
            quote: qPrice !== null ? `$${qPrice.toLocaleString()}` : undefined,
          }),
        });
        const json = await res.json();
        setSummary(json.contextSummary ?? "");
        setNextAction(json.nextAction ?? "");
        setAiDrafted(json.source === "ai");
      } catch {
        setSummary(confirmed.join(". "));
        setAiDrafted(false);
      } finally {
        setDrafting(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [record.id, data.objection, notes, qPrice],
  );

  const save = async () => {
    if (!outcome || !summary.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/cockpit/${sessionId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome,
          durationSec: elapsed,
          contextSummary: summary.trim(),
          nextAction: nextAction.trim() || undefined,
          followUpDate: followUpDate || undefined,
          quoteAmount: qPrice ?? undefined,
          data: JSON.stringify(data),
          notes: JSON.stringify(notes),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "failed");
      onDone();
    } catch (e) {
      toast({
        title: "Couldn't end call",
        description: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="End call" widthClass="max-w-lg">
      <div className="flex flex-col gap-4 p-4">
        <div>
          <p className="mb-2 text-xs font-semibold text-muted">Outcome</p>
          <div className="grid grid-cols-3 gap-1.5">
            {CALL_OUTCOMES.map((o) => (
              <button
                key={o.id}
                className={cn(
                  "press rounded-control border px-2 py-2 text-xs font-semibold",
                  outcome === o.id
                    ? o.tone === "green"
                      ? "border-transparent bg-[var(--green-soft)] text-green"
                      : o.tone === "red"
                        ? "border-transparent bg-[var(--red-soft)] text-danger"
                        : o.tone === "amber"
                          ? "border-transparent bg-[var(--amber-soft)] text-amber"
                          : "border-transparent bg-[var(--accent-soft)] text-accent-bright"
                    : "border-hairline text-muted hover:text-ink",
                )}
                onClick={() => {
                  setOutcome(o.id);
                  void draft(o.id);
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {outcome ? (
          <>
            <div>
              <p className="mb-1 flex items-center gap-2 text-xs font-semibold text-muted">
                Context summary → saved to the record
                {drafting ? (
                  <Loader2 size={11} className="animate-spin" aria-hidden />
                ) : aiDrafted ? (
                  <span className="flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[9px] font-bold text-accent-bright uppercase">
                    <Sparkles size={9} aria-hidden /> AI draft from confirmed notes — edit freely
                  </span>
                ) : (
                  <span className="rounded-full bg-[var(--panel-soft)] px-2 py-0.5 text-[9px] font-bold text-muted uppercase">
                    manual
                  </span>
                )}
              </p>
              <Textarea
                rows={4}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="What's true about this deal after the call?"
                aria-label="Context summary"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
                Next action
                <Input
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  placeholder="e.g. Send quote after approval"
                  aria-label="Next action"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
                Follow-up date
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="rounded-control border border-hairline bg-[var(--panel)] px-3 py-2 text-sm text-ink"
                  aria-label="Follow-up date"
                />
              </label>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-hairline pt-3">
              <p className="text-[11px] text-muted">
                Logs the call · updates stage, summary & next action
              </p>
              <Button variant="primary" disabled={saving || drafting || !summary.trim()} onClick={save}>
                {saving ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
                Save & end call
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
