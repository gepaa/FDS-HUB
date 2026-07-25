import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";

export const dynamic = "force-dynamic";

const ledgerInput = z.object({
  // deposit: a top-up (amount is how much you added, always positive)
  // adjustment: reconcile to the real platform balance (signed delta,
  //   or pass `setBalance` to snap to an absolute number)
  kind: z.enum(["deposit", "adjustment"]),
  amount: z.number().finite().optional(), // deposit amount OR signed adjustment
  setBalance: z.number().finite().min(0).optional(), // adjustment: absolute target
  note: z.string().trim().max(500).nullable().optional(),
  occurredAt: z
    .string()
    .refine((v) => !Number.isNaN(new Date(v).getTime()), {
      message: "Invalid date",
    })
    .optional(),
});

/** GET /api/ad-accounts/[id]/ledger — the account statement. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  const { id } = await params;
  const entries = await prisma.adLedgerEntry.findMany({
    where: { accountId: id },
    orderBy: { occurredAt: "desc" },
    take: 200,
  });
  return Response.json(entries);
}

/**
 * POST /api/ad-accounts/[id]/ledger — move money.
 *
 * Deposits and adjustments both land here and update the account's
 * running balance in one transaction, so `AdAccount.balance` and the
 * ledger can never drift. This is the ONLY write path for balance.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  const { id } = await params;

  const account = await prisma.adAccount.findUnique({ where: { id } });
  if (!account) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = ledgerInput.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  const { kind, amount, setBalance, note, occurredAt } = parsed.data;

  // Resolve the signed delta to apply.
  let delta: number;
  if (kind === "deposit") {
    if (amount === undefined || amount <= 0) {
      return Response.json(
        { error: "Deposit needs a positive amount" },
        { status: 400 },
      );
    }
    delta = amount;
  } else {
    // adjustment
    if (setBalance !== undefined) {
      delta = setBalance - account.balance;
    } else if (amount !== undefined) {
      delta = amount; // signed correction
    } else {
      return Response.json(
        { error: "Adjustment needs a signed amount or a target balance" },
        { status: 400 },
      );
    }
  }

  const balanceAfter = Math.round((account.balance + delta) * 100) / 100;
  if (balanceAfter < 0) {
    return Response.json(
      { error: "That would drive the balance negative" },
      { status: 400 },
    );
  }

  const [entry] = await prisma.$transaction([
    prisma.adLedgerEntry.create({
      data: {
        accountId: id,
        kind,
        delta: Math.round(delta * 100) / 100,
        balanceAfter,
        note: note?.trim() || null,
        ...(occurredAt ? { occurredAt: new Date(occurredAt) } : {}),
      },
    }),
    prisma.adAccount.update({
      where: { id },
      data: { balance: balanceAfter },
    }),
  ]);

  return Response.json(entry, { status: 201 });
}
