import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ALL_STAGE_IDS } from "@/lib/domain";
import { toRecordDTO } from "@/lib/serialize";
import { CrmWorkspace } from "@/components/crm/CrmWorkspace";

export const metadata: Metadata = { title: "CRM" };
export const dynamic = "force-dynamic";

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{
    record?: string;
    supplier?: string;
    new?: string;
    stage?: string;
  }>;
}) {
  const sp = await searchParams;
  const records = await prisma.crmRecord.findMany({
    include: { interactions: true },
    orderBy: { name: "asc" },
  });

  // Only honour a stage the ladder actually knows about — the param is
  // user-editable and feeds a filter, not a query.
  const initialStage =
    sp.stage && ALL_STAGE_IDS.includes(sp.stage) ? sp.stage : undefined;

  return (
    <CrmWorkspace
      initial={records.map(toRecordDTO)}
      initialRecordId={sp.record ?? sp.supplier}
      initialCreate={sp.new === "1"}
      initialStage={initialStage}
    />
  );
}
