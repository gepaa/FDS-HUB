"use client";

import { cn } from "@/lib/utils";
import { useRipple } from "@/hooks/useRipple";
import { useSound } from "@/hooks/useSound";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Interactive cards lift on hover, ripple + tap-sound on click. */
  interactive?: boolean;
}

/** A glass card — the grid unit of every panel. */
export function GlassCard({
  interactive = false,
  className,
  children,
  onClick,
  onPointerDown,
  ...rest
}: GlassCardProps) {
  const ripple = useRipple();
  const { sound } = useSound();

  return (
    <div
      className={cn(
        "glass relative overflow-hidden rounded-card",
        interactive &&
          "press cursor-pointer hover:-translate-y-0.5 hover:border-[var(--hairline-strong)] hover:bg-[var(--panel-strong)]",
        className,
      )}
      onClick={
        onClick
          ? (e) => {
              sound("tap");
              onClick(e);
            }
          : undefined
      }
      onPointerDown={
        interactive
          ? (e) => {
              ripple(e);
              onPointerDown?.(e);
            }
          : onPointerDown
      }
      {...rest}
    >
      {children}
    </div>
  );
}
