import { describe, it, expect } from "vitest";
import {
  toE164,
  displayPhone,
  sameNumber,
  telHref,
  maskNumber,
} from "@/lib/quo/phone";

// 415-555-0123 is a valid US number in the reserved fictional range —
// safe to put in a test suite, and it survives real validation.
const US = "+14155550123";

describe("toE164", () => {
  it("normalises the same US number written several ways", () => {
    const forms = [
      "+1 415 555 0123",
      "(415) 555-0123",
      "415-555-0123",
      "4155550123",
      "  +14155550123  ",
    ];
    for (const form of forms) {
      expect(toE164(form, "US")).toBe(US);
    }
  });

  it("respects an explicit country code over the default region", () => {
    // A UK number must not be mangled just because the default is US.
    expect(toE164("+44 20 7946 0958", "US")).toBe("+442079460958");
  });

  it("uses the default region for local-format numbers", () => {
    expect(toE164("020 7946 0958", "GB")).toBe("+442079460958");
  });

  it("returns null rather than guessing for unusable input", () => {
    for (const bad of ["", "   ", "hello", "12", null, undefined, "555-010"]) {
      expect(toE164(bad as string | null, "US")).toBeNull();
    }
  });

  it("rejects a number that is not valid in the given region", () => {
    // A UK local number read as US is not a real number — better to
    // return null than to invent a plausible-looking E.164 value.
    expect(toE164("020 7946 0958", "US")).toBeNull();
  });
});

describe("sameNumber", () => {
  it("matches across formatting differences", () => {
    expect(sameNumber("(415) 555-0123", US, "US")).toBe(true);
  });

  it("does not match different numbers", () => {
    expect(sameNumber(US, "+14155550124", "US")).toBe(false);
  });

  it("never matches when either side is unparseable", () => {
    // The important guarantee: unknown must not collapse into "equal",
    // or every bad number would match every other bad number.
    expect(sameNumber(null, null, "US")).toBe(false);
    expect(sameNumber("garbage", "garbage", "US")).toBe(false);
    expect(sameNumber(US, null, "US")).toBe(false);
  });

  it("does not treat a shared suffix as a match", () => {
    // Two real numbers sharing their last seven digits. This guards
    // against last-N-digits matching creeping back in — it would
    // attach one customer's recording to another customer's lead.
    expect(sameNumber(US, "+12125550123", "US")).toBe(false);
  });
});

describe("displayPhone", () => {
  it("formats a valid number for humans", () => {
    expect(displayPhone("4155550123", "US")).toBe("+1 415 555 0123");
  });

  it("falls back to the original text when unparseable", () => {
    expect(displayPhone("ext 4402", "US")).toBe("ext 4402");
  });

  it("returns an empty string for nothing", () => {
    expect(displayPhone(null, "US")).toBe("");
  });
});

describe("telHref", () => {
  it("builds an E.164 tel: link", () => {
    expect(telHref("(415) 555-0123", "US")).toBe(`tel:${US}`);
  });

  it("still produces something dialable for odd input", () => {
    expect(telHref("555-010", "US")).toBe("tel:555010");
  });

  it("returns null when there is nothing to dial", () => {
    expect(telHref("", "US")).toBeNull();
    expect(telHref(null, "US")).toBeNull();
  });
});

describe("maskNumber", () => {
  it("shows only the last four digits", () => {
    expect(maskNumber(US)).toBe("•••0123");
  });

  it("hides everything when there is too little to mask", () => {
    expect(maskNumber("12")).toBe("•••");
  });
});
