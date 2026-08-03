import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { toRecordDTO } from "@/lib/serialize";
import { shopifyConfigured } from "@/lib/shopify";
import { LeadsWorkspace } from "@/components/leads/LeadsWorkspace";

export const metadata: Metadata = { title: "Leads CRM" };
export const dynamic = "force-dynamic";

/**
 * The Leads CRM — buyers only. Suppliers live in /supplier-outreach and
 * are never loaded here, so the two sides stay genuinely separate even
 * though they share one physical table (CrmRecord.type).
 */
export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ record?: string }>;
}) {
  const sp = await searchParams;
  const records = await prisma.crmRecord.findMany({
    where: { type: "lead" },
    include: { interactions: true, supplierOwner: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <LeadsWorkspace
      initial={records.map(toRecordDTO)}
      shopifyConnected={shopifyConfigured()}
      initialRecordId={sp.record}
    />
  );
}
