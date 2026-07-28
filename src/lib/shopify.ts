import { env } from "@/lib/env";

/**
 * Shopify Admin GraphQL client — server-only, env-driven.
 *
 * The connection seam: SHOPIFY_STORE_DOMAIN (the *.myshopify.com
 * domain) plus credentials — either SHOPIFY_CLIENT_ID +
 * SHOPIFY_CLIENT_SECRET from a Dev Dashboard app (preferred; tokens
 * are exchanged and refreshed automatically via the OAuth client
 * credentials grant) or a legacy static SHOPIFY_ADMIN_TOKEN. Until
 * credentials are present the UI shows the honest ConnectState — no
 * fabricated metrics, ever.
 *
 * Every section of the overview fails soft: a missing API scope on
 * the token (e.g. read_orders) nulls that section instead of taking
 * down the whole panel.
 */

const API_VERSION = "2025-10";

export function shopifyConfigured(): boolean {
  return Boolean(
    env.SHOPIFY_STORE_DOMAIN &&
      (env.SHOPIFY_ADMIN_TOKEN ||
        (env.SHOPIFY_CLIENT_ID && env.SHOPIFY_CLIENT_SECRET)),
  );
}

// ---------------- access token (client credentials grant) ----------------

/** Cached 24h token from the client credentials exchange. */
let tokenCache: { token: string; expiresAt: number } | null = null;

/**
 * Resolve the Admin API access token: a legacy static token wins;
 * otherwise exchange client credentials at the store's OAuth endpoint
 * (POST /admin/oauth/access_token, grant_type=client_credentials).
 * Tokens last 24h; we refresh 5 minutes early.
 */
