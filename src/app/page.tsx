import Link from "next/link";
import {
  CalendarDays,
  CheckSquare,
  Clock,
  MessagesSquare,
  Plug,
  ShoppingBag,
  Users,
  Wallet,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getIntegrations } from "@/lib/integrations";
import { needsFollowUp, SUPPLIER_STAGES as STAGES } from "@/lib/domain";
import { shortDate } from "@/lib/utils";
import { StatTile } from "@/components/kit/StatTile";
import { StatusPill } from "@/components/kit/StatusPill";
import { PanelCard } from "@/components/dashboard/PanelCard";
import { PipelineBar } from "@/components/dashboard/PipelineBar";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const suppliers = await prisma.crmRecord.findMany({
    where: { type: "supplier" },
    orderBy: { name: "asc" },
  });
  const integrations = getIntegrations();

  const stageCounts: Record<string, number> = {};
  for (const st of STAGES) stageCounts[st.id] = 0;
  for (const s of suppliers) {
    stageCounts[s.status] = (stageCounts[s.status] ?? 0) + 1;
  }

  const followUps = suppliers
    .filter((s) =>
      needsFollowUp({ nextActionDate: s.nextActionDate, status: s.status }),
    )
    .sort(
      (a, b) =>
        (a.nextActionDate?.getTime() ?? 0) - (b.nextActionDate?.getTime() ?? 0),
    );

  const goldCount = suppliers.filter((s) => s.rank === "Gold").length;
  const contacted = stageCounts["CONTACTED"] ?? 0;
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
          Command Hub
        </h1>
        <p className="mt-1.5 max-w-xl text-sm text-muted">
          The whole operation on one glass surface — supplier pipeline live
          now; accounting, Shopify, tasks, comms, and calendar light up in the
          next stages.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          label="Suppliers"
          value={suppliers.length}
          sub={`${goldCount} Gold-rank targets`}
          icon={Users}
          tone="accent"
        />
        <StatTile
          label="Needs follow-up"
          value={followUps.length}
          sub="due today or overdue"
          icon={Clock}
          tone={followUps.length > 0 ? "amber" : "default"}
        />
        <StatTile
          label="Contacted"
          value={contacted}
          sub="outreach in flight"
          icon={MessagesSquare}
        />
        <StatTile
          label="Integrations"
          value={`${integrations.filter((i) => i.connected).length}/${integrations.length}`}
          sub="services connected"
          icon={Plug}
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

        <PanelCard href="/crm" icon={Clock} title="Follow-ups due">
          {followUps.length === 0 ? (
            <p className="text-sm text-muted">
              Nothing due. Set next-action dates in the CRM and they surface
              here.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {followUps.slice(0, 5).map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/crm?supplier=${s.id}`}
                    className="press flex items-center gap-2 rounded-control px-2 py-1.5 hover:bg-[var(--panel-soft)]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {s.name}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {s.nextAction ?? "Follow up"}
                      </span>
                    </span>
                    <span className="num shrink-0 text-xs font-medium text-amber">
                      {shortDate(s.nextActionDate)}
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

        <PanelCard
          href="/accounting"
          icon={Wallet}
          title="Accounting"
          aside={<StatusPill status="planned" label="Stage 2" />}
        >
          <p className="text-sm leading-relaxed text-muted">
            Founders-only P&L, per-product margins, CAC, and one-click tax
            export. No numbers shown until the ledger exists — this panel never
            fakes data.
          </p>
        </PanelCard>

        <PanelCard
          href="/shopify"
          icon={ShoppingBag}
          title="Shopify"
          aside={
            <StatusPill
              status={
                integrations.find((i) => i.id === "shopify")?.connected
                  ? "connected"
                  : "disconnected"
              }
              label={
                integrations.find((i) => i.id === "shopify")?.connected
                  ? "Connected"
                  : "Not connected"
              }
            />
          }
        >
          <p className="text-sm leading-relaxed text-muted">
            Orders, sales, AOV, and customer creation — live from the Admin
            API the moment the store token is dropped in.
          </p>
        </PanelCard>

        <PanelCard
          href="/tasks"
          icon={CheckSquare}
          title="Tasks"
          aside={<StatusPill status="planned" label="Stage 4" />}
        >
          <p className="text-sm leading-relaxed text-muted">
            To-dos linked to suppliers and orders, with today / overdue /
            upcoming smart views and quick-add from the command bar.
          </p>
        </PanelCard>

        <PanelCard
          href="/comms"
          icon={MessagesSquare}
          title="Comms"
          aside={<StatusPill status="planned" label="Stage 4" />}
        >
          <p className="text-sm leading-relaxed text-muted">
            One inbox for Discord, Gmail, and Shopify Inbox — every message
            tagged by source and linkable to a supplier.
          </p>
        </PanelCard>

        <PanelCard
          href="/calendar"
          icon={CalendarDays}
          title="Calendar"
          aside={<StatusPill status="planned" label="Stage 5" />}
        >
          <p className="text-sm leading-relaxed text-muted">
            Today&apos;s agenda from Google Calendar, plus one-tap events from
            supplier follow-ups.
          </p>
        </PanelCard>

        <PanelCard href="/integrations" icon={Plug} title="Connection health">
          <ul className="flex flex-wrap gap-2">
            {integrations.map((i) => (
              <li key={i.id}>
                <StatusPill
                  status={i.connected ? "connected" : "disconnected"}
                  pulse={i.connected}
                  label={i.name}
                />
              </li>
            ))}
          </ul>
        </PanelCard>
      </div>
    </div>
  );
}
