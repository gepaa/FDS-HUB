import { resolveActor } from "@/lib/agent-auth";
import {
  getCachedProviderModels,
  listModelChoices,
} from "@/lib/agent/provider";

export const dynamic = "force-dynamic";

/**
 * GET /api/chat/models — every model the configured provider offers.
 *
 * Asked of the provider itself, so the picker can't offer something
 * that's been retired or renamed. Falls back to the curated list in
 * provider.ts if the provider can't be reached, and says which it is
 * rather than pretending the short list is everything.
 */
export async function GET(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;

  const fallback = listModelChoices();
  if (!fallback) {
    return Response.json({ configured: false, provider: null, models: [] });
  }

  const live = await getCachedProviderModels();
  return Response.json({
    configured: true,
    provider: fallback.provider,
    current: fallback.current,
    source: live?.length ? "provider" : "fallback",
    models: live?.length ? live : fallback.choices,
  });
}
