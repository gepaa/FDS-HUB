import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { toE164, displayPhone } from "@/lib/quo/phone";
import { nextRecordId } from "@/lib/record-id";
import type { CrmRecord } from "@/generated/prisma/client";

/**
 * Deciding which lead a call belongs to.
 *
 * Order (§7), strictest first:
 *   1. exact normalised E.164 match on an existing record
 *   2. an existing CRM ⇄ Quo contact mapping
 *   3. create a minimal lead (inbound only)
 *
 * There is deliberately no "last N digits" fallback. On this CRM a bad
 * match doesn't just misfile an activity — it shows one customer's
 * recording and transcript on another customer's record. An unmatched
 * call is a much cheaper failure than a wrongly matched one, so
 * anything we can't match exactly is either given a fresh lead (inbound,
 * where we know a real person rang) or left unattached for review.
 */

export type MatchMethod =
  | "e164"
  | "contact_link"
  | "created"
  | "unmatched";

export interface MatchResult {
  record: CrmRecord | null;
  method: MatchMethod;
  /** True when this call brought a brand-new lead into existence. */
  created: boolean;
}

export interface MatchInput {
  /** The customer's number, as supplied by Quo (already E.164). */
  externalNumber: string | null;
  direction: string | null;
  /** Quo contact ids from the webhook's context.contacts.ids. */
  quoContactIds?: string[];
  /** When the call happened — used as the new lead's first contact. */
  occurredAt?: Date;
}

export async function matchLead(input: MatchInput): Promise<MatchResult> {
  const region = env.QUO_DEFAULT_REGION;
  const e164 = toE164(input.externalNumber, region);

  // 1. Exact normalised match. Oldest wins, so repeat callers always
  //    land on the same record even if a duplicate slipped in.
  if (e164) {
    const byPhone = await prisma.crmRecord.findFirst({
      where: { phoneE164: e164 },
      orderBy: { createdAt: "asc" },
    });
    if (byPhone) return { record: byPhone, method: "e164", created: false };
  }

  // 2. A contact we have previously synced to Quo.
  const contactIds = (input.quoContactIds ?? []).filter(Boolean);
  if (contactIds.length > 0) {
    const link = await prisma.quoContactLink.findFirst({
      where: { quoContactId: { in: contactIds } },
      include: { record: true },
    });
    if (link?.record) {
      // Backfill the normalised number so the fast path works next time.
      if (e164 && !link.record.phoneE164) {
        await prisma.crmRecord.update({
          where: { id: link.record.id },
          data: { phoneE164: e164 },
        });
      }
      return { record: link.record, method: "contact_link", created: false };
    }
  }

  // 3. Inbound calls from a stranger become a lead. Outbound calls do
  //    not: if we rang a number that isn't in the CRM, that is worth a
  //    human's attention, not an auto-created record.
  if (input.direction === "incoming" && e164) {
    const record = await createInboundLead(e164, input);
    return { record, method: "created", created: true };
  }

  return { record: null, method: "unmatched", created: false };
}

/**
 * Create the minimal lead an unknown inbound caller deserves: a phone
 * number, a source, and a flag saying a human still needs to fill it in.
 *
 * Duplicate protection is belt and braces. The find-or-create runs in a
 * transaction, and afterwards we re-check: if a concurrent call created
 * a second lead for the same number, the older one wins and the row we
 * just made (which is empty by definition) is removed. That keeps the
 * promise that one unknown caller produces exactly one lead, even when
 * somebody rings twice in the same second.
 */
async function createInboundLead(
  e164: string,
  input: MatchInput,
): Promise<CrmRecord> {
  const occurredAt = input.occurredAt ?? new Date();

  const created = await prisma.$transaction(async (tx) => {
    const existing = await tx.crmRecord.findFirst({
      where: { phoneE164: e164 },
      orderBy: { createdAt: "asc" },
    });
    if (existing) return existing;

    return tx.crmRecord.create({
      data: {
        recordId: await nextRecordId("lead"),
        type: "lead",
        // No name yet — showing the number is more honest than
        // inventing "Unknown Caller" as if it were a person.
        name: displayPhone(e164, env.QUO_DEFAULT_REGION) || e164,
        phone: displayPhone(e164, env.QUO_DEFAULT_REGION) || e164,
        phoneE164: e164,
        status: "NEW",
        owner: "unassigned",
        source: "Inbound Quo Call",
        needsEnrichment: true,
        lastContactDate: occurredAt,
      },
    });
  });

  // Collapse a concurrent duplicate, if one appeared.
  const all = await prisma.crmRecord.findMany({
    where: { phoneE164: e164 },
    orderBy: { createdAt: "asc" },
  });
  if (all.length > 1) {
    const oldest = all[0];
    if (oldest.id !== created.id) {
      const stillEmpty =
        created.needsEnrichment &&
        !created.company &&
        !created.email &&
        !created.notes;
      if (stillEmpty) {
        // Safe to remove: nothing has been written to it yet. Any
        // activity is attached after matching returns.
        await prisma.crmRecord
          .delete({ where: { id: created.id } })
          .catch(() => undefined);
      }
      return oldest;
    }
  }

  return created;
}

/**
 * Keep `phoneE164` in step with whatever a human typed into `phone`.
 * Called on record writes so matching never depends on someone
 * remembering to enter a number in international format.
 */
export function normalisedPhoneFor(
  phone: string | null | undefined,
): string | null {
  return toE164(phone, env.QUO_DEFAULT_REGION);
}

/**
 * One-off/maintenance: fill in phoneE164 for records that predate the
 * integration. Safe to run repeatedly.
 */
export async function backfillNormalisedNumbers(): Promise<{
  scanned: number;
  updated: number;
}> {
  const rows = await prisma.crmRecord.findMany({
    where: { phoneE164: null, phone: { not: null } },
    select: { id: true, phone: true },
  });
  let updated = 0;
  for (const row of rows) {
    const e164 = normalisedPhoneFor(row.phone);
    if (!e164) continue;
    await prisma.crmRecord.update({
      where: { id: row.id },
      data: { phoneE164: e164 },
    });
    updated += 1;
  }
  return { scanned: rows.length, updated };
}
