import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";

export const dynamic = "force-dynamic";

const clutchInput = z.object({
  title: z.string().trim().min(1).max(300),
  notes: z.string().trim().max(4000).nullable().optional(),
  // yyyy-mm-dd (from <input type="date">) or a full ISO string.
  date: z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), {
    message: "Invalid date",
  }),
});

/** GET /api/clutches — the full clutch log, oldest → newest so the
 *  timeline reads left/top-to-bottom from the origin forward. */
export async function GET(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  const clutches = await prisma.clutch.findMany({
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    take: 1000,
  });
  return Response.json(clutches);
}

/** POST /api/clutches — log a clutch onto the timeline. */
export async function POST(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;

  const body = await request.json().catch(() => null);
  const parsed = clutchInput.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  const created = await prisma.clutch.create({
    data: {
      title: parsed.data.title,
      notes: parsed.data.notes?.trim() || null,
      date: new Date(parsed.data.date),
    },
  });
  return Response.json(created, { status: 201 });
}
