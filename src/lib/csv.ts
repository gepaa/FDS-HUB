import Papa from "papaparse";
import { CSV_STATUS_TO_STAGE, type StageId } from "@/lib/domain";

/**
 * CSV parsing shared by the seed script and the in-app importer.
 * Two formats are supported:
 *
 * 1. The raw FDS "Supplier Outreach - Supplier CRM" sheet export —
 *    leading title rows, a header row containing "Suppliers/Brands",
 *    and fixed column positions.
 * 2. The hub's own export format — a standard header row keyed by
 *    field name (round-trips through export → import).
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
  stage: StageId;
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

function toStage(value: unknown): StageId {
  const key = (typeof value === "string" ? value : "").trim().toLowerCase();
  return CSV_STATUS_TO_STAGE[key] ?? "NOT_CONTACTED";
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
        return {
          name: c(0) as string,
          niche: c(1),
          bestSeller: c(2),
          rank: c(3),
          websiteUrl: c(4),
          mainContact: c(5),
          email: c(6),
          phone: c(7),
          activityNote: c(8),
          dealerAppUrl: c(9),
          stage: toStage(r[nameCol + 10]),
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
    .map((row) => ({
      name: clean(row.name) as string,
      niche: clean(row.niche),
      bestSeller: clean(row.bestSeller),
      rank: clean(row.rank),
      websiteUrl: clean(row.websiteUrl),
      dealerAppUrl: clean(row.dealerAppUrl),
      mainContact: clean(row.mainContact),
      email: clean(row.email),
      phone: clean(row.phone),
      stage: toStage(row.stage?.replace(/_/g, " ")),
      nextAction: clean(row.nextAction),
      notes: clean(row.notes),
      activityNote: null,
      cluster: clean(row.cluster),
      mapPolicy: clean(row.mapPolicy),
      dropship: row.dropship ? row.dropship.toLowerCase() === "true" : null,
      freightModel: clean(row.freightModel),
      leadTime: clean(row.leadTime),
      warranty: clean(row.warranty),
    }));
}

export const EXPORT_HEADERS = [
  "name",
  "niche",
  "cluster",
  "bestSeller",
  "rank",
  "websiteUrl",
  "dealerAppUrl",
  "mainContact",
  "email",
  "phone",
  "stage",
  "mapPolicy",
  "dropship",
  "freightModel",
  "leadTime",
  "warranty",
  "lastContactDate",
  "nextAction",
  "nextActionDate",
  "notes",
  "source",
] as const;
