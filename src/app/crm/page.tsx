import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { toRecordDTO } from "@/lib/serialize";
import { CrmWorkspace } from "@/components/crm/CrmWorkspace";

export const metadata: Metadata = { title: "CRM" };
export const dynamic = "force-dynamic";

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ record?: string; supplier?: string; new?: string }>;
}) {
  const sp = await searchParams;
  const records = await prisma.crmRecord.findMany({
    include: { interactions: true },
    orderBy: { name: "asc" },
  });

  return (
    <CrmWorkspace
      initial={records.map(toRecordDTO)}
      initialRecordId={sp.record ?? sp.supplier}
      initialCreate={sp.new === "1"}
    />
  );
}
