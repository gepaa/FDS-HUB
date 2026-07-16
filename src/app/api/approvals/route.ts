import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";

export const dynamic = "force-dynamic";

const approvalInput = z.object({
  kind: z.enum([
    "outbound_email",
    "publish_product",
    "price_quote",
    "discount",
    "other",
  ]),
  title: z.string().trim().min(1).max(300),
  recordId: z.string().nullable().optional(),
  draftSubject: z.string().nullable().optional(),
  draftBody: z.string().trim().min(1),
  reasoning: z.string().nullable().optional(),
});

/** GET /api/approvals?status=pending — list gate items. */
export async function GET(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const approvals = await prisma.approval.findMany({
    where: status ? { status } : undefined,
    include: { record: { select: { name: true, recordId: true, type: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return Response.json(approvals);
}

/** POST /api/approvals — the agent queues a gated action (D7: it can
 *  only ever DRAFT here; execution needs a human decision first). */
export async function POST(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;

  const body = await request.json().catch(() => null);
  const parsed = approvalInput.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  const created = await prisma.approval.create({
    data: { ...parsed.data, createdBy: actor, status: "pending" },
  });
  return Response.json(created, { status: 201 });
}
