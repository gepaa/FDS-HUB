"use client";

import { cn } from "@/lib/utils";
import { useRipple } from "@/hooks/useRipple";
import { useSound } from "@/hooks/useSound";

type Variant = "primary" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Suppress the click sound (e.g. when the action plays its own). */
  silent?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "text-white border border-transparent shadow-[0_4px_16px_var(--accent-soft)] hover:brightness-110",
  ghost:
    "glass-soft text-ink hover:bg-[var(--panel-strong)] hover:border-[var(--hairline-strong)]",
  danger:
    "bg-[var(--red-soft)] text-danger border border-[var(--red-soft)] hover:brightness-110",
  subtle: "text-muted hover:text-ink hover:bg-[var(--panel-soft)] border border-transparent",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
};

export function Button({
  variant = "ghost",
  size = "md",
  silent = false,
  className,
  children,
  onClick,
  onPointerDown,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const ripple = useRipple();
  const { sound } = useSound();

  return (
    <button
      className={cn(
        "press relative inline-flex items-center justify-center overflow-hidden rounded-control font-medium",
        "disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      style={
        variant === "primary"
          ? {
              background:
                "linear-gradient(180deg, var(--accent-bright), var(--accent))",
              ...style,
            }
          : style
      }
      disabled={disabled}
      onClick={(e) => {
        if (!silent) sound("tap");
        onClick?.(e);
      }}
      onPointerDown={(e) => {
        if (!disabled) ripple(e);
        onPointerDown?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
