import type { Metadata } from "next";
import Link from "next/link";
import {
  ExternalLink,
  Package,
  ShoppingBag,
  Store,
  Tags,
  Users,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getIntegrations } from "@/lib/integrations";
import {
  getShopifyOverview,
  matchVendorsToSuppliers,
  shopifyConfigured,
  shopifyStoreHandle,
} from "@/lib/shopify";
import { shortDate } from "@/lib/utils";
import { GlassPanel } from "@/components/kit/GlassPanel";
import { StatTile } from "@/components/kit/StatTile";
import { StatusPill } from "@/components/kit/StatusPill";
import { ConnectState } from "@/components/kit/ConnectState";
import { StageBadge } from "@/components/crm/badges";

export const metadata: Metadata = { title: "Shopify" };
export const dynamic = "force-dynamic";

export default async function ShopifyPage() {
  const shopify = getIntegrations().find((i) => i.id === "shopify");
  const connected = shopifyConfigured();

  const [overview, suppliers] = connected
    ? await Promise.all([
        getShopifyOverview(),
        prisma.crmRecord.findMany({
          where: { type: "supplier" },
          select: { id: true, name: true, status: true },
        }),
      ])
    : [null, []];

  const matches = overview
    ? matchVendorsToSuppliers(overview.vendors, suppliers)
    : [];
  const inCrm = matches.filter((m) => m.recordId);
  const notInCrm = matches.filter((m) => !m.recordId);
  const handle = shopifyStoreHandle();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-card bg-[var(--accent-soft)] text-accent-bright">
          <ShoppingBag size={20} aria-hidden />
        </span>
        <div>
          <h1 className="font-display text-3xl text-ink">Shopify</h1>
          <p className="text-sm text-muted">
            {overview?.shop
              ? `${overview.shop.name} · ${overview.shop.domain}`
              : "Live store analytics, wired into the supplier CRM."}
          </p>
        </div>
        <span className="ml-auto flex items-center gap-2">
          <StatusPill
            status={connected ? "connected" : "disconnected"}
            pulse={connected}
            label={connected ? "Connected" : "Not connected"}
          />
          {handle ? (
            <a
              href={`https://admin.shopify.com/store/${handle}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-accent-bright hover:underline"
            >
              Open admin <ExternalLink size={11} aria-hidden />
            </a>
          ) : null}
        </span>
      </header>

      {!connected ? (
        <ConnectState
          icon={Store}
          name="Connect your store"
          description="The client is wired against this exact seam — the panel comes alive the moment the Admin API token lands in the environment. Until then it stays honestly empty: no fabricated metrics, ever."
          requiredEnv={shopify?.requiredEnv ?? []}
          setupUrl={shopify?.setupUrl}
          checklist={[
            "SHOPIFY_STORE_DOMAIN is already set (gthv54-e1.myshopify.com) — only the token is missing",
            "Shopify admin → Settings → Apps and sales channels → Develop apps",
            "Create an app named “FDS Command Hub”",
            "Grant Admin API scopes: read_products, read_orders, read_customers",
            "Install the app, reveal the Admin API access token (shpat_…)",
            "Paste it as SHOPIFY_ADMIN_TOKEN in .env (local) and Vercel → Environment Variables (production)",
          ]}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatTile
              label="Products in store"
              value={overview?.productsCount ?? "—"}
              icon={Package}
              tone="accent"
            />
            <StatTile
              label="Dealer brands"
              value={overview?.vendors.length ?? "—"}
              sub="product vendors in catalog"
              icon={Tags}
            />
            <StatTile
              label="Linked to CRM"
              value={inCrm.length}
              sub={
                notInCrm.length > 0
                  ? `${notInCrm.length} brands not in CRM yet`
                  : "every brand matched"
              }
              icon={Users}
              tone={inCrm.length > 0 ? "green" : "default"}
            />
            <StatTile
              label="Customers"
              value={overview?.customersCount ?? "—"}
              sub={
                overview?.customersCount === null
                  ? "token needs read_customers"
                  : undefined
              }
              icon={Store}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <GlassPanel className="p-5">
              <h2 className="text-sm font-semibold tracking-tight text-ink">
                Dealer brands ↔ CRM
              </h2>
              <p className="mt-1 text-xs text-muted">
                Store vendors matched to supplier records by name. Click
                through to manage the record.
              </p>
              <ul className="mt-4 flex flex-col gap-1">
                {inCrm.map((m) => (
                  <li key={m.vendor}>
                    <Link
                      href={`/crm?record=${m.recordId}`}
                      className="press flex items-center gap-2 rounded-control px-2 py-1.5 hover:bg-[var(--panel-soft)]"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                        {m.vendor}
                      </span>
                      {m.recordStatus ? (
                        <StageBadge stage={m.recordStatus} />
                      ) : null}
                    </Link>
                  </li>
                ))}
                {inCrm.length === 0 ? (
                  <li className="px-2 py-4 text-sm text-muted">
                    No store vendors match a CRM supplier yet.
                  </li>
                ) : null}
              </ul>
              {notInCrm.length > 0 ? (
                <>
                  <h3 className="mt-5 text-[11px] font-semibold tracking-wider text-muted uppercase">
                    In store, not in CRM
                  </h3>
                  <p className="mt-2 flex flex-wrap gap-1.5">
                    {notInCrm.map((m) => (
                      <span
                        key={m.vendor}
                        className="surface-muted rounded-full px-2.5 py-1 text-xs text-muted"
                      >
                        {m.vendor}
                      </span>
                    ))}
                  </p>
                </>
              ) : null}
            </GlassPanel>

            <GlassPanel className="p-5">
              <h2 className="text-sm font-semibold tracking-tight text-ink">
                Recent orders
              </h2>
              {overview?.recentOrders === null ? (
                <p className="mt-4 text-sm text-muted">
                  The Admin token doesn&apos;t have the{" "}
                  <code className="surface-muted rounded px-1 py-0.5 font-mono text-[11px]">
                    read_orders
                  </code>{" "}
                  scope yet — grant it in the custom app to see orders here.
                </p>
              ) : overview?.recentOrders?.length === 0 ? (
                <p className="mt-4 text-sm text-muted">No orders yet.</p>
              ) : (
                <ul className="mt-4 flex flex-col">
                  {overview?.recentOrders?.map((o) => (
                    <li
                      key={o.id}
                      className="flex items-center gap-3 border-b border-hairline py-2.5 text-sm last:border-b-0"
                    >
                      <span className="num font-medium text-ink">{o.name}</span>
                      <span className="text-xs text-muted">
                        {shortDate(o.createdAt)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs text-muted">
                        {[o.financialStatus, o.fulfillmentStatus]
                          .filter(Boolean)
                          .join(" · ")
                          .toLowerCase()
                          .replace(/_/g, " ")}
                      </span>
                      <span className="num shrink-0 font-medium text-ink">
                        ${Number(o.total).toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </GlassPanel>
          </div>
        </>
      )}
    </div>
  );
}
