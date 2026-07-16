import { NextResponse, type NextRequest } from "next/server";

/**
 * Team access gate (production). Next 16 proxy (né middleware).
 *
 * - No TEAM_PASSWORD configured → gate off (local dev).
 * - `Authorization: Bearer …` → pass through; the API routes validate
 *   the agent token themselves (src/lib/agent-auth.ts).
 * - `Authorization: Basic …` → shared team credentials from env.
 * - Anything else → browser auth prompt.
 *
 * This is deliberately simple shared-credential protection so the CRM
 * isn't public while real per-user auth remains parked (Stage 7).
 */
export function proxy(request: NextRequest) {
  const password = process.env.TEAM_PASSWORD;
  if (!password) return NextResponse.next();

  const header = request.headers.get("authorization") ?? "";

  if (/^Bearer\s/i.test(header)) return NextResponse.next();

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
      // fall through to the challenge
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="FDS Operations HQ"' },
  });
}

export const config = {
  // Everything except Next's static assets and the favicon files.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|icon\\.svg).*)"],
};
