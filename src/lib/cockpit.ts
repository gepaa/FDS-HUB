/**
 * Live Sales Cockpit — shared domain types and reference data.
 *
 * The cockpit's working state is one JSON blob (`CockpitData`) on the
 * CallSession row, autosaved during the call. Everything here is
 * shared by the client screen and the API routes; nothing imports
 * server-only modules.
 */

// ---------------- structured notes ----------------

export type NoteKind = "confirmed" | "note" | "objection" | "suggestion";

export interface CallNote {
  at: string; // ISO timestamp
  kind: NoteKind;
  text: string;
}

// ---------------- call-time working state ----------------

export interface SpecRow {
  label: string;
  value: string;
  verified: boolean;
}

export interface CockpitData {
  /** Where the customer is — drives freight talk. Verified on-call. */
  location: string;
  /** The supplier behind the deal (picked from the CRM). */
  supplier: { id: string; name: string; contact: string; phone: string };
  product: {
    title: string;
    sku: string;
    price: string; // list price as shown to customer
    imageUrl: string;
    specs: SpecRow[];
  };
  fitCheck: {
    status: "unknown" | "fits" | "needs_check" | "no_fit";
    note: string; // e.g. "Cat 1 3-pt hitch, needs 35+ HP — customer has 40 HP Kubota"
  };
  stock: {
    status: "unverified" | "in_stock" | "low" | "out";
    detail: string; // qty / source, e.g. "6 units — supplier phone 07-21"
    checkedAt: string | null;
  };
  freight: {
    status: "unknown" | "requested" | "quoted";
    cost: string;
    note: string;
  };
  terms: {
    warranty: string;
    leadTime: string;
    verified: boolean;
  };
  quote: {
    price: string; // what we quote the customer
    cost: string; // our product cost
    freight: string; // freight cost to us
  };
  objection: string;
  followUpDate: string; // yyyy-mm-dd
  questions: string[]; // next recommended questions (AI or playbook)
}

export function emptyCockpitData(seed?: {
  productInterest?: string | null;
  warranty?: string | null;
  leadTime?: string | null;
  quoteAmount?: number | null;
}): CockpitData {
  return {
    location: "",
    supplier: { id: "", name: "", contact: "", phone: "" },
    product: {
      title: seed?.productInterest ?? "",
      sku: "",
      price: "",
      imageUrl: "",
      specs: [],
    },
    fitCheck: { status: "unknown", note: "" },
    stock: { status: "unverified", detail: "", checkedAt: null },
    freight: { status: "unknown", cost: "", note: "" },
    terms: {
      warranty: seed?.warranty ?? "",
      leadTime: seed?.leadTime ?? "",
      verified: Boolean(seed?.warranty || seed?.leadTime),
    },
    quote: {
      price: seed?.quoteAmount ? String(seed.quoteAmount) : "",
      cost: "",
      freight: "",
    },
    objection: "",
    followUpDate: "",
    questions: [],
  };
}

/** What is still unverified — feeds the big warning banner. */
export function unverifiedItems(d: CockpitData): string[] {
  const out: string[] = [];
  if (d.product.title && d.product.specs.some((s) => !s.verified))
    out.push("product specs");
  if (d.fitCheck.status === "unknown" || d.fitCheck.status === "needs_check")
    out.push("fit / compatibility");
  if (d.stock.status === "unverified") out.push("stock");
  if (d.freight.status === "unknown") out.push("freight cost");
  if (!d.terms.verified) out.push("warranty / lead time");
  return out;
}

// ---------------- call outcomes ----------------

export const CALL_OUTCOMES = [
  { id: "advancing", label: "Advancing", tone: "blue" },
  { id: "quote_requested", label: "Quote Requested", tone: "blue" },
  { id: "follow_up", label: "Follow-Up", tone: "amber" },
  { id: "won", label: "Won", tone: "green" },
  { id: "nurture", label: "Nurture", tone: "muted" },
  { id: "lost", label: "Lost", tone: "red" },
] as const;

export type CallOutcome = (typeof CALL_OUTCOMES)[number]["id"];

/** Stage the record moves to on each outcome (null = keep current). */
export function stageForOutcome(
  outcome: CallOutcome,
  recordType: string,
): string | null {
  const lead = recordType === "lead";
  switch (outcome) {
    case "advancing":
      return lead ? "ENGAGED" : "IN_CONVERSATION";
    case "quote_requested":
      return lead ? "QUOTE_REQUESTED" : "NEGOTIATING";
    case "follow_up":
      return null;
    case "won":
      return lead ? "WON" : "AUTHORIZED";
    case "nurture":
      return lead ? "NURTURE" : "ON_HOLD";
    case "lost":
      return lead ? "LOST" : "DECLINED";
  }
}

// ---------------- objection playbook ----------------

export interface ObjectionPlay {
  id: string;
  objection: string;
  response: string;
}

export const OBJECTION_PLAYS: ObjectionPlay[] = [
  {
    id: "price",
    objection: "Price is too high",
    response:
      "Compare total cost, not sticker: freight included, real warranty, and a person who answers the phone after the sale. Ask what they're comparing against — dealers often quote before freight and setup.",
  },
  {
    id: "cheaper",
    objection: "Found it cheaper elsewhere",
    response:
      "Ask for the exact model number — 'cheaper' is usually a lighter-duty variant or excludes freight. Offer to price-check the identical spec and match the comparison honestly.",
  },
  {
    id: "freight",
    objection: "Shipping takes too long",
    response:
      "Give the honest lead time and lock a date: 'It ships freight from the manufacturer — I'll confirm the exact window today and hold your place so you're first out when it lands.'",
  },
  {
    id: "fit",
    objection: "Not sure it fits my tractor",
    response:
      "Run the FitCheck now: HP range, hitch category, hydraulics. Get their tractor model on this call — never let fit doubt leave the call unresolved.",
  },
  {
    id: "trust",
    objection: "Never heard of your company",
    response:
      "We're an authorized dealer — the manufacturer's warranty applies in full, the freight is insured, and you can call this same number and reach me directly. Offer a reference or the manufacturer's dealer page.",
  },
  {
    id: "think",
    objection: "Need to think about it",
    response:
      "Surface the real blocker: 'Totally fair — is it the price, the timing, or making sure it's the right unit?' Then book the follow-up before hanging up.",
  },
  {
    id: "spouse",
    objection: "Have to check with someone",
    response:
      "Offer to send a one-page quote they can share, and schedule the three-way follow-up call while you have them.",
  },
];

// ---------------- fallback recommended questions ----------------

export function playbookQuestions(recordType: string, status: string): string[] {
  if (recordType === "supplier") {
    return [
      "Do you dropship, and what's the freight model on single-unit orders?",
      "What's the dealer margin and MAP policy?",
      "What's the warranty and who handles claims?",
      "What does it take to get authorized — forms, minimums, timing?",
    ];
  }
  const early = ["NEW", "CONTACTED", "ENGAGED"].includes(status);
  return early
    ? [
        "What tractor are you running (make, model, HP)?",
        "What job is this for, and how many hours a season?",
        "When do you need it working — is there a deadline?",
        "Are you comparing other models or dealers right now?",
      ]
    : [
        "What would need to be true for you to order this week?",
        "Is the budget approved, or does someone else sign off?",
        "Delivery address — farm or commercial with a forklift?",
        "If freight lands under $X, are we done?",
      ];
}
