import { env } from "@/lib/env";

/**
 * Shopify Admin GraphQL client — server-only, env-driven.
 *
 * The connection seam: SHOPIFY_STORE_DOMAIN (the *.myshopify.com
 * domain) + SHOPIFY_ADMIN_TOKEN (custom-app Admin API token). Until
 * both are present the UI shows the honest ConnectState — no
 * fabricated metrics, ever.
 *
 * Every section of the overview fails soft: a missing API scope on
 * the token (e.g. read_orders) nulls that section instead of taking
 * down the whole panel.
 */

const API_VERSION = "2025-10";

export function shopifyConfigured(): boolean {
  return Boolean(env.SHOPIFY_STORE_DOMAIN && env.SHOPIFY_ADMIN_TOKEN);
}

/** e.g. "gthv54-e1" from "gthv54-e1.myshopify.com" — for admin deep links. */
export function shopifyStoreHandle(): string | null {
  const domain = env.SHOPIFY_STORE_DOMAIN;
  if (!domain) return null;
  return domain.replace(/\.myshopify\.com$/, "");
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

async function adminQuery<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  if (!shopifyConfigured()) {
    throw new Error("Shopify is not configured (missing domain or token)");
  }
  const res = await fetch(
    `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": env.SHOPIFY_ADMIN_TOKEN as string,
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    },
  );
  if (!res.ok) {
    throw new Error(`Shopify Admin API responded ${res.status}`);
  }
  const json = (await res.json()) as GraphQLResponse<T>;
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  if (!json.data) throw new Error("Shopify Admin API returned no data");
  return json.data;
}

// ---------------- typed overview ----------------

export interface ShopifyOrderSummary {
  id: string;
  name: string;
  createdAt: string;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  total: string;
  currency: string;
}

export interface ShopifyOverview {
  shop: { name: string; domain: string; currency: string } | null;
  /** Active products in the store; null if the query failed. */
  productsCount: number | null;
  /** Store customers; null when the token lacks read_customers. */
  customersCount: number | null;
  /** Every product vendor (brand) currently in the catalog. */
  vendors: string[];
  /** Latest orders; null when the token lacks read_orders. */
  recentOrders: ShopifyOrderSummary[] | null;
}

interface CoreData {
  shop: { name: string; myshopifyDomain: string; currencyCode: string };
  productsCount: { count: number } | null;
  productVendors: { edges: { node: string }[] };
}

interface CustomersData {
  customersCount: { count: number } | null;
}

interface OrdersData {
  orders: {
    edges: {
      node: {
        id: string;
        name: string;
        createdAt: string;
        displayFinancialStatus: string | null;
        displayFulfillmentStatus: string | null;
        currentTotalPriceSet: {
          shopMoney: { amount: string; currencyCode: string };
        };
      };
    }[];
  };
}

/**
 * One round of everything the Shopify panel shows. Sections resolve
 * independently so one missing scope can't blank the page.
 */
export async function getShopifyOverview(): Promise<ShopifyOverview> {
  const [core, customers, orders] = await Promise.allSettled([
    adminQuery<CoreData>(
      `{ shop { name myshopifyDomain currencyCode }
         productsCount { count }
         productVendors(first: 100) { edges { node } } }`,
    ),
    adminQuery<CustomersData>(`{ customersCount { count } }`),
    adminQuery<OrdersData>(
      `{ orders(first: 10, sortKey: CREATED_AT, reverse: true) {
           edges { node {
             id name createdAt
             displayFinancialStatus displayFulfillmentStatus
             currentTotalPriceSet { shopMoney { amount currencyCode } }
           } } } }`,
    ),
  ]);

  return {
    shop:
      core.status === "fulfilled"
        ? {
            name: core.value.shop.name,
            domain: core.value.shop.myshopifyDomain,
            currency: core.value.shop.currencyCode,
          }
        : null,
    productsCount:
      core.status === "fulfilled"
        ? (core.value.productsCount?.count ?? null)
        : null,
    vendors:
      core.status === "fulfilled"
        ? core.value.productVendors.edges.map((e) => e.node)
        : [],
    customersCount:
      customers.status === "fulfilled"
        ? (customers.value.customersCount?.count ?? null)
        : null,
    recentOrders:
      orders.status === "fulfilled"
        ? orders.value.orders.edges.map(({ node }) => ({
            id: node.id,
            name: node.name,
            createdAt: node.createdAt,
            financialStatus: node.displayFinancialStatus,
            fulfillmentStatus: node.displayFulfillmentStatus,
            total: node.currentTotalPriceSet.shopMoney.amount,
            currency: node.currentTotalPriceSet.shopMoney.currencyCode,
          }))
        : null,
  };
}

// ---------------- CRM ↔ store matching ----------------

/** Normalize a brand/supplier name for matching ("Rimol Greenhouse
 *  Systems" ↔ "Rimol Greenhouses"). */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

export interface VendorMatch {
  vendor: string;
  /** CRM record id when a supplier matches this vendor. */
  recordId: string | null;
  recordName: string | null;
  recordStatus: string | null;
}

/**
 * Match store vendors against CRM suppliers by normalized name
 * (exact or one-way containment). Pure function — callers pass the
 * supplier list so this stays testable and DB-free.
 */
export function matchVendorsToSuppliers(
  vendors: string[],
  suppliers: { id: string; name: string; status: string }[],
): VendorMatch[] {
  const normalized = suppliers.map((s) => ({ ...s, key: normalize(s.name) }));
  return vendors.map((vendor) => {
    const key = normalize(vendor);
    const hit =
      normalized.find((s) => s.key === key) ??
      normalized.find(
        (s) =>
          (s.key.length >= 6 && key.includes(s.key)) ||
          (key.length >= 6 && s.key.includes(key)),
      );
    return {
      vendor,
      recordId: hit?.id ?? null,
      recordName: hit?.name ?? null,
      recordStatus: hit?.status ?? null,
    };
  });
}
