"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A horizontally scrolling region with a scrollbar that is ALWAYS
 * visible.
 *
 * Native overlay scrollbars (macOS "Show scroll bars: When scrolling")
 * fade out and reserve no layout space, so on a wide rail like the CRM
 * stage board there is no signal that more content exists off-screen.
 * CSS `::-webkit-scrollbar` can't fix that reliably — the OS setting
 * wins. So the native bar is hidden and this draws its own: a real
 * track + draggable thumb, plus click-to-page and edge fades.
 *
 * The inner element is still a normal scroll container, so wheel,
 * trackpad, keyboard, and drag-to-scroll all behave natively.
 */
export function ScrollRail({
  className,
  innerClassName,
  children,
}: {
  /** Classes for the outer wrapper. */
  className?: string;
  /** Classes for the scrolling element (layout of the content row). */
  innerClassName?: string;
  children: React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startScroll: number } | null>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState({
    ratio: 1,
    scrollLeft: 0,
    maxScroll: 0,
    scrollable: false,
  });

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollWidth, clientWidth, scrollLeft } = el;
    const scrollable = scrollWidth > clientWidth + 1;
    setMetrics({
      ratio: scrollable ? clientWidth / scrollWidth : 1,
      scrollLeft,
      maxScroll: Math.max(scrollWidth - clientWidth, 0),
      scrollable,
    });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, [measure]);

  // Thumb dragging — translate pointer movement into scrollLeft.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = scrollRef.current;
      const track = trackRef.current;
      if (!dragRef.current || !el || !track) return;
      const dx = e.clientX - dragRef.current.startX;
      // The thumb only travels (track - thumb) pixels to cover the full
      // scroll range, so map pointer movement across that distance.
      const travelPx = track.clientWidth - (thumbRef.current?.clientWidth ?? 0);
      if (travelPx <= 0) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      el.scrollLeft = dragRef.current.startScroll + (dx / travelPx) * maxScroll;
    };
    const onUp = () => {
      dragRef.current = null;
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const pageBy = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  /** Clicking the bare track jumps the thumb to that point. Bound via
   *  a callback ref so it attaches the instant the track mounts — the
   *  track only renders once content is known to overflow, so a plain
   *  effect would run before the node exists. */
  const attachTrack = useCallback((track: HTMLDivElement | null) => {
    trackRef.current = track;
    if (!track) return;
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement)?.dataset?.thumb) return; // thumb drags
      const el = scrollRef.current;
      const thumb = thumbRef.current;
      if (!el || !thumb) return;
      const rect = track.getBoundingClientRect();
      const travelPx = rect.width - thumb.clientWidth;
      if (travelPx <= 0) return;
      // Center the thumb on the click, then clamp into range.
      const target = e.clientX - rect.left - thumb.clientWidth / 2;
      const pct = Math.min(Math.max(target / travelPx, 0), 1);
      el.scrollTo({
        left: pct * (el.scrollWidth - el.clientWidth),
        behavior: "smooth",
      });
    };
    track.addEventListener("pointerdown", onDown);
    return () => track.removeEventListener("pointerdown", onDown);
  }, []);

  // Thumb geometry in TRACK space. The thumb has a floor width so it
  // never becomes an unclickable dot, which means its travel is
  // (100 - thumbPct) — scale scroll progress across exactly that, or
  // the thumb and the content drift apart on very wide boards.
  const thumbPct = Math.max(metrics.ratio * 100, 6);
  const progress = metrics.maxScroll > 0 ? metrics.scrollLeft / metrics.maxScroll : 0;
  const leftPct = progress * (100 - thumbPct);

  return (
    <div className={cn("relative flex flex-col", className)}>
      <div
        ref={scrollRef}
        className={cn("hide-native-scrollbar overflow-x-auto", innerClassName)}
      >
        {children}
      </div>

      {/* Edge fades: a second cue that content continues off-screen. */}
      {metrics.scrollable ? (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 bottom-4 left-0 w-8 bg-gradient-to-r from-[var(--bg0)] to-transparent transition-opacity"
            style={{ opacity: metrics.scrollLeft > 4 ? 0.7 : 0 }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 right-0 bottom-4 w-8 bg-gradient-to-l from-[var(--bg0)] to-transparent transition-opacity"
            style={{
              opacity: metrics.scrollLeft < metrics.maxScroll - 4 ? 0.7 : 0,
            }}
          />
        </>
      ) : null}

      {/* The always-on scrollbar. Sticky so it stays reachable at the
          bottom of the viewport even when the page itself is scrolled
          such that the rail's natural bottom edge is off-screen. */}
      {metrics.scrollable ? (
        <div
          ref={attachTrack}
          className="surface-muted sticky bottom-3 z-10 mt-2 h-3 w-full cursor-pointer rounded-full"
        >
          <div
            ref={thumbRef}
            data-thumb="1"
            role="scrollbar"
            aria-controls="scroll-rail-content"
            aria-orientation="horizontal"
            aria-valuenow={Math.round(leftPct)}
            tabIndex={0}
            className="absolute top-0 h-3 rounded-full bg-[var(--hairline-strong)] transition-colors hover:bg-[var(--accent)] active:bg-[var(--accent)]"
            style={{ width: `${thumbPct}%`, left: `${leftPct}%` }}
            onPointerDown={(e) => {
              e.preventDefault();
              // Stop dnd-kit's PointerSensor (which listens on an
              // ancestor) from reading this as the start of a card drag.
              e.stopPropagation();
              const el = scrollRef.current;
              if (!el) return;
              dragRef.current = { startX: e.clientX, startScroll: el.scrollLeft };
              document.body.style.userSelect = "none";
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") pageBy(1);
              if (e.key === "ArrowLeft") pageBy(-1);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
