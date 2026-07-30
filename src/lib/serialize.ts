import type {
  RecordDTO,
  InteractionDTO,
  StageId,
  InteractionType,
  RecordType,
  Owner,
  Priority,
  Actor,
  SupplierContactDTO,
  TeamProfileDTO,
} from "@/lib/domain";
import type {
  CrmRecord,
  Interaction,
  TeamMember,
} from "@/generated/prisma/client";

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

const jsonList = (s: string): string[] => {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};

const supplierContacts = (s: string): SupplierContactDTO[] => {
  try {
    const value = JSON.parse(s);
    if (!Array.isArray(value)) return [];
    return value
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        id: typeof item.id === "string" ? item.id : "",
        name: typeof item.name === "string" ? item.name : "",
        role: typeof item.role === "string" ? item.role : "",
        phone: typeof item.phone === "string" ? item.phone : "",
        email: typeof item.email === "string" ? item.email : "",
        notes: typeof item.notes === "string" ? item.notes : "",
        isPrimary: item.isPrimary === true,
      }))
      .filter((item) => item.id && item.name);
  } catch {
    return [];
  }
};

export function toTeamProfileDTO(member: TeamMember): TeamProfileDTO {
  return {
    id: member.id,
    name: member.name,
    initials: member.initials,
    color: member.color,
    sortOrder: member.sortOrder,
    active: member.active,
    discordUserId: member.discordUserId,
  };
}

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
  r: CrmRecord & {
    interactions?: Interaction[];
    supplierOwner?: TeamMember | null;
  },
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
    supplierOwnerId: r.supplierOwnerId,
    supplierOwner: r.supplierOwner ? toTeamProfileDTO(r.supplierOwner) : null,
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
    dealerApplicationSigned: r.dealerApplicationSigned,
    initialEmailSent: r.initialEmailSent,
    supplierContacts: supplierContacts(r.supplierContacts),
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
