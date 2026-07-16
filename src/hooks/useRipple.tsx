"use client";

import { useCallback } from "react";

/**
 * Water-droplet click ripple. Attach the returned handler to
 * onPointerDown of a `position: relative; overflow: hidden` element.
 */
export function useRipple() {
  return useCallback((e: React.PointerEvent<HTMLElement>) => {
    const host = e.currentTarget;
    const rect = host.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const ink = document.createElement("span");
    ink.className = "ripple-ink";
    ink.style.width = ink.style.height = `${size}px`;
    ink.style.left = `${e.clientX - rect.left - size / 2}px`;
    ink.style.top = `${e.clientY - rect.top - size / 2}px`;
    host.appendChild(ink);
    window.setTimeout(() => ink.remove(), 700);
  }, []);
}
