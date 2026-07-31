import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { toRecordDTO } from "@/lib/serialize";
import { SupplierOutcomeWorkspace } from "@/components/supplier-outreach/SupplierOutcomeWorkspace";

export const metadata: Metadata = { title: "Approved Suppliers" };
export const dynamic = "force-dynamic";

export default async function ApprovedSuppliersPage() {
  const approved = await prisma.crmRecord.findMany({
    where: { type: "supplier", status: "AUTHORIZED" },
    include: { interactions: true, supplierOwner: true },
    orderBy: { name: "asc" },
  });

  return (
    <SupplierOutcomeWorkspace
      kind="closed"
      records={approved.map(toRecordDTO)}
      authorizedCount={approved.length}
    />
  );
}
