import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  ApprovalCard,
  type ApprovalDTO,
} from "@/components/approvals/ApprovalCard";
import { GlassPanel } from "@/components/kit/GlassPanel";

export const metadata: Metadata = { title: "Approvals" };
export const dynamic = "force-dynamic";

function toDTO(a: {
  id: string;
  kind: string;
  title: string;
  recordId: string | null;
  record: { name: string; recordId: string | null; type: string } | null;
  draftSubject: string | null;
  draftBody: string;
  reasoning: string | null;
  status: string;
  createdAt: Date;
  decidedAt: Date | null;
  decisionNote: string | null;
}): ApprovalDTO {
  return {
    ...a,
    createdAt: a.createdAt.toISOString(),
    decidedAt: a.decidedAt ? a.decidedAt.toISOString() : null,
  };
}

export default async function ApprovalsPage() {
  const select = {
    id: true,
    kind: true,
    title: true,
    recordId: true,
    record: { select: { name: true, recordId: true, type: true } },
    draftSubject: true,
    draftBody: true,
    reasoning: true,
    status: true,
    createdAt: true,
    decidedAt: true,
    decisionNote: true,
  } as const;

  const [pending, decided] = await Promise.all([
    prisma.approval.findMany({
      where: { status: "pending" },
      select,
      orderBy: { createdAt: "asc" },
    }),
    prisma.approval.findMany({
      where: { status: { not: "pending" } },
      select,
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Approvals
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          🔒 The gate. Everything Claude wants to send leaves through here —
          research, drafting, and CRM updates happen autonomously, but nothing
          outbound fires without your tap. Autonomy is at{" "}
          <b>notch 0 (draft-only)</b>.
        </p>
      </header>

      {pending.length === 0 ? (
        <GlassPanel className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <ShieldCheck size={28} aria-hidden className="text-accent-bright" />
          <p className="text-sm font-medium text-ink">Nothing waiting on you</p>
          <p className="max-w-md text-xs text-muted">
            When the agent drafts an outbound email, a product publish, a
            price, or a discount, it lands here for your one-tap decision.
          </p>
        </GlassPanel>
      ) : (
        <div className="flex flex-col gap-3">
          {pending.map((a) => (
            <ApprovalCard key={a.id} approval={toDTO(a)} />
          ))}
        </div>
      )}

      {decided.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-widest text-muted uppercase">
            Recently decided
          </h2>
          {decided.map((a) => (
            <ApprovalCard key={a.id} approval={toDTO(a)} />
          ))}
        </section>
      ) : null}
    </div>
  );
}
