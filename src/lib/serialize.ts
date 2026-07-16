import type { SupplierDTO, InteractionDTO, StageId, InteractionType } from "@/lib/domain";

type SupplierRecord = {
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
  stage: string;
  mapPolicy: string | null;
  dropship: boolean | null;
  freightModel: string | null;
  leadTime: string | null;
  warranty: string | null;
  lastContactDate: Date | null;
  nextAction: string | null;
  nextActionDate: Date | null;
  notes: string | null;
  source: string | null;
  createdAt: Date;
  updatedAt: Date;
  interactions?: InteractionRecord[];
};

type InteractionRecord = {
  id: string;
  supplierId: string;
  date: Date;
  type: string;
  body: string;
};

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export function toInteractionDTO(i: InteractionRecord): InteractionDTO {
  return {
    id: i.id,
    supplierId: i.supplierId,
    date: i.date.toISOString(),
    type: i.type as InteractionType,
    body: i.body,
  };
}

/** Prisma supplier (+interactions) → JSON-safe DTO for the client. */
export function toSupplierDTO(s: SupplierRecord): SupplierDTO {
  return {
    id: s.id,
    name: s.name,
    niche: s.niche,
    cluster: s.cluster,
    bestSeller: s.bestSeller,
    rank: s.rank,
    websiteUrl: s.websiteUrl,
    dealerAppUrl: s.dealerAppUrl,
    mainContact: s.mainContact,
    email: s.email,
    phone: s.phone,
    stage: s.stage as StageId,
    mapPolicy: s.mapPolicy,
    dropship: s.dropship,
    freightModel: s.freightModel,
    leadTime: s.leadTime,
    warranty: s.warranty,
    lastContactDate: iso(s.lastContactDate),
    nextAction: s.nextAction,
    nextActionDate: iso(s.nextActionDate),
    notes: s.notes,
    source: s.source,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    interactions: (s.interactions ?? [])
      .slice()
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .map(toInteractionDTO),
  };
}
