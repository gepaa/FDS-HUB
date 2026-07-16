import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import { PanelPlaceholder } from "@/components/shell/PanelPlaceholder";

export const metadata: Metadata = { title: "Accounting" };

export default function AccountingPage() {
  return (
    <PanelPlaceholder
      icon={Wallet}
      title="Accounting"
      description="Founders-only financial console built for clean tax export."
      stage={2}
      features={[
        "Running P&L — month and YTD: revenue, COGS, gross profit, ad spend, blended CAC, net",
        "Per-product margin table sourced from CRM suppliers",
        "Tax-category tagging on every transaction",
        "“Export the Year” — a workbook your accountant accepts",
        "Ad-spend + CAC tracker (manual entry first, ad platforms later)",
        "Founder-role access gate: non-founder sessions cannot query financial data",
      ]}
      humanSupplies={[
        "A decision: double-entry-style records (per-order COGS/margin) or a simpler income/expense ledger to start",
        "One accountant review of the tax-category logic — the app never gives tax advice",
      ]}
    />
  );
}
