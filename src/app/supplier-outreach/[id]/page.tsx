import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SupplierOutreachDetail } from "@/components/supplier-outreach/SupplierOutreachDetail";
import { prisma } from "@/lib/prisma";
import { toRecordDTO, toTeamProfileDTO } from "@/lib/serialize";

export const metadata: Metadata = { title: "Supplier Record" };
export const dynamic = "force-dynamic";

export default async function SupplierRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const back =
    from === "closed"
      ? {
          href: "/supplier-outreach/closed",
          label: "Approved suppliers",
        }
      : from === "rejected"
        ? {
            href: "/supplier-outreach/rejected",
            label: "Rejected suppliers",
          }
        : {
            href: "/supplier-outreach",
            label: "Supplier Outreach",
          };
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
      backHref={back.href}
      backLabel={back.label}
    />
  );
}
