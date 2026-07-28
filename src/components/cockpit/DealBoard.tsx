"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Loader2, Package, X } from "lucide-react";
import {
  type CockpitData,
  type CheckState,
  type QuoteState,
  type ShippingState,
  type PaymentMethod,
  dealProfit,
  dealMargin,
} from "@/lib/cockpit";
import { DialButton } from "@/components/crm/DialButton";
import { cn } from "@/lib/utils";

/**
 * The seven things that decide a call, on one screen.
 *
 * This is the operator's own list, in his order: what it is, what we
 * make on it, can it physically be delivered, is paperwork owed, when
 * does the money land, who supplies it, and what did we say last time.
 * Everything else the cockpit knows is detail and lives below.
 *
 * The rule this panel exists to enforce: unknown is shown as unknown.
 * A missing cost produces no profit figure, and an unanswered check
 * stays amber. Guessing here loses real money.
 */

interface ProductHit {
  id: string;
  title: string;
  vendor: string | null;
  sku: string | null;
  imageUrl: string | null;
  price: number | null;
  cost: number | null;
  inventoryQuantity: number | null;
}

interface Props {
  data: CockpitData;
  patch: (fn: (d: CockpitData) => CockpitData) => void;
  customerPhone: string | null;
  /** One line from the previous call, when there was one. */
  lastCallNote?: string | null;
  lastCallAt?: string | null;
}

