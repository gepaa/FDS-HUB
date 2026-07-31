import type { Metadata } from "next";
import { SupplierOutreachDetail } from "@/components/supplier-outreach/SupplierOutreachDetail";
import { prisma } from "@/lib/prisma";
import { toTeamProfileDTO } from "@/lib/serialize";

export const metadata: Metadata = { title: "New Supplier" };
export const dynamic = "force-dynamic";

export default async function NewSupplierPage() {
  const [profiles, clusters] = await Promise.all([
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

  return (
    <SupplierOutreachDetail
      initialRecord={null}
      profiles={profiles.map(toTeamProfileDTO)}
      clusterOptions={clusters.map((item) => item.cluster)}
    />
  );
}
