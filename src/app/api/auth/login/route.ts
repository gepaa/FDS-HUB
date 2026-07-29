import { z } from "zod";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  credentialsValid,
} from "@/lib/team-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/login — configuration check.
 *
 * "The right password is rejected" has two very different causes: the
 * password is wrong, or the server has no password configured at all
 * (a missing or mis-scoped environment variable). Those are
 * indistinguishable from the login form, and guessing between them
 * wastes an afternoon.
 *
 * This reports only whether a password is configured and how long it
 * is — never the value, never a hash of it. A length alone is not
 * usefully brute-forceable, and it instantly settles "did my paste
 * bring a trailing newline with it".
 */
export function GET() {
  const raw = process.env.TEAM_PASSWORD ?? "";
  const trimmed = raw.trim();
  return Response.json({
    gateEnabled: trimmed.length > 0,
    expectedUser: (process.env.TEAM_USER ?? "").trim() || "fds",
    passwordLength: trimmed.length,
    hadSurroundingWhitespace: raw !== trimmed,
  });
}

const loginInput = z.object({
  user: z.string().max(200).default(""),
  password: z.string().max(500),
});

/**
 * POST /api/auth/login — exchange the shared team credentials for a
 * session cookie.
 *
 * The failure message is deliberately vague ("those details don't
 * match") and identical whether the username or the password was
 * wrong: with one shared login there is nothing to gain from telling a
 * stranger which half they got right.
 */
export async function POST(request: Request) {
  if (!process.env.TEAM_PASSWORD) {
    // No gate configured (local dev) — there is nothing to sign into.
    return Response.json({ ok: true, gateDisabled: true });
  }

  const body = await request.json().catch(() => null);
  const parsed = loginInput.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Enter your password" }, { status: 400 });
  }

  const user = parsed.data.user || process.env.TEAM_USER || "fds";
  if (!credentialsValid(user, parsed.data.password)) {
    return Response.json(
      { error: "Those details don't match" },
      { status: 401 },
    );
  }

  const token = await createSessionToken();
  if (!token) {
    return Response.json({ error: "Sign-in unavailable" }, { status: 500 });
  }

  // NextResponse.cookies, not headers.append("Set-Cookie", …): the
  // Fetch spec guards Set-Cookie on an already-constructed Response,
  // so appending it can be silently dropped — and a login that
  // silently fails to set its cookie is a login nobody can complete.
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    // Secure everywhere except plain-http local development.
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
