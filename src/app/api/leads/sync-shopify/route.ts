import { resolveActor } from "@/lib/agent-auth";
import { syncShopifyLeads } from "@/lib/lead-sync";

export const dynamic = "force-dynamic";

/**
 * POST /api/leads/sync-shopify — pull recent Shopify customers into the
 * Leads CRM. Safe to run repeatedly: existing leads are matched by
 * Shopify ID (then email) and only enriched, never overwritten.
 */
export async function POST(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;

  const result = await syncShopifyLeads();
  if (!result.configured) {
    return Response.json(
      { error: "Shopify isn't connected — add the store credentials first." },
      { status: 400 },
    );
  }
  return Response.json({ ok: true, ...result });
}
