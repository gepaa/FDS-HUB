"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Volume2, VolumeX } from "lucide-react";
import { SegmentedControl } from "@/components/kit/SegmentedControl";
import { useSound } from "@/hooks/useSound";
import { Button } from "@/components/kit/Button";

/** Theme + sound preferences (client-side, persisted). */
export function PreferenceControls() {
  const { resolvedTheme, setTheme } = useTheme();
  const { muted, toggleMuted, sound } = useSound();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return <div className="shimmer h-20 rounded-card" aria-hidden />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink">Appearance</p>
          <p className="text-xs text-muted">
            Dark is the default operator theme.
          </p>
        </div>
        <SegmentedControl
          ariaLabel="Theme"
          segments={[
            { id: "dark", label: "Dark", icon: Moon },
            { id: "light", label: "Light", icon: Sun },
          ]}
          value={resolvedTheme ?? "dark"}
          onChange={(id) => setTheme(id)}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink">UI sounds</p>
          <p className="text-xs text-muted">
            Synthesized glass-and-water feedback. No audio files, fully
            client-side.
          </p>
        </div>
        <Button variant="ghost" size="sm" silent onClick={toggleMuted}>
          {muted ? (
            <>
              <VolumeX size={14} aria-hidden /> Muted
            </>
          ) : (
            <>
              <Volume2 size={14} aria-hidden /> On
            </>
          )}
        </Button>
      </div>

      {!muted ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-2 text-xs text-muted">Preview:</p>
          {(["tap", "toggle", "success", "whoosh", "drop", "pop"] as const).map(
            (name) => (
              <Button
                key={name}
                variant="subtle"
                size="sm"
                silent
                onClick={() => sound(name)}
              >
                {name}
              </Button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