const money = (n: number | null) =>
  n === null ? "—" : `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export function DealBoard({
  data,
  patch,
  customerPhone,
  lastCallNote,
  lastCallAt,
}: Props) {
  const profit = dealProfit(data.deal);
  const margin = dealMargin(data.deal);

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* ---------------- left: the deal ---------------- */}
      <div className="flex flex-col gap-3">
        <ProductPicker data={data} patch={patch} />

        <div className="grid grid-cols-3 gap-2">
          <MoneyTile
            label="Price"
            value={data.deal.price}
            onChange={(v) =>
              patch((d) => ({ ...d, deal: { ...d.deal, price: v } }))
            }
          />
          <MoneyTile
            label="Our cost"
            value={data.deal.cost}
            onChange={(v) =>
              patch((d) => ({ ...d, deal: { ...d.deal, cost: v } }))
            }
          />
          {/* Profit is derived, never typed — and blank when we cannot
              honestly work it out. */}
          <div
            className={cn(
              "rounded-lg px-3 py-2",
              profit === null
                ? "surface-muted"
                : profit > 0
                  ? "bg-[color-mix(in_srgb,var(--green)_14%,transparent)]"
                  : "bg-[color-mix(in_srgb,var(--red)_14%,transparent)]",
            )}
          >
            <p className="text-[11px] text-muted">Profit</p>
            <p
              className={cn(
                "num mt-0.5 text-lg font-semibold",
                profit === null
                  ? "text-muted"
                  : profit > 0
                    ? "text-[var(--green)]"
                    : "text-[var(--red)]",
              )}
            >
              {profit === null ? "—" : money(profit)}
            </p>
            <p className="text-[11px] text-muted">
              {profit === null
                ? "needs cost"
                : margin !== null
                  ? `${margin.toFixed(0)}% margin`
                  : ""}
            </p>
          </div>
        </div>

        <MoneyRow
          label="Freight to us"
          value={data.deal.freight}
          onChange={(v) =>
            patch((d) => ({ ...d, deal: { ...d.deal, freight: v } }))
          }
        />

        {/* ---------------- the four checks ---------------- */}
        <div className="flex flex-col gap-1.5">
          <p className="text-xs tracking-wide text-muted uppercase">Checks</p>

          <CheckRow
            label="Forklift at delivery?"
            value={data.checks.forklift}
            options={[
              { id: "yes", label: "Yes" },
              { id: "no", label: "No" },
            ]}
            onChange={(v) =>
              patch((d) => ({
                ...d,
                checks: { ...d.checks, forklift: v as CheckState },
              }))
            }
          />
          <CheckRow
            label="Custom shipping quote?"
            value={data.checks.customShipping}
            options={[
              { id: "needed", label: "Needed" },
              { id: "quoted", label: "Quoted" },
              { id: "not_needed", label: "Not needed" },
            ]}
            onChange={(v) =>
              patch((d) => ({
                ...d,
                checks: { ...d.checks, customShipping: v as ShippingState },
              }))
            }
          />
          <CheckRow
            label="Formal quote?"
            value={data.checks.formalQuote}
            options={[
              { id: "needed", label: "Needed" },
              { id: "sent", label: "Sent" },
              { id: "not_needed", label: "Not needed" },
            ]}
            onChange={(v) =>
              patch((d) => ({
                ...d,
                checks: { ...d.checks, formalQuote: v as QuoteState },
              }))
            }
          />
          <CheckRow
            label="Paying by"
            value={data.checks.payment}
            options={[
              { id: "card", label: "Card" },
              { id: "bank", label: "Bank" },
              { id: "financing", label: "Financing" },
              { id: "other", label: "Other" },
            ]}
            onChange={(v) =>
              patch((d) => ({
                ...d,
                checks: { ...d.checks, payment: v as PaymentMethod },
              }))
            }
          />
          <input
            value={data.checks.paymentWhen}
            onChange={(e) =>
              patch((d) => ({
                ...d,
                checks: { ...d.checks, paymentWhen: e.target.value },
              }))
            }
            placeholder="When? e.g. deposit now, balance on delivery"
            className="rounded-lg border border-hairline bg-[var(--panel)] px-3 py-2 text-sm text-ink"
          />
        </div>
      </div>

      {/* ---------------- right: supplier + history ---------------- */}
      <div className="flex flex-col gap-3">
        <div>
          <p className="mb-1.5 text-xs tracking-wide text-muted uppercase">
            Supplier
          </p>
          <div className="surface rounded-lg border border-hairline p-3">
            <input
              value={data.supplier.name}
              onChange={(e) =>
                patch((d) => ({
                  ...d,
                  supplier: { ...d.supplier, name: e.target.value },
                }))
              }
              placeholder="Which supplier?"
              className="w-full bg-transparent text-sm font-medium text-ink outline-none"
            />
            <div className="mt-2 flex items-center gap-2">
              <input
                value={data.supplier.phone}
                onChange={(e) =>
                  patch((d) => ({
                    ...d,
                    supplier: { ...d.supplier, phone: e.target.value },
                  }))
                }
                placeholder="Supplier phone"
                className="min-w-0 flex-1 rounded border border-hairline bg-[var(--panel)] px-2 py-1 text-sm text-ink"
              />
              {/* Ring the supplier mid-call — the reason their number is
                  on this screen at all. */}
              <DialButton phone={data.supplier.phone} />
            </div>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs tracking-wide text-muted uppercase">
            Last call{lastCallAt ? ` · ${lastCallAt}` : ""}
          </p>
          <div className="surface rounded-lg border border-hairline p-3 text-sm">
            {lastCallNote ? (
              <p className="whitespace-pre-line text-ink">{lastCallNote}</p>
            ) : (
              <p className="text-muted">
                No previous call written up for this lead.
              </p>
            )}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs tracking-wide text-muted uppercase">
            Customer
          </p>
          <div className="surface flex items-center gap-2 rounded-lg border border-hairline p-3">
            <span className="num min-w-0 flex-1 truncate text-sm text-ink">
              {customerPhone || "No number on this lead"}
            </span>
            <DialButton phone={customerPhone} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Search the store, or type it in when Shopify isn't connected. */
function ProductPicker({
  data,
  patch,
}: {
  data: CockpitData;
  patch: Props["patch"];
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ProductHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [costAvailable, setCostAvailable] = useState(true);
  const debounce = useRef<number | null>(null);

  const search = useCallback(async (term: string) => {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/shopify/products?q=${encodeURIComponent(term)}`,
      );
      const json = (await res.json()) as {
        connected: boolean;
        costAvailable: boolean;
        products: ProductHit[];
      };
      setConnected(json.connected);
      setCostAvailable(json.costAvailable);
      setHits(json.products ?? []);
    } catch {
      setHits([]);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (debounce.current) window.clearTimeout(debounce.current);
    if (!query.trim()) {
      // Clearing on the same debounce tick keeps this out of the
      // synchronous effect body, and stops a stale in-flight search
      // repopulating the list after the box is emptied.
      debounce.current = window.setTimeout(() => setHits(null), 0);
      return;
    }
    debounce.current = window.setTimeout(() => void search(query), 300);
    return () => {
      if (debounce.current) window.clearTimeout(debounce.current);
    };
  }, [query, search]);

  const choose = (hit: ProductHit) => {
    patch((d) => ({
      ...d,
      deal: {
        ...d.deal,
        shopifyId: hit.id,
        title: hit.title,
        sku: hit.sku ?? "",
        vendor: hit.vendor ?? "",
        imageUrl: hit.imageUrl ?? "",
        price: hit.price,
        // Never overwrite a cost a human typed with a null from Shopify.
        cost: hit.cost ?? d.deal.cost,
      },
      supplier: {
        ...d.supplier,
        name: d.supplier.name || (hit.vendor ?? ""),
      },
    }));
    setQuery("");
    setHits(null);
  };

  if (data.deal.title) {
    return (
      <div className="surface flex items-center gap-3 rounded-lg border border-hairline p-3">
        {data.deal.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.deal.imageUrl}
            alt=""
            className="size-11 shrink-0 rounded object-cover"
          />
        ) : (
          <div className="grid size-11 shrink-0 place-items-center rounded bg-[var(--panel-soft)]">
            <Package className="size-4 text-muted" aria-hidden />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">
            {data.deal.title}
          </p>
          <p className="truncate text-xs text-muted">
            {[data.deal.sku, data.deal.vendor].filter(Boolean).join(" · ") ||
              "No SKU"}
          </p>
        </div>
        <button
          type="button"
          aria-label="Change product"
          onClick={() =>
            patch((d) => ({
              ...d,
              deal: { ...d.deal, shopifyId: null, title: "", sku: "", imageUrl: "" },
            }))
          }
          className="rounded p-1 text-muted hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div>
      <label className="surface flex items-center gap-2 rounded-lg border border-hairline px-3 py-2">
        {busy ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted" aria-hidden />
        ) : (
          <Search className="size-4 shrink-0 text-muted" aria-hidden />
        )}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products…"
          className="w-full bg-transparent text-sm text-ink outline-none"
        />
      </label>

      {connected === false ? (
        <p className="mt-1.5 text-xs text-muted">
          Shopify isn&apos;t connected, so products can&apos;t be searched yet.
          Type the product name and price by hand for now.
        </p>
      ) : null}

      {!costAvailable && hits && hits.length > 0 ? (
        <p className="mt-1.5 text-xs text-muted">
          Shopify returned products but not costs — the app needs the
          inventory permission. Type the cost to get profit.
        </p>
      ) : null}

      {hits && hits.length > 0 ? (
        <ul className="surface mt-1.5 max-h-56 overflow-y-auto rounded-lg border border-hairline">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                onClick={() => choose(hit)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[var(--panel-soft)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">
                    {hit.title}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {[hit.sku, hit.vendor].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="num shrink-0 text-sm text-ink">
                  {money(hit.price)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {hits && hits.length === 0 && query.trim() && connected !== false ? (
        <p className="mt-1.5 text-xs text-muted">No products matched.</p>
      ) : null}

      <input
        value={data.deal.title}
        onChange={(e) =>
          patch((d) => ({ ...d, deal: { ...d.deal, title: e.target.value } }))
        }
        placeholder="…or type the product"
        className="mt-1.5 w-full rounded-lg border border-hairline bg-[var(--panel)] px-3 py-2 text-sm text-ink"
      />
    </div>
  );
}

function MoneyTile({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="surface-muted rounded-lg px-3 py-2">
      <span className="block text-[11px] text-muted">{label}</span>
      <span className="flex items-baseline gap-0.5">
        <span className="text-sm text-muted">$</span>
        <input
          inputMode="decimal"
          value={value ?? ""}
          onChange={(e) => {
            const raw = e.target.value.trim();
            onChange(raw === "" ? null : Number(raw.replace(/[^\d.-]/g, "")));
          }}
          placeholder="—"
          className="num w-full min-w-0 bg-transparent text-lg font-semibold text-ink outline-none"
        />
      </span>
    </label>
  );
}

function MoneyRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="flex-1" />
      <span className="text-muted">$</span>
      <input
        inputMode="decimal"
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value.trim();
          onChange(raw === "" ? null : Number(raw.replace(/[^\d.-]/g, "")));
        }}
        placeholder="—"
        className="num w-24 rounded border border-hairline bg-[var(--panel)] px-2 py-1 text-right text-ink"
      />
    </label>
  );
}

/**
 * A question with fixed answers. Unanswered stays amber — an untouched
 * check should look unfinished, not fine.
 */
function CheckRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const answered = value !== "unknown";
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg px-3 py-2",
        answered
          ? "surface-muted"
          : "bg-[color-mix(in_srgb,var(--amber)_13%,transparent)]",
      )}
    >
      <span
        className={cn(
          "min-w-0 flex-1 text-sm",
          answered ? "text-ink" : "text-ink",
        )}
      >
        {label}
      </span>
      <span className="flex flex-wrap gap-1">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            aria-pressed={value === opt.id}
            onClick={() => onChange(value === opt.id ? "unknown" : opt.id)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs whitespace-nowrap transition-colors",
              value === opt.id
                ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                : "border border-hairline text-muted hover:text-ink",
            )}
          >
            {opt.label}
          </button>
        ))}
      </span>
    </div>
  );
}
