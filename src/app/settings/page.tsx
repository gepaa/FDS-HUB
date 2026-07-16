import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { GlassPanel } from "@/components/kit/GlassPanel";
import { StatusPill } from "@/components/kit/StatusPill";
import { PreferenceControls } from "@/components/settings/PreferenceControls";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [supplierCount, interactionCount] = await Promise.all([
    prisma.crmRecord.count(),
    prisma.interaction.count(),
  ]);
  const isSqlite = env.DATABASE_URL.startsWith("file:");

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-card bg-[var(--accent-soft)] text-accent-bright">
          <Settings size={20} aria-hidden />
        </span>
        <div>
          <h1 className="font-display text-3xl text-ink">
            Settings
          </h1>
          <p className="text-sm text-muted">Preferences and environment.</p>
        </div>
      </header>

      <GlassPanel className="p-6">
        <h2 className="mb-4 text-sm font-semibold tracking-wide text-muted uppercase">
          Preferences
        </h2>
        <PreferenceControls />
      </GlassPanel>

      <GlassPanel className="p-6">
        <h2 className="mb-4 text-sm font-semibold tracking-wide text-muted uppercase">
          Database
        </h2>
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted">Engine</span>
            <StatusPill
              status="connected"
              label={isSqlite ? "SQLite — local dev" : "Postgres"}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted">Suppliers</span>
            <span className="num font-medium text-ink">{supplierCount}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted">Logged interactions</span>
            <span className="num font-medium text-ink">{interactionCount}</span>
          </div>
          {isSqlite ? (
            <p className="mt-2 rounded-card bg-[var(--amber-soft)] px-3 py-2 text-xs leading-relaxed text-amber">
              Running on the zero-setup local database. For production, set
              DATABASE_URL to a Neon/Vercel Postgres connection string and flip
              the provider in prisma/schema.prisma — full steps in the README.
            </p>
          ) : null}
          <p className="text-xs text-muted">
            Re-seed the CRM from data/suppliers.csv any time with{" "}
            <code className="surface-muted rounded px-1.5 py-0.5 font-mono text-[11px]">
              npm run db:seed
            </code>
            .
          </p>
        </div>
      </GlassPanel>
    </div>
  );
}
