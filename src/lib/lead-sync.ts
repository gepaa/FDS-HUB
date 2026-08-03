import { prisma } from "@/lib/prisma";
import { getShopifyCustomers, shopifyConfigured } from "@/lib/shopify";
import { nextRecordId } from "@/lib/record-id";

/**
 * Shopify customers → Leads CRM.
 *
 * Shared by the manual "Sync Shopify" button and the daily cron, so both
 * behave identically.
 *
 * Matching is by Shopify customer ID (`linkedShopifyId`) first, then by
 * email, so a customer who already exists as a lead is UPDATED rather
 * than duplicated — re-running the sync is always safe.
 *
 * Existing leads are only ever enriched, never overwritten: we fill in
 * blanks (a missing phone, a missing email) but never clobber a stage,
 * next action, or note someone typed by hand. The sync must never undo
 * human work.
 */

export interface LeadSyncResult {
  checked: number;
  created: number;
  updated: number;
  skipped: number;
  configured: boolean;
}

export async function syncShopifyLeads(limit = 50): Promise<LeadSyncResult> {
  const empty: LeadSyncResult = {
    checked: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    configured: false,
  };
  if (!shopifyConfigured()) return empty;

  const customers = await getShopifyCustomers(limit);
  const result: LeadSyncResult = { ...empty, configured: true, checked: customers.length };

  for (const c of customers) {
    // A customer with neither email nor a usable name can't be worked
    // as a lead — skip rather than create an unactionable blank row.
    const name = c.name?.trim() || c.email?.trim() || c.phone?.trim();
    if (!name) {
      result.skipped += 1;
      continue;
    }

    const existing = await prisma.crmRecord.findFirst({
      where: {
        type: "lead",
        OR: [
          { linkedShopifyId: c.id },
          ...(c.email ? [{ email: c.email }] : []),
        ],
      },
    });

    const orders = c.ordersCount ?? 0;
    const summary = [
      c.location ? `Location: ${c.location}` : null,
      `${orders} order${orders === 1 ? "" : "s"}`,
      c.amountSpent ? `${c.amountSpent} spent` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    if (existing) {
      // Enrich only: fill blanks, never overwrite worked fields.
      const patch: Record<string, unknown> = {};
      if (!existing.linkedShopifyId) patch.linkedShopifyId = c.id;
      if (!existing.email && c.email) patch.email = c.email;
      if (!existing.phone && c.phone) patch.phone = c.phone;
      if (!existing.contextSummary && summary) patch.contextSummary = summary;
      if (!existing.source) patch.source = "Shopify";

      if (Object.keys(patch).length === 0) {
        result.skipped += 1;
        continue;
      }
      await prisma.crmRecord.update({ where: { id: existing.id }, data: patch });
      result.updated += 1;
      continue;
    }

    const recordId = await nextRecordId("lead");
    await prisma.crmRecord.create({
      data: {
        recordId,
        type: "lead",
        name,
        email: c.email ?? null,
        phone: c.phone ?? null,
        // Someone who already ordered is a customer, not a cold lead.
        status: orders > 0 ? "WON" : "NEW",
        owner: "unassigned",
        source: "Shopify",
        linkedShopifyId: c.id,
        contextSummary: summary || null,
        interactions: {
          create: {
            type: "system",
            actor: "system",
            body: `Imported from Shopify — ${summary || "customer record"}`,
          },
        },
      },
    });
    result.created += 1;
  }

  return result;
}
