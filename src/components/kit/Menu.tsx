"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useSound } from "@/hooks/useSound";

interface MenuProps {
  /** Accessible name for the trigger. */
  label: string;
  trigger: React.ReactNode;
  triggerClassName?: string;
  /** Menu body. Call `close()` from an item's handler. */
  children: (close: () => void) => React.ReactNode;
}

const PANEL_WIDTH = 216;
const GAP = 6;

/**
 * Small dropdown menu.
 *
 * Portalled to <body> with fixed positioning on purpose: the kanban
 * columns scroll (`overflow-y-auto`), so an in-flow popover would be
 * clipped by the column it lives in. Pointer events on the trigger are
 * stopped so a menu inside a draggable card or a clickable table row
 * doesn't also start a drag or open the drawer.
 */
export function Menu({ label, trigger, triggerClassName, children }: MenuProps) {
  const { sound } = useSound();
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const close = useCallback(() => setOpen(false), []);

  const place = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const height = panelRef.current?.offsetHeight ?? 0;
    const below = r.bottom + GAP;
    const flip = height > 0 && below + height > window.innerHeight - 8;
    setPos({
      top: flip ? Math.max(8, r.top - GAP - height) : below,
      left: Math.min(
        Math.max(8, r.right - PANEL_WIDTH),
        Math.max(8, window.innerWidth - PANEL_WIDTH - 8),
      ),
    });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    // Any scroll or resize invalidates the fixed position — close rather
    // than leave the menu floating away from its row.
    const dismiss = () => setOpen(false);
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          sound("tap");
          setOpen((v) => !v);
        }}
        className={cn(
          "press inline-flex h-7 w-7 items-center justify-center rounded-control text-muted hover:bg-[var(--panel-soft)] hover:text-ink",
          open && "bg-[var(--panel-soft)] text-ink",
          triggerClassName,
        )}
      >
        {trigger}
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              role="menu"
              aria-label={label}
              style={{
                top: pos?.top ?? -9999,
                left: pos?.left ?? -9999,
                width: PANEL_WIDTH,
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="surface-raised fixed z-[70] flex flex-col gap-0.5 rounded-card p-1.5 shadow-xl"
            >
              {children(close)}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

interface MenuItemProps {
  icon?: React.ComponentType<{ size?: number | string; "aria-hidden"?: boolean }>;
  children: React.ReactNode;
  onSelect: () => void;
  tone?: "default" | "danger";
}

export function MenuItem({ icon: Icon, children, onSelect, tone = "default" }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={cn(
        "press flex w-full items-center gap-2 rounded-control px-2.5 py-1.5 text-left text-[13px] font-medium",
        tone === "danger"
          ? "text-danger hover:bg-[var(--red-soft)]"
          : "text-ink hover:bg-[var(--panel-soft)]",
      )}
    >
      {Icon ? <Icon size={13} aria-hidden /> : null}
      {children}
    </button>
  );
}
