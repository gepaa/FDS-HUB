import Link from "next/link";
import {
  Clock,
  ListChecks,
  MessagesSquare,
  Moon,
  ShieldCheck,
  Users,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  needsFollowUp,
  SUPPLIER_STAGES,
  STAGE_MAP,
} from "@/lib/domain";
import { shortDate } from "@/lib/utils";
import { StatTile } from "@/components/kit/StatTile";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { PipelineBar } from "@/components/dashboard/PipelineBar";
import { GlassPanel } from "@/components/kit/GlassPanel";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [records, pendingApprovals, runningTasks, latestBrief] =
    await Promise.all([
      prisma.crmRecord.findMany({ orderBy: { name: "asc" } }),
      prisma.approval.findMany({
        where: { status: "pending" },
        orderBy: { createdAt: "asc" },
        take: 10,
        include: { record: { select: { name: true } } },
      }),
      prisma.hqTask.findMany({
        where: { status: { in: ["queued", "running"] } },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.agentMessage.findFirst({
        where: { kind: "brief" },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  const suppliers = records.filter((r) => r.type === "supplier");
  const leads = records.filter((r) => r.type === "lead");

  const stageCounts: Record<string, number> = {};
  for (const st of SUPPLIER_STAGES) stageCounts[st.id] = 0;
  for (const s of suppliers)
    stageCounts[s.status] = (stageCounts[s.status] ?? 0) + 1;

  const followUps = records
    .filter((r) =>
      needsFollowUp({ nextActionDate: r.nextActionDate, status: r.status }),
    )
    .sort(
      (a, b) =>
        (a.nextActionDate?.getTime() ?? 0) - (b.nextActionDate?.getTime() ?? 0),
    );

  const yourMoves = records
    .filter((r) => r.owner === "you" && r.nextAction)
    .slice(0, 5);

  const awaitingYou = pendingApprovals.length + yourMoves.length;
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="text-xs font-medium tracking-widest text-muted uppercase">
          {today}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">
          Operations HQ
        </h1>
        <p className="mt-1.5 max-w-xl text-sm text-muted">
          Claude runs everything around the sale — you approve the outbound
          and close the deals.
        </p>
      </header>

      {latestBrief ? (
        <GlassPanel className="border-l-2 border-[var(--accent)] px-5 py-4">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-widest text-accent-bright uppercase">
            <Moon size={13} aria-hidden />
            {latestBrief.title ?? "Latest brief"} ·{" "}
            {shortDate(latestBrief.createdAt)}
          </p>
          <p className="mt-2 text-sm whitespace-pre-wrap text-ink">
            {latestBrief.body}
          </p>
        </GlassPanel>
      ) : (
        <GlassPanel className="px-5 py-4">
          <p className="text-sm text-muted">
            🌙 No PM run yet. Once the nightly run is live, the morning brief
            lands here: what was researched, drafted, and queued while you
            slept.
          </p>
        </GlassPanel>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          label="Suppliers in pipeline"
          value={suppliers.length}
          sub={`${stageCounts["CONTACTED"] ?? 0} contacted or waiting`}
          icon={Users}
          tone="accent"
        />
        <StatTile
          label="Active leads"
          value={leads.length}
          sub="inbound buyers"
          icon={MessagesSquare}
        />
        <StatTile
          label="Awaiting you"
          value={awaitingYou}
          sub={`${pendingApprovals.length} approvals · ${yourMoves.length} actions`}
          icon={ShieldCheck}
          tone={awaitingYou > 0 ? "amber" : "default"}
        />
        <StatTile
          label="Follow-ups due"
          value={followUps.length}
          sub="today or overdue"
          icon={Clock}
          tone={followUps.length > 0 ? "amber" : "default"}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <PanelCard
          href="/crm"
          icon={Users}
          title="Supplier pipeline"
          className="lg:col-span-2"
          glow="green"
        >
          <PipelineBar counts={stageCounts} />
        </PanelCard>

        <PanelCard href="/approvals" icon={ShieldCheck} title="What needs you">
          {pendingApprovals.length === 0 && yourMoves.length === 0 ? (
            <p className="text-sm text-muted">
              Nothing. When the agent drafts outbound work or a record needs
              your move, it shows up here.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {pendingApprovals.slice(0, 4).map((a) => (
                <li key={a.id} className="flex items-center gap-2 text-sm">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#c2410c]" />
                  <span className="min-w-0 flex-1 truncate text-ink">
                    {a.title}
                  </span>
                  <span className="shrink-0 text-[10px] font-bold tracking-wide text-muted uppercase">
                    approve
                  </span>
                </li>
              ))}
              {yourMoves.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/crm?record=${r.id}`}
                    className="flex items-center gap-2 text-sm hover:underline"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--amber)]" />
                    <span className="min-w-0 flex-1 truncate text-ink">
                      {r.name}: {r.nextAction}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>

        <PanelCard href="/tasks" icon={ListChecks} title="Task queue">
          {runningTasks.length === 0 ? (
            <p className="text-sm text-muted">
              Queue is empty. Assign work in plain language and the PM runs it
              on its next cycle.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {runningTasks.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  <span
                    className={
                      "h-1.5 w-1.5 shrink-0 rounded-full " +
                      (t.status === "running"
                        ? "bg-[var(--accent-bright)]"
                        : "bg-[var(--hairline-strong)]")
                    }
                  />
                  <span className="min-w-0 flex-1 truncate text-ink">
                    {t.title}
                  </span>
                  <span className="shrink-0 text-[10px] font-bold tracking-wide text-muted uppercase">
                    {t.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>

        <PanelCard
          href="/crm"
          icon={Clock}
          title="Follow-ups due"
          className="lg:col-span-2"
        >
          {followUps.length === 0 ? (
            <p className="text-sm text-muted">
              Nothing due. Records with a next-action date surface here when
              it arrives.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {followUps.slice(0, 5).map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/crm?record=${r.id}`}
                    className="press flex items-center gap-2 rounded-control px-2 py-1.5 hover:bg-[var(--panel-soft)]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {r.name}
                        <span className="ml-2 text-xs font-normal text-muted">
                          {STAGE_MAP[r.status]?.label ?? r.status}
                        </span>
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {r.nextAction ?? "Follow up"}
                      </span>
                    </span>
                    <span className="num shrink-0 text-xs font-medium text-amber">
                      {shortDate(r.nextActionDate)}
                    </span>
                  </Link>
                </li>
              ))}
              {followUps.length > 5 ? (
                <li className="px-2 pt-1 text-xs text-muted">
                  +{followUps.length - 5} more in the CRM
                </li>
              ) : null}
            </ul>
          )}
        </PanelCard>
      </div>
    </div>
  );
}
