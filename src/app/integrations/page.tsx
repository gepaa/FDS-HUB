import type { Metadata } from "next";
import {
  Bot,
  CalendarDays,
  Database,
  Mail,
  MessageCircle,
  Plug,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";
import { getIntegrations } from "@/lib/integrations";
import { ConnectState } from "@/components/kit/ConnectState";
import { GlassPanel } from "@/components/kit/GlassPanel";
import { StatusPill } from "@/components/kit/StatusPill";

export const metadata: Metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

const icons: Record<string, LucideIcon> = {
  database: Database,
  shopify: ShoppingBag,
  discord: MessageCircle,
  gmail: Mail,
  calendar: CalendarDays,
  agents: Bot,
};

export default function IntegrationsPage() {
  const integrations = getIntegrations();
  const connected = integrations.filter((i) => i.connected);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-card bg-[var(--accent-soft)] text-accent-bright">
          <Plug size={20} aria-hidden />
        </span>
        <div>
          <h1 className="font-display text-3xl text-ink">
            Integrations
          </h1>
          <p className="text-sm text-muted">
            Every external service, its connection state, and exactly what it
            needs. Keys live in the environment — never in the client, never in
            git.
          </p>
        </div>
        <StatusPill
          className="ml-auto"
          status={connected.length > 0 ? "connected" : "disconnected"}
          pulse={connected.length > 0}
          label={`${connected.length} of ${integrations.length} connected`}
        />
      </header>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {integrations.map((i) =>
          i.connected ? (
            <GlassPanel key={i.id} className="p-8">
              <div className="flex items-start justify-between gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-card bg-[var(--accent-soft)] text-accent-bright">
                  {(() => {
                    const Icon = icons[i.id] ?? Plug;
                    return <Icon size={22} aria-hidden />;
                  })()}
                </span>
                <StatusPill status="connected" pulse label="Connected" />
              </div>
              <h3 className="mt-4 text-lg font-semibold tracking-tight text-ink">
                {i.name}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {i.description}
              </p>
            </GlassPanel>
          ) : (
            <ConnectState
              key={i.id}
              icon={icons[i.id] ?? Plug}
              name={i.name}
              description={i.description}
              requiredEnv={i.requiredEnv}
              setupUrl={i.setupUrl}
              stage={i.stage}
            />
          ),
        )}
      </div>
    </div>
  );
}