async function getAccessToken(): Promise<string> {
  if (env.SHOPIFY_ADMIN_TOKEN) return env.SHOPIFY_ADMIN_TOKEN;
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }
  const res = await fetch(
    `https://${env.SHOPIFY_STORE_DOMAIN}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: env.SHOPIFY_CLIENT_ID as string,
        client_secret: env.SHOPIFY_CLIENT_SECRET as string,
      }),
      cache: "no-store",
    },
  );
  if (!res.ok) {
    throw new Error(
      `Shopify token exchange failed (${res.status}) — check the app is installed on the store and the client credentials are correct`,
    );
  }
  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  tokenCache = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in - 300) * 1000,
  };
  return json.access_token;
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
    throw new Error("Shopify is not configured (missing domain or credentials)");
  }
  const res = await fetch(
    `https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": await getAccessToken(),
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

// ---------------- customers (for the agent's lead sync) ----------------

export interface ShopifyCustomerSummary {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  ordersCount: number;
  amountSpent: string;
  createdAt: string;
}

interface CustomersListData {
  customers: {
    edges: {
      node: {
        id: string;
        displayName: string;
        email: string | null;
        phone: string | null;
        numberOfOrders: string;
        amountSpent: { amount: string; currencyCode: string };
        createdAt: string;
        defaultAddress: { city: string | null; provinceCode: string | null } | null;
      };
    }[];
  };
}

/** Latest store customers — the agent uses this to sync buyers into
 *  the CRM as leads. Requires the read_customers scope. */
export async function getShopifyCustomers(
  limit = 25,
): Promise<ShopifyCustomerSummary[]> {
  const data = await adminQuery<CustomersListData>(
    `{ customers(first: ${Math.min(Math.max(limit, 1), 50)}, sortKey: CREATED_AT, reverse: true) {
         edges { node {
           id displayName email phone numberOfOrders createdAt
           amountSpent { amount currencyCode }
           defaultAddress { city provinceCode }
         } } } }`,
  );
  return data.customers.edges.map(({ node }) => ({
    id: node.id,
    name: node.displayName,
    email: node.email,
    phone: node.phone,
    location: node.defaultAddress
      ? [node.defaultAddress.city, node.defaultAddress.provinceCode]
          .filter(Boolean)
          .join(", ") || null
      : null,
    ordersCount: parseInt(node.numberOfOrders, 10) || 0,
    amountSpent: `${node.amountSpent.amount} ${node.amountSpent.currencyCode}`,
    createdAt: node.createdAt,
  }));
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

// ---------------- product search (call cockpit) ----------------

/**
 * A product as the cockpit needs it: what we sell it for, what it costs
 * us, and whether there is any to sell.
 *
 * `cost` is the part that makes profit real, and it is the part most
 * likely to be missing. Unit cost lives on the inventory item and needs
 * the `read_inventory` scope — an app set up with only read_products
 * will return products fine and costs not at all. That is reported
 * honestly as a null cost so the salesperson can type the number,
 * rather than a zero that would quietly turn into fictional profit.
 */
export interface ShopifyProductHit {
  id: string;
  title: string;
  vendor: string | null;
  sku: string | null;
  imageUrl: string | null;
  /** What the customer pays, per the store. */
  price: number | null;
  /** What it costs us. Null when Shopify won't tell us. */
  cost: number | null;
  currency: string | null;
  inventoryQuantity: number | null;
  variantTitle: string | null;
}

interface ProductSearchResponse {
  products: {
    edges: {
      node: {
        id: string;
        title: string;
        vendor: string | null;
        featuredImage: { url: string } | null;
        variants: {
          edges: {
            node: {
              id: string;
              title: string | null;
              sku: string | null;
              price: string | null;
              inventoryQuantity: number | null;
              inventoryItem: {
                unitCost: { amount: string; currencyCode: string } | null;
              } | null;
            };
          }[];
        };
      };
    }[];
  };
}

const PRODUCT_FIELDS = `
  id
  title
  vendor
  featuredImage { url }
  variants(first: 1) {
    edges {
      node {
        id
        title
        sku
        price
        inventoryQuantity
        inventoryItem { unitCost { amount currencyCode } }
      }
    }
  }
`;

/**
 * Search the store. Falls back to the same query without cost when the
 * token lacks inventory access, so a narrow scope degrades to "no cost"
 * instead of "no products".
 */
export async function searchShopifyProducts(
  term: string,
  limit = 8,
): Promise<{ products: ShopifyProductHit[]; costAvailable: boolean }> {
  const trimmed = term.trim();
  // Shopify's search syntax: a bare term matches title/sku/vendor.
  const q = trimmed ? `${trimmed.replace(/["\\]/g, "")}*` : "";
  const take = Math.min(Math.max(limit, 1), 25);

  const build = (fields: string) => `
    query SearchProducts($q: String, $n: Int!) {
      products(first: $n, query: $q) { edges { node { ${fields} } } }
    }
  `;

  let data: ProductSearchResponse;
  let costAvailable = true;
  try {
    data = await adminQuery<ProductSearchResponse>(build(PRODUCT_FIELDS), {
      q: q || null,
      n: take,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    // Only retry for an access problem — a genuine query error should
    // surface rather than be masked by a second attempt.
    if (!/access|scope|permission/i.test(message)) throw err;
    costAvailable = false;
    const withoutCost = PRODUCT_FIELDS.replace(
      "inventoryItem { unitCost { amount currencyCode } }",
      "",
    );
    data = await adminQuery<ProductSearchResponse>(build(withoutCost), {
      q: q || null,
      n: take,
    });
  }

  const products = (data.products?.edges ?? []).map(({ node }) => {
    const variant = node.variants?.edges?.[0]?.node ?? null;
    const cost = variant?.inventoryItem?.unitCost?.amount;
    return {
      id: node.id,
      title: node.title,
      vendor: node.vendor || null,
      sku: variant?.sku || null,
      imageUrl: node.featuredImage?.url ?? null,
      price: variant?.price ? Number(variant.price) : null,
      cost: cost != null ? Number(cost) : null,
      currency: variant?.inventoryItem?.unitCost?.currencyCode ?? null,
      inventoryQuantity: variant?.inventoryQuantity ?? null,
      variantTitle:
        variant?.title && variant.title !== "Default Title"
          ? variant.title
          : null,
    } satisfies ShopifyProductHit;
  });

  return { products, costAvailable };
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
