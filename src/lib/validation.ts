import { z } from "zod";
import { CLUSTERS, STAGE_IDS } from "@/lib/domain";

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

export const supplierInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
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
  stage: z.enum(STAGE_IDS as [string, ...string[]]).default("NOT_CONTACTED"),
  mapPolicy: nullableTrimmed,
  dropship: z.boolean().nullable().optional().default(null),
  freightModel: nullableTrimmed,
  leadTime: nullableTrimmed,
  warranty: nullableTrimmed,
  lastContactDate: nullableDate,
  nextAction: nullableTrimmed,
  nextActionDate: nullableDate,
  notes: nullableTrimmed,
  source: nullableTrimmed,
});

export const supplierPatch = supplierInput.partial();

export const interactionInput = z.object({
  type: z.enum(["email", "call", "form", "note"]),
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
  suppliers: z
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
        stage: z
          .enum(STAGE_IDS as [string, ...string[]])
          .default("NOT_CONTACTED"),
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
