import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { PanelPlaceholder } from "@/components/shell/PanelPlaceholder";

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarPage() {
  return (
    <PanelPlaceholder
      icon={CalendarDays}
      title="Calendar"
      description="Google Calendar, embedded in the hub."
      stage={5}
      features={[
        "Embedded calendar view with read + create",
        "Today’s agenda surfaced on the dashboard",
        "One-tap events from tasks and supplier follow-ups (callback → calendar event)",
      ]}
      humanSupplies={[
        "Google Cloud OAuth client with Calendar scopes",
        "A decision: read-only or full read/write",
      ]}
    />
  );
}
