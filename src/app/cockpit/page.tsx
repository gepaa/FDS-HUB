import type { Metadata } from "next";
import Link from "next/link";
import { Phone, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StageBadge, PriorityBadge } from "@/components/crm/badges";
import { shortDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Call Cockpit" };
export const dynamic = "force-dynamic";

/** Pick who you're calling — leads with due follow-ups float to the top. */
export default async function CockpitPickerPage() {
  const now = new Date();
  const [due, leads, suppliers] = await Promise.all([
    prisma.crmRecord.findMany({
      where: { nextActionDate: { lte: now } },
      orderBy: { nextActionDate: "asc" },
      take: 12,
    }),
    prisma.crmRecord.findMany({
      where: { type: "lead", status: { notIn: ["WON", "LOST"] } },
      orderBy: { updatedAt: "desc" },
      take: 15,
    }),
    prisma.crmRecord.findMany({
      where: {
        type: "supplier",
        status: { in: ["REPLIED", "IN_CONVERSATION", "CALL_SCHEDULED", "NEGOTIATING"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 15,
    }),
  ]);

  const Row = ({ r }: { r: (typeof due)[number] }) => (
    <Link
      href={`/cockpit/${r.id}`}
      className="surface press group flex items-center gap-3 rounded-card px-4 py-3 hover:border-[var(--hairline-strong)]"
    >
      <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-accent-bright">
        <Phone size={15} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {r.name}
          {r.recordId ? <span className="num ml-2 text-xs font-normal text-muted">{r.recordId}</span> : null}
        </p>
        <p className="truncate text-xs text-muted">
          {r.nextAction ?? r.productInterest ?? r.contextSummary ?? "—"}
          {r.nextActionDate ? ` · due ${shortDate(r.nextActionDate.toISOString())}` : ""}
        </p>
      </div>
      <StageBadge stage={r.status} />
      <PriorityBadge priority={r.priority as "hot" | "warm" | "cold" | null} />
      <ChevronRight size={15} className="shrink-0 text-muted group-hover:text-ink" aria-hidden />
    </Link>
  );

  const section = (title: string, rows: typeof due) => (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold tracking-widest text-muted uppercase">
        {title} ({rows.length})
      </h2>
      {rows.length === 0 ? (
        <p className="text-xs text-muted">Nothing here.</p>
      ) : (
        rows.map((r) => <Row key={r.id} r={r} />)
      )}
    </section>
  );

  const dueIds = new Set(due.map((r) => r.id));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl text-ink">Call Cockpit</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Pick who you&apos;re about to call. The cockpit opens full-screen with
          everything for the conversation — live, verified, one screen.
        </p>
      </header>
      {section("Due & overdue", due)}
      {section("Active leads", leads.filter((r) => !dueIds.has(r.id)))}
      {section("Suppliers in play", suppliers.filter((r) => !dueIds.has(r.id)))}
    </div>
  );
}
