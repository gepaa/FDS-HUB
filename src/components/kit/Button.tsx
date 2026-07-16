"use client";

import { cn } from "@/lib/utils";
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
    "bg-[var(--accent)] text-[var(--accent-fg)] border border-transparent shadow-sm hover:brightness-105",
  ghost:
    "border border-hairline bg-[var(--panel)] text-ink shadow-sm hover:border-[var(--hairline-strong)] hover:bg-[var(--panel-soft)]",
  danger:
    "bg-[var(--red-soft)] text-danger border border-transparent hover:brightness-110",
  subtle:
    "text-muted hover:text-ink hover:bg-[var(--panel-soft)] border border-transparent",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
};

export function Button({
  variant = "ghost",
  size = "md",
  silent = false,
  className,
  children,
  onClick,
  disabled,
  ...rest
}: ButtonProps) {
  const { sound } = useSound();

  return (
    <button
      className={cn(
        "press relative inline-flex items-center justify-center rounded-control font-medium",
        "disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      disabled={disabled}
      onClick={(e) => {
        if (!silent) sound("tap");
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
