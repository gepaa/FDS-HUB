import Papa from "papaparse";
import { CSV_STATUS_TO_STAGE, type SupplierStageId } from "@/lib/domain";

/**
 * CSV parsing shared by the seed script and the in-app importer.
 * Supplier records only (leads arrive via Shopify/Gmail, not CSV).
 * Two formats are supported:
 *
 * 1. The raw FDS "Supplier Outreach - Supplier CRM" sheet export —
 *    leading title rows, a header row containing "Suppliers/Brands",
 *    and fixed column positions.
 * 2. The hub's own export format — a standard header row keyed by
 *    field name (round-trips through export → import).
 *
 * Legacy status text ("not contacted", "applied", …) maps to the spec
 * ladder per docs/FDS_HQ_Decisions.md D3. "Not contacted" maps to
 * QUALIFIED — the consumer downgrades unranked rows to SOURCED.
 */
export interface ParsedSupplier {
  name: string;
  niche: string | null;
  bestSeller: string | null;
  rank: string | null;
  websiteUrl: string | null;
  dealerAppUrl: string | null;
  mainContact: string | null;
  email: string | null;
  phone: string | null;
  status: SupplierStageId;
  /** The raw status text from the sheet (e.g. "Pending Reply") —
   *  preserved so the seed can write an accurate legacy:* tag. */
  rawStatus: string | null;
  nextAction: string | null;
  notes: string | null;
  /** Free-text activity column from the FDS sheet → seeded as an interaction. */
  activityNote: string | null;
  cluster?: string | null;
  mapPolicy?: string | null;
  dropship?: boolean | null;
  freightModel?: string | null;
  leadTime?: string | null;
  warranty?: string | null;
}

const clean = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length ? s : null;
};

/** Raw sheet status text → stage id; remembers whether it was the
 *  legacy "not contacted" so the caller can apply the rank rule. */
export function toStage(value: unknown): {
  status: SupplierStageId;
  wasNotContacted: boolean;
} {
  const key = (typeof value === "string" ? value : "").trim().toLowerCase();
  return {
    status: CSV_STATUS_TO_STAGE[key] ?? "QUALIFIED",
    wasNotContacted: key === "not contacted" || key === "",
  };
}

/** Parse either supported CSV format into supplier records. */
export function parseSupplierCsv(text: string): ParsedSupplier[] {
  const { data } = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
  const rows = data as string[][];

  // FDS raw sheet: locate the header row by its signature cell.
  const headerIdx = rows.findIndex((r) =>
    r.some((c) => (c ?? "").trim() === "Suppliers/Brands"),
  );
  if (headerIdx !== -1) {
    const nameCol = rows[headerIdx].findIndex(
      (c) => (c ?? "").trim() === "Suppliers/Brands",
    );
    return rows
      .slice(headerIdx + 1)
      .filter((r) => clean(r[nameCol]))
      .map((r) => {
        // Columns relative to the name column, as laid out in the sheet:
        // name, niche, best seller, rank, url, contact, email, phone,
        // activity, apply-online, status, next step, notes
        const c = (offset: number) => clean(r[nameCol + offset]);
        const rank = c(3);
        const { status, wasNotContacted } = toStage(r[nameCol + 10]);
        return {
          name: c(0) as string,
          niche: c(1),
          bestSeller: c(2),
          rank,
          websiteUrl: c(4),
          mainContact: c(5),
          email: c(6),
          phone: c(7),
          activityNote: c(8),
          dealerAppUrl: c(9),
          // Rank rule (D3): vetted+ranked rows enter at QUALIFIED;
          // unranked "not contacted" rows are merely SOURCED.
          status: wasNotContacted && !rank ? "SOURCED" : status,
          rawStatus: clean(r[nameCol + 10]),
          nextAction: c(11),
          notes: c(12),
        };
      });
  }

  // Hub export format: header row keyed by field name.
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
  });
  return (parsed.data ?? [])
    .filter((row) => clean(row.name))
    .map((row) => {
      const rank = clean(row.rank);
      const raw = (row.status ?? row.stage ?? "").replace(/_/g, " ");
      const { status, wasNotContacted } = toStage(raw);
      return {
        name: clean(row.name) as string,
        niche: clean(row.niche),
        bestSeller: clean(row.bestSeller),
        rank,
        websiteUrl: clean(row.websiteUrl),
        dealerAppUrl: clean(row.dealerAppUrl),
        mainContact: clean(row.mainContact),
        email: clean(row.email),
        phone: clean(row.phone),
        status: wasNotContacted && !rank ? "SOURCED" : status,
        rawStatus: clean(raw),
        nextAction: clean(row.nextAction),
        notes: clean(row.notes),
        activityNote: null,
        cluster: clean(row.cluster),
        mapPolicy: clean(row.mapPolicy),
        dropship: row.dropship ? row.dropship.toLowerCase() === "true" : null,
        freightModel: clean(row.freightModel),
        leadTime: clean(row.leadTime),
        warranty: clean(row.warranty),
      };
    });
}

export const EXPORT_HEADERS = [
  "recordId",
  "type",
  "name",
  "company",
  "niche",
  "cluster",
  "bestSeller",
  "rank",
  "websiteUrl",
  "dealerAppUrl",
  "mainContact",
  "email",
  "phone",
  "status",
  "owner",
  "priority",
  "contextSummary",
  "tags",
  "mapPolicy",
  "dropship",
  "freightModel",
  "leadTime",
  "warranty",
  "dealerProgram",
  "mediaPermission",
  "authorizationStatus",
  "productInterest",
  "intent",
  "quoteAmount",
  "lastContactDate",
  "nextAction",
  "nextActionDate",
  "notes",
  "source",
] as const;
