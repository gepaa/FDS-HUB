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
 * - A Bearer token that DOESN'T match → 401 (never silently demoted)
 * - `Authorization: Basic …` → actor "you" (the team gate in
 *   src/proxy.ts already verified it; browsers re-send it on fetches)
 * - No Authorization header → actor "you" (local dev UI; real
 *   multi-user auth is the parked Stage-7 work)
 */
export function resolveActor(req: Request): Actor | Response {
  const header = req.headers.get("authorization");
  if (!header || /^Basic\s/i.test(header)) return "you";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return "you";
  if (env.AGENT_API_KEY && match[1].trim() === env.AGENT_API_KEY)
    return "claude";
  return Response.json({ error: "Invalid agent token" }, { status: 401 });
}
