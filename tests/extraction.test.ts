import { describe, it, expect } from "vitest";
import {
  parseExtraction,
  safeFollowUpDate,
} from "@/lib/quo/extraction-schema";
import { buildCrmNote } from "@/lib/quo/extraction";

const minimal = {
  shortSummary: "Customer asked about a 6ft rotary cutter.",
};

describe("parseExtraction", () => {
  it("accepts a minimal object and fills safe defaults", () => {
    const out = parseExtraction(minimal)!;
    expect(out.shortSummary).toContain("rotary cutter");
    // Absent means null/empty — never a plausible-looking guess.
    expect(out.customerNeed).toBeNull();
    expect(out.productsMentioned).toEqual([]);
    expect(out.budget).toEqual({ amount: null, currency: null, confidence: 0 });
    expect(out.deliveryLocation).toEqual({
      city: null,
      state: null,
      postcode: null,
      country: null,
    });
    expect(out.objections).toEqual([]);
    expect(out.inventoryPromiseMade).toBe(false);
    expect(out.intentScore).toBe(0);
    expect(out.needsHumanReview).toBe(false);
  });

  it("rejects an object with no summary at all", () => {
    expect(parseExtraction({})).toBeNull();
    expect(parseExtraction({ shortSummary: "" })).toBeNull();
    expect(parseExtraction(null)).toBeNull();
  });

  it("accepts yes/no strings for the promise flags", () => {
    const out = parseExtraction({
      ...minimal,
      inventoryPromiseMade: "yes",
      freightPromiseMade: "no",
      priceMatchRequested: "true",
    })!;
    expect(out.inventoryPromiseMade).toBe(true);
    expect(out.freightPromiseMade).toBe(false);
    expect(out.priceMatchRequested).toBe(true);
  });

  it("keeps a stated budget with its confidence", () => {
    const out = parseExtraction({
      ...minimal,
      budget: { amount: 4500, currency: "USD", confidence: 0.9 },
    })!;
    expect(out.budget.amount).toBe(4500);
    expect(out.budget.confidence).toBe(0.9);
  });

  it("rejects an out-of-range intent score rather than clamping it", () => {
    // A score of 400 means the model misunderstood the contract; better
    // to fail and retry than to silently store something meaningless.
    expect(parseExtraction({ ...minimal, intentScore: 400 })).toBeNull();
    expect(parseExtraction({ ...minimal, intentScore: -1 })).toBeNull();
  });

  it("rejects a malformed product entry", () => {
    expect(
      parseExtraction({ ...minimal, productsMentioned: [{ model: "X" }] }),
    ).toBeNull();
  });

  it("drops non-string noise from string lists", () => {
    const out = parseExtraction({ ...minimal, objections: ["too dear"] })!;
    expect(out.objections).toEqual(["too dear"]);
    expect(parseExtraction({ ...minimal, objections: [42] })).toBeNull();
  });
});

describe("safeFollowUpDate", () => {
  const now = new Date("2026-07-27T12:00:00.000Z");

  it("accepts a sensible near-future date", () => {
    const d = safeFollowUpDate("2026-07-30T09:00:00.000Z", now);
    expect(d?.toISOString()).toBe("2026-07-30T09:00:00.000Z");
  });

  it("returns null for nonsense", () => {
    expect(safeFollowUpDate("next Tuesday-ish", now)).toBeNull();
    expect(safeFollowUpDate(null, now)).toBeNull();
  });

  it("refuses an absurdly distant date", () => {
    // A task due in 2091 is worse than a task with no date.
    expect(safeFollowUpDate("2091-01-01T00:00:00.000Z", now)).toBeNull();
  });

  it("treats a past date as tomorrow", () => {
    const d = safeFollowUpDate("2026-07-01T00:00:00.000Z", now);
    expect(d?.toISOString()).toBe("2026-07-28T12:00:00.000Z");
  });
});

describe("buildCrmNote", () => {
  it("summarises the call without inventing anything", () => {
    const e = parseExtraction({
      shortSummary: "Wants a 6ft rotary cutter for a 40hp Kubota.",
      customerNeed: "Clearing 12 acres of pasture",
      productsMentioned: [{ name: "Rotary cutter", model: "RC-72", quantity: 1 }],
      deliveryLocation: { city: "Bozeman", state: "MT" },
      objections: ["Freight seems high"],
      salespersonCommitments: ["Confirm freight cost by Tuesday"],
    })!;

    const note = buildCrmNote(e);
    expect(note).toContain("6ft rotary cutter");
    expect(note).toContain("Rotary cutter RC-72 x1");
    expect(note).toContain("Bozeman, MT");
    expect(note).toContain("Freight seems high");
    expect(note).toContain("Confirm freight cost by Tuesday");
    // Nothing about budget, because none was stated.
    expect(note).not.toMatch(/Budget/);
  });

  it("flags unverified promises loudly", () => {
    const e = parseExtraction({
      ...minimal,
      inventoryPromiseMade: true,
      freightPromiseMade: true,
    })!;
    const note = buildCrmNote(e);
    expect(note).toContain("Promised to confirm");
    expect(note).toContain("stock");
    expect(note).toContain("freight");
    expect(note).toContain("not verified");
  });

  it("marks a low-confidence budget as uncertain", () => {
    const e = parseExtraction({
      ...minimal,
      budget: { amount: 5000, currency: "$", confidence: 0.3 },
    })!;
    expect(buildCrmNote(e)).toContain("(uncertain)");
  });

  it("surfaces what the model was unsure about", () => {
    const e = parseExtraction({
      ...minimal,
      uncertainties: ["Could not hear the tractor model"],
    })!;
    expect(buildCrmNote(e)).toContain("Could not hear the tractor model");
  });
});
