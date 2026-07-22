import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { emptyCockpitData, type CallNote, type CockpitData } from "@/lib/cockpit";
import {
  CockpitScreen,
  type CockpitInteractionDTO,
  type CockpitRecordDTO,
  type SupplierOptionDTO,
} from "@/components/cockpit/CockpitScreen";

export const metadata: Metadata = { title: "Call Cockpit" };
export const dynamic = "force-dynamic";

/**
 * The live call screen. Starting the page starts (or resumes) the
 * record's open CallSession — a closed tab never loses call state.
 */
export default async function CockpitPage({
  params,
}: {
  params: Promise<{ recordId: string }>;
}) {
  const { recordId } = await params;
  const record = await prisma.crmRecord.findFirst({
    where: { OR: [{ id: recordId }, { recordId }] },
    include: { interactions: { orderBy: { date: "desc" }, take: 12 } },
  });
  if (!record) notFound();

  let session = await prisma.callSession.findFirst({
    where: { recordId: record.id, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (!session) {
    session = await prisma.callSession.create({
      data: {
        recordId: record.id,
        data: JSON.stringify(
          emptyCockpitData({
            productInterest: record.productInterest,
            warranty: record.warranty,
            leadTime: record.leadTime,
            quoteAmount: record.quoteAmount,
          }),
        ),
      },
    });
  }

  const suppliers: SupplierOptionDTO[] = (
    await prisma.crmRecord.findMany({
      where: { type: "supplier" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, mainContact: true, phone: true },
      take: 300,
    })
  ).map((s) => ({ ...s }));

  const dto: CockpitRecordDTO = {
    id: record.id,
    recordId: record.recordId,
    type: record.type,
    name: record.name,
    company: record.company,
    status: record.status,
    priority: record.priority as CockpitRecordDTO["priority"],
    email: record.email,
    phone: record.phone,
    productInterest: record.productInterest,
    quoteAmount: record.quoteAmount,
    contextSummary: record.contextSummary,
    nextAction: record.nextAction,
  };
  const interactions: CockpitInteractionDTO[] = record.interactions.map((i) => ({
    id: i.id,
    date: i.date.toISOString(),
    type: i.type,
    actor: i.actor,
    body: i.body,
  }));

  let data: CockpitData;
  let notes: CallNote[];
  try {
    data = { ...emptyCockpitData(), ...(JSON.parse(session.data) as CockpitData) };
  } catch {
    data = emptyCockpitData();
  }
  try {
    notes = JSON.parse(session.notes) as CallNote[];
  } catch {
    notes = [];
  }

  return (
    <CockpitScreen
      record={dto}
      interactions={interactions}
      suppliers={suppliers}
      sessionId={session.id}
      startedAt={session.startedAt.toISOString()}
      initialData={data}
      initialNotes={notes}
    />
  );
}
