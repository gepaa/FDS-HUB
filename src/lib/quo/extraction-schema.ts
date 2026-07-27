import { z } from "zod";

/**
 * The structured object we extract from a call.
 *
 * This schema is the contract, and it is enforced — a model reply that
 * doesn't fit is rejected rather than half-stored. That matters here
 * more than usual: these fields drive what a salesperson believes they
 * promised a customer about stock, freight and price.
 *
 * Everything optional defaults to null or an empty list, never to a
 * plausible-looking guess. "We don't know" has to survive the round
 * trip intact.
 */

const nullableString = z
  .string()
  .trim()
  .min(1)
  .nullish()
  .transform((v) => v ?? null);

const stringList = z
  .array(z.string().trim().min(1))
  .nullish()
  .transform((v) => v ?? []);

const nullableNumber = z
  .number()
  .finite()
  .nullish()
  .transform((v) => (v === undefined ? null : v));

/** Models like to answer "yes"/"no" — accept that, store a boolean. */
const looseBoolean = z
  .union([z.boolean(), z.string(), z.null()])
  .nullish()
  .transform((v) => {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (s === "true" || s === "yes") return true;
      if (s === "false" || s === "no") return false;
    }
    return null;
  });

export const productMentionSchema = z.object({
  name: z.string().trim().min(1),
  model: nullableString,
  quantity: nullableNumber,
});

export const callExtractionSchema = z.object({
  shortSummary: z.string().trim().min(1),
  customerNeed: nullableString,

  productsMentioned: z
    .array(productMentionSchema)
    .nullish()
    .transform((v) => v ?? []),
  productCategory: nullableString,

  budget: z
    .object({
      amount: nullableNumber,
      currency: nullableString,
      // How sure the model is, 0–1. Low confidence is displayed, not hidden.
      confidence: z
        .number()
        .min(0)
        .max(1)
        .nullish()
        .transform((v) => v ?? 0),
    })
    .nullish()
    .transform((v) => v ?? { amount: null, currency: null, confidence: 0 }),

  deliveryLocation: z
    .object({
      city: nullableString,
      state: nullableString,
      postcode: nullableString,
      country: nullableString,
    })
    .nullish()
    .transform(
      (v) => v ?? { city: null, state: null, postcode: null, country: null },
    ),

  desiredTimeline: nullableString,
  questionsAsked: stringList,
  objections: stringList,
  shippingConcerns: stringList,

  priceMatchRequested: looseBoolean,

  // The promise flags. These exist so a salesperson can be reminded of
  // what they committed to — they are never treated as confirmation
  // that the thing itself is true.
  inventoryPromiseMade: looseBoolean.transform((v) => v ?? false),
  pricingPromiseMade: looseBoolean.transform((v) => v ?? false),
  freightPromiseMade: looseBoolean.transform((v) => v ?? false),

  customerCommitments: stringList,
  salespersonCommitments: stringList,

  recommendedNextAction: nullableString,
  recommendedFollowUpAt: nullableString,

  intentScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .nullish()
    .transform((v) => v ?? 0),
  intentReason: z
    .string()
    .trim()
    .nullish()
    .transform((v) => v ?? ""),

  needsHumanReview: looseBoolean.transform((v) => v ?? false),
  uncertainties: stringList,
});

export type CallExtraction = z.infer<typeof callExtractionSchema>;

/**
 * Parse a model reply. Returns null rather than throwing so the caller
 * can record a clean failure and retry later — a malformed reply is an
 * ordinary event, not an exception.
 */
export function parseExtraction(raw: unknown): CallExtraction | null {
  const result = callExtractionSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/**
 * A follow-up date we are willing to act on. Anything unparseable, in
 * the past, or absurdly far out is dropped — a task due in 2091 is
 * worse than a task with no date.
 */
export function safeFollowUpDate(
  value: string | null,
  now = new Date(),
): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const maxAhead = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  if (parsed > maxAhead) return null;
  // A model suggesting a past date means "soon" — treat as tomorrow.
  if (parsed < now) return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return parsed;
}
