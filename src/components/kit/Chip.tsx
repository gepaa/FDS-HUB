"use client";

import { cn } from "@/lib/utils";
import { useSound } from "@/hooks/useSound";

interface ChipProps {
  label: string;
  active?: boolean;
  /** Optional identity dot (e.g. cluster or stage color). */
  dot?: string;
  count?: number;
  onClick?: () => void;
  className?: string;
}

/** Filter chip — rounded, quiet, accent-tinted when active. */
export function Chip({ label, active, dot, count, onClick, className }: ChipProps) {
  const { sound } = useSound();
  return (
    <button
      type="button"
      onClick={() => {
        sound("tap");
        onClick?.();
      }}
      aria-pressed={active}
      className={cn(
        "press inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium",
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-ink"
          : "surface-muted text-muted hover:text-ink hover:border-[var(--hairline-strong)]",
        className,
      )}
    >
      {dot ? (
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: dot }}
        />
      ) : null}
      {label}
      {typeof count === "number" ? (
        <span className="num text-[10px] text-muted">{count}</span>
      ) : null}
    </button>
  );
}
