import {
  CalendarDays,
  CheckSquare,
  LayoutDashboard,
  MessagesSquare,
  Plug,
  Settings,
  ShoppingBag,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Build stage that makes this panel live (undefined = live now). */
  stage?: number;
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    description: "The mega-hub home — live snapshot of every panel.",
  },
  {
    href: "/crm",
    label: "CRM",
    icon: Users,
    description: "Supplier pipeline, outreach log, and follow-ups.",
  },
  {
    href: "/accounting",
    label: "Accounting",
    icon: Wallet,
    stage: 2,
    description: "Founders-only P&L, margins, CAC, and tax export.",
  },
  {
    href: "/shopify",
    label: "Shopify",
    icon: ShoppingBag,
    stage: 3,
    description: "Live store analytics, orders, and customer management.",
  },
  {
    href: "/tasks",
    label: "Tasks",
    icon: CheckSquare,
    stage: 4,
    description: "To-dos linked to suppliers and orders.",
  },
  {
    href: "/comms",
    label: "Comms",
    icon: MessagesSquare,
    stage: 4,
    description: "Unified inbox: Discord, Gmail, Shopify Inbox.",
  },
  {
    href: "/calendar",
    label: "Calendar",
    icon: CalendarDays,
    stage: 5,
    description: "Google Calendar agenda and follow-up scheduling.",
  },
  {
    href: "/integrations",
    label: "Integrations",
    icon: Plug,
    description: "Connection health for every external service.",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    description: "Theme, sound, and environment.",
  },
];
