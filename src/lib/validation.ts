import { z } from "zod";
import { LEAD_STAGE_IDS, SUPPLIER_STAGE_IDS } from "@/lib/domain";

const nullableTrimmed = z
  .string()
  .transform((s) => {
    const t = s.trim();
    return t.length ? t : null;
  })
  .nullable()
  .optional();

/**
 * Dates arrive as "" (cleared), null, or a date string. An unparseable
 * string is an error, not a null — silently discarding it looked like a
 * successful save while the operator's date never landed.
 */
const nullableDate = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v, ctx) => {
    if (v === undefined) return undefined;
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: `"${v}" is not a valid date` });
      return z.NEVER;
    }
    return d;
  });

/** Email: optional, but must look like one when present. */
const nullableEmail = z
  .string()
  .transform((s) => {
    const t = s.trim();
    return t.length ? t : null;
  })
  .nullable()
  .optional()
  .refine((v) => v == null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
    message: "Enter a valid email address",
  });

/**
 * Cluster is operator-extensible: the original 8 are the seeded set, but
 * imports and later suppliers can introduce new ones, and the CRM filters
 * derive their options from whatever is actually in the DB. Constraining
 * this to the enum made an off-list cluster unsaveable.
 */
const clusterName = z.string().trim().min(1).max(80);

const stringList = z
  .array(z.string().trim().min(1))
  .optional()
  .transform((v) => v ?? []);

const supplierContact = z.object({
  id: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(120),
  role: z.string().trim().max(120).default(""),
  phone: z.string().trim().max(80).default(""),
  email: z
    .string()
    .trim()
    .max(200)
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "Enter a valid contact email address",
    })
    .default(""),
  notes: z.string().trim().max(1000).default(""),
  isPrimary: z.boolean().default(false),
});

const nullableTeamMemberId = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .nullable()
  .optional();

/**
 * The unified record input. `status` is validated against the ladder
 * for the record's `type` in refine() — the DB-level default is legacy
 * and never relied on (see prisma/schema.prisma NOTE), so creates must
 * go through this schema.
 */
export const recordInput = z
  .object({
    type: z.enum(["supplier", "lead"]).default("supplier"),
    name: z.string().trim().min(1, "Name is required").max(200),
    company: nullableTrimmed,
    niche: nullableTrimmed,
    cluster: clusterName.default("Other"),
    bestSeller: nullableTrimmed,
    rank: z
      .union([z.enum(["Gold", "Silver", "Bronze"]), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v ? v : null)),
    websiteUrl: nullableTrimmed,
    dealerAppUrl: nullableTrimmed,
    mainContact: nullableTrimmed,
    email: nullableEmail,
    phone: nullableTrimmed,
    status: z.string().optional(),
    owner: z.enum(["claude", "you", "unassigned"]).default("unassigned"),
    supplierOwnerId: nullableTeamMemberId,
    priority: z
      .union([z.enum(["hot", "warm", "cold"]), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v ? v : null)),
    contextSummary: nullableTrimmed,
    tags: stringList,
    linkedThread: nullableTrimmed,
    linkedShopifyId: nullableTrimmed,
    mapPolicy: nullableTrimmed,
    dropship: z.boolean().nullable().optional().default(null),
    freightModel: nullableTrimmed,
    leadTime: nullableTrimmed,
    warranty: nullableTrimmed,
    productCategories: stringList,
    dealerProgram: nullableTrimmed,
    mediaPermission: nullableTrimmed,
    authorizationStatus: nullableTrimmed,
    dealerApplicationSigned: z.boolean().optional().default(false),
    initialEmailSent: z.boolean().optional().default(false),
    supplierContacts: z.array(supplierContact).max(25).optional().default([]),
    productInterest: nullableTrimmed,
    intent: nullableTrimmed,
    quoteAmount: z.number().nonnegative().nullable().optional().default(null),
    lastContactDate: nullableDate,
    nextAction: nullableTrimmed,
    nextActionDate: nullableDate,
    notes: nullableTrimmed,
    source: nullableTrimmed,
  })
  .transform((data) => ({
    ...data,
    // Default status per type when not provided.
    status:
      data.status ?? (data.type === "lead" ? "NEW" : "SOURCED"),
  }))
  .superRefine((data, ctx) => {
    const ladder =
      data.type === "lead"
        ? (LEAD_STAGE_IDS as readonly string[])
        : (SUPPLIER_STAGE_IDS as readonly string[]);
    if (!ladder.includes(data.status)) {
      ctx.addIssue({
        code: "custom",
        message: `"${data.status}" is not a valid ${data.type} stage`,
        path: ["status"],
      });
    }
  });

