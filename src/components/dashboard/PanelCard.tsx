import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { GlassPanel } from "@/components/kit/GlassPanel";

interface PanelCardProps {
  href: string;
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  /** Right side of the header (e.g. a StatusPill). */
  aside?: React.ReactNode;
  className?: string;
}

/** Dashboard widget card: header with drill-in. */
export function PanelCard({
  href,
  icon: Icon,
  title,
  aside,
  children,
  className,
}: PanelCardProps) {
  return (
    <GlassPanel className={className}>
      <div className="flex h-full flex-col p-5">
        <div className="mb-3 flex items-center gap-2">
          {/* The whole header is the hit area — a 28px chevron is not
              a real affordance on a card this size. */}
          <Link
            href={href}
            aria-label={`Open ${title}`}
            className="press group -mx-1.5 flex min-w-0 flex-1 items-center gap-2.5 rounded-control px-1.5 py-1 hover:bg-[var(--panel-soft)]"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-[var(--accent-soft)] text-accent-bright">
              <Icon size={16} aria-hidden />
            </span>
            <h2 className="truncate text-sm font-semibold tracking-tight text-ink">
              {title}
            </h2>
            <ChevronRight
              size={15}
              aria-hidden
              className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
            />
          </Link>
          {aside ? <span className="ml-auto shrink-0">{aside}</span> : null}
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </GlassPanel>
  );
}
