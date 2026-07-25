import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";

export const dynamic = "force-dynamic";

const accountInput = z.object({
  name: z.string().trim().min(1).max(200),
  platform: z.string().trim().min(1).max(80).default("Google Ads"),
  externalId: z.string().trim().max(120).nullable().optional(),
  currency: z.string().trim().min(1).max(8).default("USD"),
  balance: z.number().finite().min(0).default(0),
  dailyBudget: z.number().finite().min(0).default(0),
  thresholdDays: z.number().int().min(1).max(90).default(3),
  notes: z.string().trim().max(2000).nullable().optional(),
});

/** GET /api/ad-accounts — every account, newest first. */
export async function GET(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  const accounts = await prisma.adAccount.findMany({
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
  return Response.json(accounts);
}

/**
 * POST /api/ad-accounts — add an account. The opening balance is
 * recorded as the first ledger entry so the statement is complete from
 * day one.
 */
export async function POST(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;

  const body = await request.json().catch(() => null);
  const parsed = accountInput.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const created = await prisma.adAccount.create({
    data: {
      name: d.name,
      platform: d.platform,
      externalId: d.externalId?.trim() || null,
      currency: d.currency,
      balance: d.balance,
      dailyBudget: d.dailyBudget,
      thresholdDays: d.thresholdDays,
      notes: d.notes?.trim() || null,
      ledger:
        d.balance > 0
          ? {
              create: {
                kind: "deposit",
                delta: d.balance,
                balanceAfter: d.balance,
                note: "Opening balance",
              },
            }
          : undefined,
    },
  });
  return Response.json(created, { status: 201 });
}
