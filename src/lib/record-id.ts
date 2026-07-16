import { prisma } from "@/lib/prisma";
import type { RecordType } from "@/lib/domain";

/** Allocate the next human record ID: FDS-SUP-#### / FDS-LEAD-####. */
export async function nextRecordId(type: RecordType): Promise<string> {
  const prefix = type === "lead" ? "FDS-LEAD-" : "FDS-SUP-";
  const last = await prisma.crmRecord.findFirst({
    where: { recordId: { startsWith: prefix } },
    orderBy: { recordId: "desc" },
    select: { recordId: true },
  });
  const n = last?.recordId
    ? parseInt(last.recordId.slice(prefix.length), 10) + 1
    : 1;
  return `${prefix}${String(n).padStart(4, "0")}`;
}
