import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SupplierOutreachDetail } from "@/components/supplier-outreach/SupplierOutreachDetail";
import { prisma } from "@/lib/prisma";
import { toRecordDTO, toTeamProfileDTO } from "@/lib/serialize";

export const metadata: Metadata = { title: "Supplier Record" };
export const dynamic = "force-dynamic";

export default async function SupplierRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [supplier, profiles, clusters] = await Promise.all([
    prisma.crmRecord.findFirst({
      where: { id, type: "supplier" },
      include: { interactions: true, supplierOwner: true },
    }),
    prisma.teamMember.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.crmRecord.findMany({
      where: { type: "supplier" },
      select: { cluster: true },
      distinct: ["cluster"],
      orderBy: { cluster: "asc" },
    }),
  ]);

  if (!supplier) notFound();

  return (
    <SupplierOutreachDetail
      initialRecord={toRecordDTO(supplier)}
      profiles={profiles.map(toTeamProfileDTO)}
      clusterOptions={clusters.map((item) => item.cluster)}
    />
  );
}
