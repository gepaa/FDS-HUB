import {
  BookOpen,
  CalendarDays,
  LayoutDashboard,
  ListChecks,
  MessagesSquare,
  Plug,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Users,
  Wallet,
  Inbox,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  /** Grouping in the rail: the five HQ surfaces, parked stages, utilities. */
  section: "hq" | "parked" | "utility";
  /** Show the live pending-approvals badge on this item. */
  approvalsBadge?: boolean;
}

/**
 * The five HQ surfaces (Blueprint §3 Layer 5 + Decisions D5), then the
 * parked collaborator stages (D6), then utilities.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    section: "hq",
    description: "Morning brief, KPIs, and what needs you.",
  },
  {
    href: "/crm",
    label: "CRM",
    icon: Users,
    section: "hq",
    description: "Supplier + lead pipelines — status, context, next action.",
  },
  {
    href: "/approvals",
    label: "Approvals",
    icon: ShieldCheck,
    section: "hq",
    approvalsBadge: true,
    description: "The gate — every outbound action waits here for one tap.",
  },
  {
    href: "/tasks",
    label: "Task Queue",
    icon: ListChecks,
    section: "hq",
    description: "Assign work in plain language; the PM runs it.",
  },
  {
    href: "/chat",
    label: "Chat",
    icon: MessagesSquare,
    section: "hq",
    description: "Briefs, pings, and run logs from the agent.",
  },
  {
    href: "/sops",
    label: "SOP Library",
    icon: BookOpen,
    section: "hq",
    description: "How Claude does everything — the playbooks.",
  },
  {
    href: "/shopify",
    label: "Shopify",
    icon: ShoppingBag,
    section: "hq",
    description: "Store analytics + dealer brands, wired to the CRM.",
  },
  // ---- Parked (D6): kept as placeholders, zero investment ----
  {
    href: "/accounting",
    label: "Accounting",
    icon: Wallet,
    section: "parked",
    description: "Founders-only P&L — parked.",
  },
  {
    href: "/comms",
    label: "Comms",
    icon: Inbox,
    section: "parked",
    description: "Unified inbox — parked.",
  },
  {
    href: "/calendar",
    label: "Calendar",
    icon: CalendarDays,
    section: "parked",
    description: "Google Calendar agenda — parked.",
  },
  // ---- Utilities ----
  {
    href: "/integrations",
    label: "Integrations",
    icon: Plug,
    section: "utility",
    description: "Connection health for every external service.",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    section: "utility",
    description: "Theme, sound, and environment.",
  },
];
