import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { toRecordDTO, toTeamProfileDTO } from "@/lib/serialize";
import { SupplierOutreachWorkspace } from "@/components/supplier-outreach/SupplierOutreachWorkspace";

export const metadata: Metadata = { title: "Supplier Outreach" };
export const dynamic = "force-dynamic";

export default async function SupplierOutreachPage({
  searchParams,
}: {
  searchParams: Promise<{ record?: string; new?: string }>;
}) {
  const sp = await searchParams;
  const [suppliers, profiles] = await Promise.all([
    prisma.crmRecord.findMany({
      where: { type: "supplier" },
      include: { interactions: true, supplierOwner: true },
      orderBy: { name: "asc" },
    }),
    prisma.teamMember.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <SupplierOutreachWorkspace
      initial={suppliers.map(toRecordDTO)}
      profiles={profiles.map(toTeamProfileDTO)}
      initialRecordId={sp.record}
      initialCreate={sp.new === "1"}
    />
  );
}
