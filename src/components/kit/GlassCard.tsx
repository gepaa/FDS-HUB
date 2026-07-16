"use client";

import { cn } from "@/lib/utils";
import { useSound } from "@/hooks/useSound";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Interactive cards lift on hover and play the tap sound on click. */
  interactive?: boolean;
}

/** A card — the grid unit of every panel. */
export function GlassCard({
  interactive = false,
  className,
  children,
  onClick,
  ...rest
}: GlassCardProps) {
  const { sound } = useSound();

  return (
    <div
      className={cn(
        "surface relative overflow-hidden rounded-card",
        interactive &&
          "press cursor-pointer hover:-translate-y-0.5 hover:border-[var(--hairline-strong)]",
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
      {...rest}
    >
      {children}
    </div>
  );
}
