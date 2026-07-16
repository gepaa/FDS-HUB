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
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-control bg-[var(--accent-soft)] text-accent-bright">
            <Icon size={16} aria-hidden />
          </span>
          <h2 className="text-sm font-semibold tracking-tight text-ink">
            {title}
          </h2>
          <span className="ml-auto flex items-center gap-2">
            {aside}
            <Link
              href={href}
              aria-label={`Open ${title}`}
              className="press flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-[var(--panel-soft)] hover:text-ink"
            >
              <ChevronRight size={15} aria-hidden />
            </Link>
          </span>
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </GlassPanel>
  );
}
