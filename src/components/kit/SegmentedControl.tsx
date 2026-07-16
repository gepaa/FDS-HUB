"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSound } from "@/hooks/useSound";

interface Segment {
  id: string;
  label: string;
  icon?: LucideIcon;
}

interface SegmentedControlProps {
  segments: Segment[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  /** Accessible name for the group. */
  ariaLabel: string;
}

/** iOS-style segmented control with a sliding glass thumb. */
export function SegmentedControl({
  segments,
  value,
  onChange,
  className,
  ariaLabel,
}: SegmentedControlProps) {
  const { sound } = useSound();
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "glass-soft inline-flex items-center gap-0.5 rounded-control p-0.5",
        className,
      )}
    >
      {segments.map((seg) => {
        const active = seg.id === value;
        const Icon = seg.icon;
        return (
          <button
            key={seg.id}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => {
              if (!active) {
                sound("toggle");
                onChange(seg.id);
              }
            }}
            className={cn(
              "relative inline-flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-xs font-medium transition-colors duration-200",
              active ? "text-ink" : "text-muted hover:text-ink",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${ariaLabel}`}
                className="absolute inset-0 rounded-[8px] bg-[var(--panel-strong)] shadow-sm"
                style={{ border: "1px solid var(--hairline)" }}
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {Icon ? <Icon size={14} aria-hidden /> : null}
              {seg.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
