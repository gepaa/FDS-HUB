import Link from "next/link";
import { Clock, ListChecks, MessagesSquare, ShieldCheck, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { needsFollowUp, SUPPLIER_STAGES } from "@/lib/domain";
import { buildAttention } from "@/lib/attention";
import { getIntegrations } from "@/lib/integrations";
import { env } from "@/lib/env";
import { shortDate } from "@/lib/utils";
import { StatTile } from "@/components/kit/StatTile";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { PipelineBar } from "@/components/dashboard/PipelineBar";
import { AttentionZone } from "@/components/dashboard/AttentionZone";
import { BriefCard } from "@/components/dashboard/BriefCard";
import {
  HealthStrip,
  type HealthEntry,
} from "@/components/dashboard/HealthStrip";

export const dynamic = "force-dynamic";

/** Stages where a supplier is actively being worked. */
const IN_FLIGHT = new Set([
  "CONTACTED",
  "REPLIED",
  "IN_CONVERSATION",
  "CALL_SCHEDULED",
  "NEGOTIATING",
]);

export default async function DashboardPage() {
  const [records, pendingApprovals, approvalCount, activeTasks, latestBrief] =
    await Promise.all([
      prisma.crmRecord.findMany({ orderBy: { name: "asc" } }),
      prisma.approval.findMany({
        where: { status: "pending" },
        orderBy: { createdAt: "asc" },
        take: 100,
      }),
      prisma.approval.count({ where: { status: "pending" } }),
      prisma.hqTask.findMany({
        where: { status: { in: ["queued", "running"] } },
        orderBy: { createdAt: "desc" },
        take: 25,
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

  const inFlight = suppliers.filter((s) => IN_FLIGHT.has(s.status)).length;

  const followUps = records.filter((r) =>
    needsFollowUp({ nextActionDate: r.nextActionDate, status: r.status }),
  );

  // Counted in full, not off a truncated page — the old tile summed a
  // `take: 10` against a `slice(0, 5)` and silently capped at 15.
  const yourMoves = records.filter((r) => r.owner === "you" && r.nextAction);
  const awaitingYou = approvalCount + yourMoves.length;

  const integrations = getIntegrations();
  const now = new Date();

  const attention = buildAttention({
    records,
    approvals: pendingApprovals,
    tasks: activeTasks,
    integrations,
    now,
  });

  // The database pill reports what we just proved: these queries
  // returned, so it is connected — regardless of which engine it is.
  const isLocalSqlite = env.DATABASE_URL.startsWith("file:");
  const health: HealthEntry[] = integrations.map((i) =>
    i.id === "database"
      ? {
          id: i.id,
          name: isLocalSqlite ? "Database (local)" : "Database",
          connected: true,
          verified: true,
          description: isLocalSqlite
            ? "Local SQLite — answered this page's queries."
            : "Postgres — answered this page's queries.",
          requiredEnv: i.requiredEnv,
          setupUrl: i.setupUrl,
        }
      : {
          id: i.id,
          name: i.name,
          connected: i.connected,
          // Everything else is credential-presence only; the strip
          // says so rather than implying a live handshake.
          verified: false,
          description: i.description,
          requiredEnv: i.requiredEnv,
          setupUrl: i.setupUrl,
        },
  );

  const today = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const queued = activeTasks.slice(0, 5);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-baseline gap-x-3">
        <h1 className="font-display text-2xl text-ink">Operations HQ</h1>
        <p className="text-xs font-medium tracking-widest text-muted uppercase">
          {today}
        </p>
      </header>

      {/* ---- Tier 1: needs attention now ---- */}
      <AttentionZone items={attention} />

      {/* ---- Tier 2: today / this week ---- */}
      {latestBrief ? (
        <BriefCard
          title={latestBrief.title ?? "Latest brief"}
          date={shortDate(latestBrief.createdAt)}
          body={latestBrief.body}
        />
      ) : null}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile
          label="Suppliers in pipeline"
          value={suppliers.length}
          sub={`${inFlight} being worked`}
          icon={Users}
          tone="accent"
          href="/crm"
        />
        <StatTile
          label="Active leads"
          value={leads.length}
          sub={leads.length === 0 ? "none yet" : "inbound buyers"}
          icon={MessagesSquare}
          href="/crm"
        />
        <StatTile
          label="Awaiting you"
          value={awaitingYou}
          sub={`${approvalCount} approvals · ${yourMoves.length} actions`}
          icon={ShieldCheck}
          tone={awaitingYou > 0 ? "amber" : "default"}
          href="/approvals"
        />
        <StatTile
          label="Follow-ups due"
          value={followUps.length}
          sub="today or overdue"
          icon={Clock}
          tone={followUps.length > 0 ? "amber" : "default"}
          href="/crm"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <PanelCard
          href="/crm"
          icon={Users}
          title="Supplier pipeline"
          className="lg:col-span-2"
        >
          <PipelineBar counts={stageCounts} />
        </PanelCard>

        <PanelCard href="/tasks" icon={ListChecks} title="Task queue">
          {queued.length === 0 ? (
            <p className="text-sm text-muted">
              Queue is empty. Assign work in plain language and the PM runs
              it on its next cycle.
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {queued.map((t) => (
                <li key={t.id}>
                  <Link
                    href="/tasks"
                    className="press flex items-center gap-2 rounded-control px-2 py-1.5 text-sm hover:bg-[var(--panel-soft)]"
                  >
                    <span
                      aria-hidden
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
                  </Link>
                </li>
              ))}
              {activeTasks.length > queued.length ? (
                <li className="px-2 pt-1 text-xs text-muted">
                  +{activeTasks.length - queued.length} more queued
                </li>
              ) : null}
            </ul>
          )}
        </PanelCard>
      </div>

      {/* ---- Tier 3: health ---- */}
      <HealthStrip entries={health} />
    </div>
  );
}
