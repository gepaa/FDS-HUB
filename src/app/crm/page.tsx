import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ALL_STAGE_IDS } from "@/lib/domain";
import { toRecordDTO, toTeamProfileDTO } from "@/lib/serialize";
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
  const [records, profiles] = await Promise.all([
    prisma.crmRecord.findMany({
      include: { interactions: true, supplierOwner: true },
      orderBy: { name: "asc" },
    }),
    prisma.teamMember.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  // Only honour a stage the ladder actually knows about — the param is
  // user-editable and feeds a filter, not a query.
  const initialStage =
    sp.stage && ALL_STAGE_IDS.includes(sp.stage) ? sp.stage : undefined;

  return (
    <CrmWorkspace
      initial={records.map(toRecordDTO)}
      profiles={profiles.map(toTeamProfileDTO)}
      initialRecordId={sp.record ?? sp.supplier}
      initialCreate={sp.new === "1"}
      initialStage={initialStage}
    />
  );
}
