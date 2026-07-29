import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/team-auth";

export const dynamic = "force-dynamic";

/** POST /api/auth/logout — drop the session cookie. */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
