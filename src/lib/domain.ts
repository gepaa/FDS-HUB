/**
 * Domain constants shared by server and client.
 *
 * Two record types on one shared spine (docs/FDS_CRM_Data_Model.md +
 * docs/FDS_HQ_Decisions.md): suppliers (outbound dealer recruiting)
 * and leads (inbound buyers). Each has its own status ladder.
 *
 * Stage colors extend the original CVD-checked hub palette; every
 * stage always renders with a visible label + count, never color-alone.
 */

export const RECORD_TYPES = [
  { id: "supplier", label: "Suppliers" },
  { id: "lead", label: "Leads" },
] as const;

export type RecordType = (typeof RECORD_TYPES)[number]["id"];

// ---------------- Status ladders ----------------

export const SUPPLIER_STAGES = [
  { id: "SOURCED", label: "Sourced", color: "#8A94A6" },
  { id: "QUALIFIED", label: "Qualified", color: "#5B8DEF" },
  { id: "CONTACTED", label: "Contacted", color: "#B8821A" },
  { id: "REPLIED", label: "Replied", color: "#C45FBE" },
  { id: "IN_CONVERSATION", label: "In Conversation", color: "#14A89A" },
  { id: "CALL_SCHEDULED", label: "Call Scheduled", color: "#7C6BE8" },
  { id: "NEGOTIATING", label: "Negotiating", color: "#C2410C" },
  { id: "AUTHORIZED", label: "Authorized Dealer", color: "#2E9E5B" },
  { id: "ON_HOLD", label: "On Hold", color: "#B08968" },
  { id: "DECLINED", label: "Declined", color: "#E5484D" },
] as const;

export const LEAD_STAGES = [
  { id: "NEW", label: "New", color: "#5B8DEF" },
  { id: "CONTACTED", label: "Contacted", color: "#B8821A" },
  { id: "ENGAGED", label: "Engaged", color: "#14A89A" },
  { id: "QUOTE_REQUESTED", label: "Quote Requested", color: "#C2410C" },
  { id: "QUOTE_SENT", label: "Quote Sent", color: "#C45FBE" },
  { id: "CALL_NEGOTIATION", label: "Call / Negotiation", color: "#7C6BE8" },
  { id: "WON", label: "Won", color: "#2E9E5B" },
  { id: "NURTURE", label: "Nurture", color: "#8A94A6" },
  { id: "LOST", label: "Lost", color: "#E5484D" },
] as const;

export type SupplierStageId = (typeof SUPPLIER_STAGES)[number]["id"];
export type LeadStageId = (typeof LEAD_STAGES)[number]["id"];
export type StageId = SupplierStageId | LeadStageId;

export const STAGES_BY_TYPE = {
  supplier: SUPPLIER_STAGES,
  lead: LEAD_STAGES,
} as const;

export function stagesFor(type: RecordType) {
  return STAGES_BY_TYPE[type];
}

/** Combined lookup for badges (CONTACTED appears in both — same label). */
export const STAGE_MAP: Record<
  string,
  { id: string; label: string; color: string }
> = Object.fromEntries(
  [...SUPPLIER_STAGES, ...LEAD_STAGES].map((s) => [s.id, s]),
);

export const SUPPLIER_STAGE_IDS = SUPPLIER_STAGES.map((s) => s.id);
export const LEAD_STAGE_IDS = LEAD_STAGES.map((s) => s.id);
export const ALL_STAGE_IDS = [
  ...new Set<string>([...SUPPLIER_STAGE_IDS, ...LEAD_STAGE_IDS]),
];

/** Terminal stages — no follow-up nagging once a record lands here. */
export const TERMINAL_STAGES = new Set<string>([
  "DECLINED",
  "AUTHORIZED",
  "WON",
  "LOST",
]);

/** CSV status text → supplier stage id (import mapping; includes the
 *  legacy hub/sheet names per the D3 migration table). */
export const CSV_STATUS_TO_STAGE: Record<string, SupplierStageId> = {
  sourced: "SOURCED",
  qualified: "QUALIFIED",
  contacted: "CONTACTED",
  replied: "REPLIED",
  "in conversation": "IN_CONVERSATION",
  "call scheduled": "CALL_SCHEDULED",
  negotiating: "NEGOTIATING",
  authorized: "AUTHORIZED",
  "authorized dealer": "AUTHORIZED",
  "on hold": "ON_HOLD",
  declined: "DECLINED",
  // Legacy values (pre-spec pipeline), mapped per docs/FDS_HQ_Decisions.md D3:
  "not contacted": "QUALIFIED",
  applied: "IN_CONVERSATION",
  "pending reply": "CONTACTED",
  approved: "AUTHORIZED",
  live: "AUTHORIZED",
  rejected: "DECLINED",
  closed: "DECLINED",
};

// ---------------- Spine enums ----------------

export const OWNERS = [
  { id: "claude", label: "Claude" },
  { id: "you", label: "You" },
  { id: "unassigned", label: "Unassigned" },
] as const;
export type Owner = (typeof OWNERS)[number]["id"];

export const PRIORITIES = [
  { id: "hot", label: "Hot", color: "#C2410C" },
  { id: "warm", label: "Warm", color: "#B8821A" },
  { id: "cold", label: "Cold", color: "#8A94A6" },
] as const;
export type Priority = (typeof PRIORITIES)[number]["id"];

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
  { id: "status", label: "Status change" },
  { id: "system", label: "System" },
] as const;

export type InteractionType = (typeof INTERACTION_TYPES)[number]["id"];

export const ACTORS = ["you", "claude", "system"] as const;
export type Actor = (typeof ACTORS)[number];

// ---------------- DTOs ----------------

/** Serialized record shape passed to client components (dates as ISO strings). */
export interface RecordDTO {
  id: string;
  recordId: string | null;
  type: RecordType;
  name: string;
  company: string | null;
  niche: string | null;
  cluster: string;
  bestSeller: string | null;
  rank: string | null;
  websiteUrl: string | null;
  dealerAppUrl: string | null;
  mainContact: string | null;
  email: string | null;
  phone: string | null;
  status: StageId;
  owner: Owner;
  priority: Priority | null;
  contextSummary: string | null;
  tags: string[];
  linkedThread: string | null;
  linkedShopifyId: string | null;
  mapPolicy: string | null;
  dropship: boolean | null;
  freightModel: string | null;
  leadTime: string | null;
  warranty: string | null;
  productCategories: string[];
  dealerProgram: string | null;
  mediaPermission: string | null;
  authorizationStatus: string | null;
  productInterest: string | null;
  intent: string | null;
  quoteAmount: number | null;
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
  recordId: string;
  date: string;
  type: InteractionType;
  body: string;
  actor: Actor;
}

/** True when a record's next action is due today or overdue. */
export function needsFollowUp(r: {
  nextActionDate: string | Date | null;
  status: string;
}): boolean {
  if (!r.nextActionDate) return false;
  if (TERMINAL_STAGES.has(r.status)) return false;
  const due = new Date(r.nextActionDate);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return due.getTime() <= today.getTime();
}
