import { describe, it, expect } from "vitest";
import {
  verifyWebhookSignature,
  signPayload,
  decodeSecret,
} from "@/lib/quo/signature";

const SECRET = "whsec_dGVzdC13ZWJob29rLXNlY3JldC12YWx1ZS0wMTIzNDU2Nzg5";
const ID = "msg_2abcDEFghiJKLmnoPQRstu";
const BODY = JSON.stringify({ resource: { id: "ACtest" } });

const nowSeconds = () => Math.floor(Date.now() / 1000);

function signed(overrides: Partial<Parameters<typeof verifyWebhookSignature>[0]> = {}) {
  const ts = String(nowSeconds());
  const sig = signPayload(SECRET, ID, ts, BODY);
  return verifyWebhookSignature({
    secret: SECRET,
    webhookId: ID,
    webhookTimestamp: ts,
    webhookSignature: `v1,${sig}`,
    rawBody: BODY,
    ...overrides,
  });
}

describe("decodeSecret", () => {
  it("strips the whsec_ prefix and base64-decodes the rest", () => {
    expect(decodeSecret(SECRET).toString("utf8")).toBe(
      "test-webhook-secret-value-0123456789",
    );
  });

  it("accepts a secret without the prefix", () => {
    const bare = SECRET.slice("whsec_".length);
    expect(decodeSecret(bare)).toEqual(decodeSecret(SECRET));
  });
});

describe("verifyWebhookSignature", () => {
  it("accepts a correctly signed delivery", () => {
    expect(signed()).toEqual({ valid: true });
  });

  it("accepts when several signatures are offered (key rotation)", () => {
    const ts = String(nowSeconds());
    const good = signPayload(SECRET, ID, ts, BODY);
    const result = verifyWebhookSignature({
      secret: SECRET,
      webhookId: ID,
      webhookTimestamp: ts,
      webhookSignature: `v1,AAAAinvalidAAAA= v1,${good}`,
      rawBody: BODY,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a tampered body", () => {
    const ts = String(nowSeconds());
    const sig = signPayload(SECRET, ID, ts, BODY);
    const result = verifyWebhookSignature({
      secret: SECRET,
      webhookId: ID,
      webhookTimestamp: ts,
      webhookSignature: `v1,${sig}`,
      rawBody: BODY.replace("ACtest", "ACother"),
    });
    expect(result).toEqual({ valid: false, reason: "no_match" });
  });

  it("rejects a signature made with a different secret", () => {
    const ts = String(nowSeconds());
    const sig = signPayload("whsec_b3RoZXJzZWNyZXQ=", ID, ts, BODY);
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        webhookId: ID,
        webhookTimestamp: ts,
        webhookSignature: `v1,${sig}`,
        rawBody: BODY,
      }),
    ).toEqual({ valid: false, reason: "no_match" });
  });

  it("rejects a replayed delivery outside the tolerance window", () => {
    const old = String(nowSeconds() - 3600);
    const sig = signPayload(SECRET, ID, old, BODY);
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        webhookId: ID,
        webhookTimestamp: old,
        webhookSignature: `v1,${sig}`,
        rawBody: BODY,
      }),
    ).toEqual({ valid: false, reason: "timestamp_out_of_tolerance" });
  });

  it("rejects a timestamp from the future beyond tolerance", () => {
    const future = String(nowSeconds() + 3600);
    const sig = signPayload(SECRET, ID, future, BODY);
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        webhookId: ID,
        webhookTimestamp: future,
        webhookSignature: `v1,${sig}`,
        rawBody: BODY,
      }).valid,
    ).toBe(false);
  });

  it("reports a missing secret distinctly from a bad signature", () => {
    // The route turns this into a 503 (our misconfiguration) rather
    // than a 401 (a bad caller), so the distinction has to survive.
    expect(signed({ secret: undefined })).toEqual({
      valid: false,
      reason: "missing_secret",
    });
  });

  it("rejects missing headers", () => {
    expect(signed({ webhookId: null })).toEqual({
      valid: false,
      reason: "missing_headers",
    });
  });

  it("rejects a malformed signature header", () => {
    expect(signed({ webhookSignature: "garbage-without-version" })).toEqual({
      valid: false,
      reason: "malformed_signature",
    });
  });

  it("rejects an unknown signature version", () => {
    const ts = String(nowSeconds());
    const sig = signPayload(SECRET, ID, ts, BODY);
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        webhookId: ID,
        webhookTimestamp: ts,
        webhookSignature: `v2,${sig}`,
        rawBody: BODY,
      }),
    ).toEqual({ valid: false, reason: "malformed_signature" });
  });

  it("rejects a non-numeric timestamp", () => {
    expect(signed({ webhookTimestamp: "not-a-number" })).toEqual({
      valid: false,
      reason: "bad_timestamp",
    });
  });

  it("is sensitive to byte-level body differences", () => {
    // Whitespace changes the signature — this is why the route must
    // verify the raw body rather than a re-serialised object.
    const ts = String(nowSeconds());
    const sig = signPayload(SECRET, ID, ts, BODY);
    expect(
      verifyWebhookSignature({
        secret: SECRET,
        webhookId: ID,
        webhookTimestamp: ts,
        webhookSignature: `v1,${sig}`,
        rawBody: JSON.stringify(JSON.parse(BODY), null, 2),
      }).valid,
    ).toBe(false);
  });
});
