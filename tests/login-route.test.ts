import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/team-auth";

/**
 * The login endpoint, end to end.
 *
 * The reason this exists: `Response.headers.append("Set-Cookie", …)` is
 * guarded by the Fetch spec and can be silently dropped, producing a
 * login that returns 200 and sets nothing — the user types the right
 * password, gets bounced back to the login page, and has no way to tell
 * why. These assertions pin that the cookie is really on the response
 * and that it really verifies.
 */

const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env.TEAM_USER = "fds";
  process.env.TEAM_PASSWORD = "correct-horse-battery";
  process.env.AUTH_SECRET = "test-auth-secret";
});

afterEach(() => {
  process.env.TEAM_USER = ORIGINAL.TEAM_USER;
  process.env.TEAM_PASSWORD = ORIGINAL.TEAM_PASSWORD;
  process.env.AUTH_SECRET = ORIGINAL.AUTH_SECRET;
});

const post = async (body: unknown) => {
  const { POST } = await import("@/app/api/auth/login/route");
  return POST(
    new Request("https://hub.test/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
};

/** Pull the session cookie value out of a response. */
function sessionCookie(res: Response): string | null {
  const raw = res.headers.get("set-cookie");
  if (!raw) return null;
  const match = raw.match(new RegExp(`${SESSION_COOKIE}=([^;]*)`));
  return match ? match[1] : null;
}

describe("POST /api/auth/login", () => {
  it("sets a cookie that actually verifies", async () => {
    const res = await post({ user: "fds", password: "correct-horse-battery" });
    expect(res.status).toBe(200);

    const token = sessionCookie(res);
    expect(token).toBeTruthy();
    expect(await verifySessionToken(token)).toBe(true);
  });

  it("marks the cookie HttpOnly and SameSite", async () => {
    const res = await post({ user: "fds", password: "correct-horse-battery" });
    const raw = res.headers.get("set-cookie") ?? "";
    // HttpOnly keeps the session out of reach of any injected script.
    expect(raw.toLowerCase()).toContain("httponly");
    expect(raw.toLowerCase()).toContain("samesite=lax");
    expect(raw.toLowerCase()).toContain("path=/");
  });

  it("defaults the user when only a password is given", async () => {
    // The form leaves the name blank most of the time.
    const res = await post({ password: "correct-horse-battery" });
    expect(res.status).toBe(200);
    expect(await verifySessionToken(sessionCookie(res))).toBe(true);
  });

  it("rejects a wrong password and sets no cookie", async () => {
    const res = await post({ user: "fds", password: "wrong" });
    expect(res.status).toBe(401);
    expect(sessionCookie(res)).toBeNull();
  });

  it("rejects a wrong user and sets no cookie", async () => {
    const res = await post({ user: "root", password: "correct-horse-battery" });
    expect(res.status).toBe(401);
    expect(sessionCookie(res)).toBeNull();
  });

  it("gives the same message whichever half was wrong", async () => {
    // One shared login: telling a stranger which half they got right
    // is free information for no benefit.
    const a = (await (await post({ user: "root", password: "correct-horse-battery" })).json()) as { error: string };
    const b = (await (await post({ user: "fds", password: "wrong" })).json()) as { error: string };
    expect(a.error).toBe(b.error);
  });

  it("rejects a malformed body without crashing", async () => {
    const res = await post({ nope: true });
    expect(res.status).toBe(400);
    expect(sessionCookie(res)).toBeNull();
  });

  it("reports the gate as disabled when no password is configured", async () => {
    delete process.env.TEAM_PASSWORD;
    const res = await post({ password: "anything" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ gateDisabled: true });
    // Critically: no session is minted for a gate that isn't on.
    expect(sessionCookie(res)).toBeNull();
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the cookie", async () => {
    const { POST } = await import("@/app/api/auth/logout/route");
    const res = await POST();
    const raw = res.headers.get("set-cookie") ?? "";
    expect(raw).toContain(`${SESSION_COOKIE}=`);
    expect(raw.toLowerCase()).toContain("max-age=0");
  });
});
