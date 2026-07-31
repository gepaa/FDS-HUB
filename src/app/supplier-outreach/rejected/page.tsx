import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { toRecordDTO } from "@/lib/serialize";
import { SupplierOutcomeWorkspace } from "@/components/supplier-outreach/SupplierOutcomeWorkspace";

export const metadata: Metadata = { title: "Rejected Suppliers" };
export const dynamic = "force-dynamic";

export default async function RejectedSuppliersPage() {
  const rejected = await prisma.crmRecord.findMany({
    where: { type: "supplier", status: "DECLINED" },
    include: { interactions: true, supplierOwner: true },
    orderBy: { name: "asc" },
  });

  return (
    <SupplierOutcomeWorkspace
      kind="rejected"
      records={rejected.map(toRecordDTO)}
    />
  );
}
