import { z } from "zod";
import {
  CLUSTERS,
  LEAD_STAGE_IDS,
  SUPPLIER_STAGE_IDS,
} from "@/lib/domain";

const nullableTrimmed = z
  .string()
  .transform((s) => {
    const t = s.trim();
    return t.length ? t : null;
  })
  .nullable()
  .optional();

const nullableDate = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  });

const stringList = z
  .array(z.string().trim().min(1))
  .optional()
  .transform((v) => v ?? []);

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
    cluster: z.enum(CLUSTERS).default("Other"),
    bestSeller: nullableTrimmed,
    rank: z
      .union([z.enum(["Gold", "Silver", "Bronze"]), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v ? v : null)),
    websiteUrl: nullableTrimmed,
    dealerAppUrl: nullableTrimmed,
    mainContact: nullableTrimmed,
    email: nullableTrimmed,
    phone: nullableTrimmed,
    status: z.string().optional(),
    owner: z.enum(["claude", "you", "unassigned"]).default("unassigned"),
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
  cluster: z.enum(CLUSTERS).optional(),
  bestSeller: nullableTrimmed,
  rank: z
    .union([z.enum(["Gold", "Silver", "Bronze"]), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === undefined ? undefined : v ? v : null)),
  websiteUrl: nullableTrimmed,
  dealerAppUrl: nullableTrimmed,
  mainContact: nullableTrimmed,
  email: nullableTrimmed,
  phone: nullableTrimmed,
  status: z.string().optional(),
  owner: z.enum(["claude", "you", "unassigned"]).optional(),
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
