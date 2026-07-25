import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { notifyChannelReady } from "@/lib/notify";
import {
  AdBudgetWorkspace,
  type AdAccountDTO,
} from "@/components/ad-budget/AdBudgetWorkspace";

export const metadata: Metadata = { title: "Ad Budget Watch" };
export const dynamic = "force-dynamic";

export default async function AdBudgetPage() {
  const accounts = await prisma.adAccount.findMany({
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      ledger: { orderBy: { occurredAt: "desc" }, take: 8 },
    },
  });

  const dtos: AdAccountDTO[] = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    platform: a.platform,
    externalId: a.externalId,
    currency: a.currency,
    balance: a.balance,
    dailyBudget: a.dailyBudget,
    thresholdDays: a.thresholdDays,
    active: a.active,
    notes: a.notes,
    ledger: a.ledger.map((e) => ({
      id: e.id,
      kind: e.kind,
      delta: e.delta,
      balanceAfter: e.balanceAfter,
      note: e.note,
      occurredAt: e.occurredAt.toISOString(),
    })),
  }));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl text-ink">Ad Budget Watch</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Keep money on every ad account so the card never declines. Log what
          you add, track what&apos;s left, and get a reminder pushed to your
          phone before the runway runs out.
        </p>
      </header>
      <AdBudgetWorkspace initial={dtos} channelReady={notifyChannelReady()} />
    </div>
  );
}
