import { env } from "@/lib/env";
import type { Actor } from "@/lib/domain";

/**
 * Agent ⇄ app authentication (docs/FDS_HQ_Decisions.md D4).
 *
 * The Claude agent (PM / workers) reads and writes the hub's data
 * through this API with a bearer token. This is the single audit
 * choke-point: every agent write is attributed to actor "claude" and
 * logged on the record's activity log by the routes.
 *
 * - `Authorization: Bearer <AGENT_API_KEY>` → actor "claude"
 * - A bearer token that DOESN'T match → 401 (never silently demoted)
 * - No Authorization header → actor "you" (the local, same-origin UI;
 *   real multi-user auth is the parked Stage-7 work)
 */
export function resolveActor(req: Request): Actor | Response {
  const header = req.headers.get("authorization");
  if (!header) return "you";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (env.AGENT_API_KEY && token === env.AGENT_API_KEY) return "claude";
  return Response.json({ error: "Invalid agent token" }, { status: 401 });
}
