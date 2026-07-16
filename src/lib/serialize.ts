import type {
  RecordDTO,
  InteractionDTO,
  StageId,
  InteractionType,
  RecordType,
  Owner,
  Priority,
  Actor,
} from "@/lib/domain";
import type { CrmRecord, Interaction } from "@/generated/prisma/client";

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

const jsonList = (s: string): string[] => {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};

export function toInteractionDTO(i: Interaction): InteractionDTO {
  return {
    id: i.id,
    recordId: i.recordId,
    date: i.date.toISOString(),
    type: i.type as InteractionType,
    body: i.body,
    actor: i.actor as Actor,
  };
}

/** Prisma record (+interactions) → JSON-safe DTO for the client. */
export function toRecordDTO(
  r: CrmRecord & { interactions?: Interaction[] },
): RecordDTO {
  return {
    id: r.id,
    recordId: r.recordId,
    type: r.type as RecordType,
    name: r.name,
    company: r.company,
    niche: r.niche,
    cluster: r.cluster,
    bestSeller: r.bestSeller,
    rank: r.rank,
    websiteUrl: r.websiteUrl,
    dealerAppUrl: r.dealerAppUrl,
    mainContact: r.mainContact,
    email: r.email,
    phone: r.phone,
    status: r.status as StageId,
    owner: r.owner as Owner,
    priority: (r.priority as Priority | null) ?? null,
    contextSummary: r.contextSummary,
    tags: jsonList(r.tags),
    linkedThread: r.linkedThread,
    linkedShopifyId: r.linkedShopifyId,
    mapPolicy: r.mapPolicy,
    dropship: r.dropship,
    freightModel: r.freightModel,
    leadTime: r.leadTime,
    warranty: r.warranty,
    productCategories: jsonList(r.productCategories),
    dealerProgram: r.dealerProgram,
    mediaPermission: r.mediaPermission,
    authorizationStatus: r.authorizationStatus,
    productInterest: r.productInterest,
    intent: r.intent,
    quoteAmount: r.quoteAmount,
    lastContactDate: iso(r.lastContactDate),
    nextAction: r.nextAction,
    nextActionDate: iso(r.nextActionDate),
    notes: r.notes,
    source: r.source,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    interactions: (r.interactions ?? [])
      .slice()
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .map(toInteractionDTO),
  };
}
