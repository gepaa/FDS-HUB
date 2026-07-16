"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Moon,
  Plus,
  Search,
  Sun,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/kit/Button";
import { StatusPill } from "@/components/kit/StatusPill";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { useSound } from "@/hooks/useSound";
import type { IntegrationSummary } from "@/components/shell/AppShell";

/**
 * Top command bar: global search (⌘K), quick-add, connection status
 * cluster, sound + theme toggles.
 */
export function TopBar({ integrations }: { integrations: IntegrationSummary[] }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { sound, muted, toggleMuted } = useSound();
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  // next-themes resolves the real theme only on the client; render the
  // toggle theme-agnostically until mounted to avoid a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = !mounted || resolvedTheme === "dark";

  const connectedCount = integrations.filter((i) => i.connected).length;

  return (
    <>
      <header className="glass sticky top-3 z-30 flex items-center gap-2 rounded-panel px-3 py-2.5">
        <button
          type="button"
          onClick={() => {
            sound("tap");
            setPaletteOpen(true);
          }}
          className="press glass-soft flex h-9 flex-1 items-center gap-2 rounded-control px-3 text-sm text-muted hover:border-[var(--hairline-strong)] hover:text-ink md:max-w-md"
        >
          <Search size={15} aria-hidden />
          <span className="truncate">Search suppliers, panels, actions…</span>
          <kbd className="glass-soft ml-auto hidden rounded-md px-1.5 py-0.5 font-mono text-[10px] md:block">
            Ctrl K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              sound("tap");
              router.push("/integrations");
            }}
            className="press hidden lg:block"
            aria-label={`Integrations: ${connectedCount} of ${integrations.length} connected`}
          >
            <StatusPill
              status={connectedCount > 0 ? "connected" : "disconnected"}
              pulse={connectedCount > 0}
              label={`${connectedCount}/${integrations.length} connected`}
            />
          </button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => router.push("/crm?new=1")}
          >
            <Plus size={14} aria-hidden />
            <span className="hidden sm:inline">Supplier</span>
          </Button>

          <Button
            variant="subtle"
            size="sm"
            aria-label={muted ? "Unmute UI sounds" : "Mute UI sounds"}
            aria-pressed={!muted}
            silent
            onClick={toggleMuted}
          >
            {muted ? <VolumeX size={16} aria-hidden /> : <Volume2 size={16} aria-hidden />}
          </Button>

          <Button
            variant="subtle"
            size="sm"
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            silent
            suppressHydrationWarning
            onClick={() => {
              sound("toggle");
              setTheme(isDark ? "light" : "dark");
            }}
          >
            {isDark ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
          </Button>
        </div>
      </header>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
}