/** Patch: all fields optional; status is re-checked against the ladder
 *  in the route (needs the existing record's type). */
export const recordPatch = z.object({
  type: z.enum(["supplier", "lead"]).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  company: nullableTrimmed,
  niche: nullableTrimmed,
  cluster: clusterName.optional(),
  bestSeller: nullableTrimmed,
  rank: z
    .union([z.enum(["Gold", "Silver", "Bronze"]), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === undefined ? undefined : v ? v : null)),
  websiteUrl: nullableTrimmed,
  dealerAppUrl: nullableTrimmed,
  mainContact: nullableTrimmed,
  email: nullableEmail,
  phone: nullableTrimmed,
  status: z.string().optional(),
  owner: z.enum(["claude", "you", "unassigned"]).optional(),
  supplierOwnerId: nullableTeamMemberId,
  priority: z
    .union([z.enum(["hot", "warm", "cold"]), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === undefined ? undefined : v ? v : null)),
  contextSummary: nullableTrimmed,
  tags: z.array(z.string().trim().min(1)).optional(),
  linkedThread: nullableTrimmed,
  linkedShopifyId: nullableTrimmed,
  mapPolicy: nullableTrimmed,
  dropship: z.boolean().nullable().optional(),
  freightModel: nullableTrimmed,
  leadTime: nullableTrimmed,
  warranty: nullableTrimmed,
  productCategories: z.array(z.string().trim().min(1)).optional(),
  dealerProgram: nullableTrimmed,
  mediaPermission: nullableTrimmed,
  authorizationStatus: nullableTrimmed,
  dealerApplicationSigned: z.boolean().optional(),
  initialEmailSent: z.boolean().optional(),
  supplierContacts: z.array(supplierContact).max(25).optional(),
  productInterest: nullableTrimmed,
  intent: nullableTrimmed,
  quoteAmount: z.number().nonnegative().nullable().optional(),
  lastContactDate: nullableDate,
  nextAction: nullableTrimmed,
  nextActionDate: nullableDate,
  notes: nullableTrimmed,
  source: nullableTrimmed,
});

export const interactionInput = z.object({
  type: z.enum(["email", "call", "form", "note", "status", "system"]),
  body: z.string().trim().min(1, "Body is required").max(4000),
  date: z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return new Date();
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? new Date() : d;
    }),
});

export const importInput = z.object({
  /**
   * Opt-in stage overwrite. A CSV is usually staler than the hub, so an
   * import must not silently drag a supplier backwards down the ladder —
   * the operator ticks this in the import modal when they mean it.
   */
  updateStages: z.boolean().optional().default(false),
  records: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        niche: z.string().nullable().optional(),
        bestSeller: z.string().nullable().optional(),
        rank: z.string().nullable().optional(),
        websiteUrl: z.string().nullable().optional(),
        dealerAppUrl: z.string().nullable().optional(),
        mainContact: z.string().nullable().optional(),
        email: z.string().nullable().optional(),
        phone: z.string().nullable().optional(),
        status: z
          .enum(SUPPLIER_STAGE_IDS as unknown as [string, ...string[]])
          .default("QUALIFIED"),
        nextAction: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        activityNote: z.string().nullable().optional(),
        cluster: z.string().nullable().optional(),
        mapPolicy: z.string().nullable().optional(),
        dropship: z.boolean().nullable().optional(),
        freightModel: z.string().nullable().optional(),
        leadTime: z.string().nullable().optional(),
        warranty: z.string().nullable().optional(),
      }),
    )
    .min(1)
    .max(2000),
});
