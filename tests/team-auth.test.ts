import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
  credentialsValid,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/team-auth";

/**
 * The gate on the front door. A bug here either locks the team out of
 * their own CRM or lets strangers in, so every branch is pinned.
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

describe("credentialsValid", () => {
  it("accepts the configured login", () => {
    expect(credentialsValid("fds", "correct-horse-battery")).toBe(true);
  });

  it("ignores surrounding whitespace on the name", () => {
    expect(credentialsValid("  fds  ", "correct-horse-battery")).toBe(true);
  });

  it("rejects a wrong password", () => {
    expect(credentialsValid("fds", "nope")).toBe(false);
  });

  it("rejects a wrong user", () => {
    expect(credentialsValid("admin", "correct-horse-battery")).toBe(false);
  });

  it("does NOT trim the password", () => {
    // A trailing space is part of the password, not noise.
    expect(credentialsValid("fds", "correct-horse-battery ")).toBe(false);
  });

  it("refuses everything when no password is configured", () => {
    delete process.env.TEAM_PASSWORD;
    expect(credentialsValid("fds", "")).toBe(false);
    expect(credentialsValid("fds", "anything")).toBe(false);
  });
});

describe("session tokens", () => {
  it("round-trips a freshly minted token", async () => {
    const token = await createSessionToken();
    expect(token).not.toBeNull();
    expect(await verifySessionToken(token)).toBe(true);
  });

  it("rejects an expired token", async () => {
    const issuedAt = Date.now();
    const token = await createSessionToken(issuedAt);
    const afterExpiry =
      issuedAt + (SESSION_MAX_AGE_SECONDS + 60) * 1000;
    expect(await verifySessionToken(token, afterExpiry)).toBe(false);
  });

  it("still accepts a token just before it expires", async () => {
    const issuedAt = Date.now();
    const token = await createSessionToken(issuedAt);
    const justBefore = issuedAt + (SESSION_MAX_AGE_SECONDS - 60) * 1000;
    expect(await verifySessionToken(token, justBefore)).toBe(true);
  });

  it("rejects a tampered expiry", async () => {
    // The obvious attack: extend your own session.
    const token = (await createSessionToken())!;
    const [, signature] = token.split(".");
    const farFuture = Math.floor(Date.now() / 1000) + 999_999;
    expect(await verifySessionToken(`${farFuture}.${signature}`)).toBe(false);
  });

  it("rejects a tampered signature", async () => {
    const token = (await createSessionToken())!;
    const [expiry] = token.split(".");
    expect(await verifySessionToken(`${expiry}.AAAAinvalid`)).toBe(false);
  });

  it("rejects junk", async () => {
    for (const bad of ["", "nonsense", ".", "123.", null, undefined]) {
      expect(await verifySessionToken(bad as string | null)).toBe(false);
    }
  });

  it("invalidates existing sessions when the password is rotated", async () => {
    const token = await createSessionToken();
    expect(await verifySessionToken(token)).toBe(true);

    process.env.TEAM_PASSWORD = "a-new-shared-password";
    expect(await verifySessionToken(token)).toBe(false);
  });

  it("invalidates existing sessions when AUTH_SECRET changes", async () => {
    const token = await createSessionToken();
    process.env.AUTH_SECRET = "rotated";
    expect(await verifySessionToken(token)).toBe(false);
  });

  it("works without AUTH_SECRET set", async () => {
    // AUTH_SECRET is optional; the password alone must still sign.
    delete process.env.AUTH_SECRET;
    const token = await createSessionToken();
    expect(token).not.toBeNull();
    expect(await verifySessionToken(token)).toBe(true);
  });

  it("mints nothing when the gate is switched off", async () => {
    delete process.env.TEAM_PASSWORD;
    expect(await createSessionToken()).toBeNull();
    expect(await verifySessionToken("anything")).toBe(false);
  });

  it("does not accept a token signed for a different user", async () => {
    const token = await createSessionToken();
    process.env.TEAM_USER = "someone-else";
    expect(await verifySessionToken(token)).toBe(false);
  });
});
