import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/team-auth";

/**
 * Team access gate (production). Next 16 proxy (né middleware).
 *
 * Signing in is a real page now, not the browser's native credential
 * popup. The credentials are the same shared TEAM_USER / TEAM_PASSWORD;
 * what changed is that a successful sign-in mints a signed, expiring
 * cookie, so the browser stops re-prompting and we control what the
 * screen looks like.
 *
 * Order of checks:
 * - No TEAM_PASSWORD configured → gate off (local dev).
 * - Public paths (Quo webhook, the login screen itself) → through.
 * - `Authorization: Bearer …` → through; API routes validate the agent
 *   token themselves (src/lib/agent-auth.ts).
 * - `Authorization: Basic …` → still accepted, so scripts and curl keep
 *   working without a browser session.
 * - Valid session cookie → through.
 * - Anything else → redirected to /login (or 401 JSON for API calls).
 *
 * Real per-user auth remains the parked Stage-7 work; this is still one
 * shared login, just a presentable one.
 */

/**
 * Paths reachable without a session.
 *
 * The Quo webhook is here because Quo's servers cannot sign in. It
 * authenticates every request by verifying a Standard-Webhooks
 * signature, which proves the payload came from Quo unaltered — a
 * stronger check than a shared password, not a weaker one.
 *
 * The login page and its endpoint are here for the obvious reason: a
 * gate you must already be through in order to reach is a locked door
 * with the key inside.
 */
const PUBLIC_PATHS = [
  "/api/integrations/quo/webhooks",
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const password = process.env.TEAM_PASSWORD;
  if (!password) return NextResponse.next();

  const header = request.headers.get("authorization") ?? "";

  if (/^Bearer\s/i.test(header)) return NextResponse.next();

  // Basic is kept for non-browser callers (scripts, curl, the agent).
  if (/^Basic\s/i.test(header)) {
    try {
      const decoded = atob(header.replace(/^Basic\s+/i, ""));
      const idx = decoded.indexOf(":");
      const user = decoded.slice(0, idx);
      const pass = decoded.slice(idx + 1);
      const expectedUser = process.env.TEAM_USER || "fds";
      if (user === expectedUser && pass === password) {
        return NextResponse.next();
      }
    } catch {
      // fall through
    }
  }

  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(cookie)) {
    return NextResponse.next();
  }

  // An API call from a signed-out tab should get a clean 401 it can
  // handle, not an HTML login page it will try to parse as JSON.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = "";
  // Come back to where they were heading once they're in.
  const target = pathname + request.nextUrl.search;
  if (target && target !== "/") login.searchParams.set("next", target);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except Next's static assets and the favicon files.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg).*)"],
};
