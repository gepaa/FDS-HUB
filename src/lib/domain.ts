/**
 * Domain constants shared by server and client.
 * Pipeline stages, category clusters, and ranks mirror the real FDS
 * Supplier Outreach CRM sheet.
 */

// Stage colors validated with the dataviz palette validator (dark +
// light surfaces, CVD-safe adjacent pairs). NOT_CONTACTED is a
// deliberate neutral — it encodes absence of pipeline activity — and
// every stage color ships with a visible label + count (never
// color-alone).
export const STAGES = [
  { id: "NOT_CONTACTED", label: "Not Contacted", color: "#8A94A6" },
  { id: "CONTACTED", label: "Contacted", color: "#5B8DEF" },
  { id: "APPLIED", label: "Applied", color: "#C45FBE" },
  { id: "PENDING_REPLY", label: "Pending Reply", color: "#B8821A" },
  { id: "APPROVED", label: "Approved", color: "#14A89A" },
  { id: "LIVE", label: "Live", color: "#2E9E5B" },
  { id: "REJECTED", label: "Rejected", color: "#E5484D" },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

export const STAGE_MAP: Record<StageId, (typeof STAGES)[number]> =
  Object.fromEntries(STAGES.map((s) => [s.id, s])) as Record<
    StageId,
    (typeof STAGES)[number]
  >;

export const STAGE_IDS = STAGES.map((s) => s.id);

/** CSV status text → stage id (import mapping for the FDS sheet). */
export const CSV_STATUS_TO_STAGE: Record<string, StageId> = {
  "not contacted": "NOT_CONTACTED",
  contacted: "CONTACTED",
  applied: "APPLIED",
  "pending reply": "PENDING_REPLY",
  approved: "APPROVED",
  live: "LIVE",
  rejected: "REJECTED",
  closed: "REJECTED",
};

export const RANKS = ["Gold", "Silver", "Bronze"] as const;
export type Rank = (typeof RANKS)[number];

export const RANK_COLORS: Record<string, string> = {
  Gold: "#D9A741",
  Silver: "#9BA7B4",
  Bronze: "#B0793F",
};

export const CLUSTERS = [
  "Tractor/Skid Attachments",
  "Livestock Handling",
  "Greenhouses/High Tunnels",
  "Fencing",
  "Sprayers",
  "Irrigation",
  "Trailers",
  "Other",
] as const;

export type Cluster = (typeof CLUSTERS)[number];

export const INTERACTION_TYPES = [
  { id: "email", label: "Email" },
  { id: "call", label: "Call" },
  { id: "form", label: "Form" },
  { id: "note", label: "Note" },
] as const;

export type InteractionType = (typeof INTERACTION_TYPES)[number]["id"];

/** Serialized supplier shape passed to client components (dates as ISO strings). */
export interface SupplierDTO {
  id: string;
  name: string;
  niche: string | null;
  cluster: string;
  bestSeller: string | null;
  rank: string | null;
  websiteUrl: string | null;
  dealerAppUrl: string | null;
  mainContact: string | null;
  email: string | null;
  phone: string | null;
  stage: StageId;
  mapPolicy: string | null;
  dropship: boolean | null;
  freightModel: string | null;
  leadTime: string | null;
  warranty: string | null;
  lastContactDate: string | null;
  nextAction: string | null;
  nextActionDate: string | null;
  notes: string | null;
  source: string | null;
  createdAt: string;
  updatedAt: string;
  interactions: InteractionDTO[];
}

export interface InteractionDTO {
  id: string;
  supplierId: string;
  date: string;
  type: InteractionType;
  body: string;
}

/** True when a supplier's next action is due today or overdue. */
export function needsFollowUp(s: {
  nextActionDate: string | Date | null;
  stage: string;
}): boolean {
  if (!s.nextActionDate) return false;
  if (s.stage === "REJECTED") return false;
  const due = new Date(s.nextActionDate);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return due.getTime() <= today.getTime();
}
