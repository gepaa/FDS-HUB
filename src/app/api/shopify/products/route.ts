import { resolveActor } from "@/lib/agent-auth";
import { shopifyConfigured, searchShopifyProducts } from "@/lib/shopify";

export const dynamic = "force-dynamic";

/**
 * GET /api/shopify/products?q=rotary — product picker for the cockpit.
 *
 * Returns an honest `connected: false` rather than an error when
 * Shopify has no credentials yet, so the cockpit can say "connect
 * Shopify to pull products" instead of looking broken.
 */
export async function GET(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;

  if (!shopifyConfigured()) {
    return Response.json({
      connected: false,
      costAvailable: false,
      products: [],
    });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const limit = Number(url.searchParams.get("limit") ?? 8);

  try {
    const { products, costAvailable } = await searchShopifyProducts(q, limit);
    return Response.json({ connected: true, costAvailable, products });
  } catch (err) {
    return Response.json(
      {
        connected: true,
        costAvailable: false,
        products: [],
        error: err instanceof Error ? err.message : "Shopify search failed",
      },
      { status: 502 },
    );
  }
}
