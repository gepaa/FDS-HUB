"use client";

import { useCallback, useSyncExternalStore } from "react";
import { isMuted, play, setMuted, subscribeMuted, type SoundName } from "@/lib/sound";

/**
 * UI sound hook. `sound("tap")` plays a synthesized effect unless muted.
 * `muted` / `toggleMuted` drive the sound toggle in the command bar.
 */
export function useSound() {
  const muted = useSyncExternalStore(
    subscribeMuted,
    () => isMuted(),
    () => false,
  );

  const sound = useCallback((name: SoundName) => play(name), []);

  const toggleMuted = useCallback(() => {
    const next = !isMuted();
    setMuted(next);
    if (!next) play("toggle");
  }, []);

  return { sound, muted, toggleMuted };
}
