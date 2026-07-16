import type { Metadata } from "next";
import { MessagesSquare } from "lucide-react";
import { getIntegrations } from "@/lib/integrations";
import { PanelPlaceholder } from "@/components/shell/PanelPlaceholder";
import { StatusPill } from "@/components/kit/StatusPill";
import { GlassPanel } from "@/components/kit/GlassPanel";

export const metadata: Metadata = { title: "Comms" };

export default function CommsPage() {
  const integrations = getIntegrations().filter((i) =>
    ["discord", "gmail"].includes(i.id),
  );

  return (
    <PanelPlaceholder
      icon={MessagesSquare}
      title="Comms"
      description="One unified inbox across every channel the business talks on."
      stage={4}
      features={[
        "Discord: post to and read from designated channels via bot + webhook",
        "Gmail: read threads, draft and send from the store domain, log replies against CRM suppliers",
        "Shopify Inbox: customer conversations surfaced or deep-linked",
        "Unified inbox — every message tagged by source channel",
      ]}
      humanSupplies={[
        "Discord application + bot token + channel IDs + webhook URL",
        "Google Cloud OAuth client with Gmail scopes",
      ]}
    >
      <GlassPanel className="p-5">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
          Channel status
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {integrations.map((i) => (
            <li key={i.id}>
              <StatusPill
                status={i.connected ? "connected" : "disconnected"}
                label={`${i.name}: ${i.connected ? "connected" : "not connected"}`}
              />
            </li>
          ))}
        </ul>
      </GlassPanel>
    </PanelPlaceholder>
  );
}
