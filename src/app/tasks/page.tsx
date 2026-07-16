import type { Metadata } from "next";
import { CheckSquare } from "lucide-react";
import { PanelPlaceholder } from "@/components/shell/PanelPlaceholder";

export const metadata: Metadata = { title: "Tasks" };

export default function TasksPage() {
  return (
    <PanelPlaceholder
      icon={CheckSquare}
      title="Tasks"
      description="To-dos wired into the rest of the hub."
      stage={4}
      features={[
        "Lists + tasks with notes, due dates, and priority",
        "Tasks attach to a supplier or order",
        "Board and list views with today / overdue / upcoming smart views",
        "Quick-add from the global command bar",
        "Reminders surfaced on the dashboard",
      ]}
    />
  );
}
