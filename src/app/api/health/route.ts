import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** GET /api/health — DB reachability + record counts. */
export async function GET() {
  try {
    const [records, interactions] = await Promise.all([
      prisma.crmRecord.count(),
      prisma.interaction.count(),
    ]);
    return Response.json({ ok: true, records, interactions });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}
