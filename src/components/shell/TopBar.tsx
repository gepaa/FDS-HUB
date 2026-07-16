"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Plus, Search, Sun, Volume2, VolumeX } from "lucide-react";
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
  const isDark = mounted && resolvedTheme === "dark";

  const connectedCount = integrations.filter((i) => i.connected).length;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-hairline bg-[color-mix(in_srgb,var(--bg0)_88%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 md:px-8">
          <button
            type="button"
            onClick={() => {
              sound("tap");
              setPaletteOpen(true);
            }}
            className="press flex h-9 flex-1 items-center gap-2 rounded-control border border-hairline bg-[var(--panel)] px-3 text-sm text-muted shadow-sm hover:border-[var(--hairline-strong)] hover:text-ink md:max-w-sm"
          >
            <Search size={15} aria-hidden />
            <span className="truncate">Search suppliers, panels, actions…</span>
            <kbd className="ml-auto hidden rounded-md border border-hairline bg-[var(--panel-soft)] px-1.5 py-0.5 font-mono text-[10px] md:block">
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
              {muted ? (
                <VolumeX size={16} aria-hidden />
              ) : (
                <Volume2 size={16} aria-hidden />
              )}
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
        </div>
      </header>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
}
