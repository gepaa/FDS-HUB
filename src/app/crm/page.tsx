import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { toSupplierDTO } from "@/lib/serialize";
import { CrmWorkspace } from "@/components/crm/CrmWorkspace";

export const metadata: Metadata = { title: "CRM" };
export const dynamic = "force-dynamic";

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ supplier?: string; new?: string }>;
}) {
  const sp = await searchParams;
  const suppliers = await prisma.supplier.findMany({
    include: { interactions: true },
    orderBy: { name: "asc" },
  });

  return (
    <CrmWorkspace
      initial={suppliers.map(toSupplierDTO)}
      initialSupplierId={sp.supplier}
      initialCreate={sp.new === "1"}
    />
  );
}
