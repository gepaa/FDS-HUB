import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * /crm is retired — suppliers live in /supplier-outreach and buyers in
 * /leads. This route stays as a redirect because links to it are spread
 * across the dashboard, approvals, the cockpit, and the attention feed.
 *
 * When the URL names a record we look up its type and send the user to
 * the right surface, so an old `/crm?record=<id>` link still lands on
 * that exact record instead of dumping them on a list.
 */
export default async function LegacyCrmPage({
  searchParams,
}: {
  searchParams: Promise<{ record?: string; supplier?: string; new?: string }>;
}) {
  const sp = await searchParams;
  const recordId = sp.record ?? sp.supplier;

  if (recordId) {
    const record = await prisma.crmRecord.findUnique({
      where: { id: recordId },
      select: { type: true },
    });
    if (record?.type === "lead") redirect(`/leads?record=${recordId}`);
    if (record) redirect(`/supplier-outreach/${recordId}`);
  }

  // `?new=1` came from the "add a supplier" quick action.
  if (sp.new === "1") redirect("/supplier-outreach/new");

  redirect("/supplier-outreach");
}
