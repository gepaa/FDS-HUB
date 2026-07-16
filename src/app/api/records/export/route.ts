import Papa from "papaparse";
import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";
import { EXPORT_HEADERS } from "@/lib/csv";

export const dynamic = "force-dynamic";

/** GET /api/records/export?type=supplier|lead — CSV download. */
export async function GET(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const records = await prisma.crmRecord.findMany({
    where: type === "supplier" || type === "lead" ? { type } : undefined,
    orderBy: { name: "asc" },
  });

  const rows = records.map((r) =>
    Object.fromEntries(
      EXPORT_HEADERS.map((h) => {
        const v = r[h as keyof typeof r];
        if (v instanceof Date) return [h, v.toISOString()];
        return [h, v ?? ""];
      }),
    ),
  );
  const csv = Papa.unparse(rows, { columns: [...EXPORT_HEADERS] });
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fds-crm-${type ?? "all"}-${stamp}.csv"`,
    },
  });
}
