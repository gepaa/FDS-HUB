"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Sprout } from "lucide-react";
import { NAV_ITEMS, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useSound } from "@/hooks/useSound";

/** Poll the pending-approvals count so the gate badge stays honest. */
function usePendingApprovals(): number {
  const [count, setCount] = useState(0);
  const pathname = usePathname();
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/approvals?status=pending")
        .then((r) => (r.ok ? r.json() : []))
        .then((data: unknown[]) => {
          if (alive) setCount(Array.isArray(data) ? data.length : 0);
        })
        .catch(() => {});
    void load();
    const t = window.setInterval(load, 60_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [pathname]);
  return count;
}

function RailLink({
  item,
  active,
  badge,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  badge: number;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "press relative flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium",
        active
          ? "text-ink"
          : "text-muted hover:bg-[var(--panel-soft)] hover:text-ink",
      )}
    >
      {active && (
        <motion.span
          layoutId="rail-active"
          className="absolute inset-0 rounded-control bg-[var(--rail-active)]"
          transition={{ type: "spring", stiffness: 480, damping: 40 }}
        />
      )}
      <Icon
        size={17}
        aria-hidden
        className={cn("relative z-10", active && "text-accent-bright")}
      />
      <span className="relative z-10">{item.label}</span>
      {item.approvalsBadge && badge > 0 ? (
        <span className="relative z-10 ml-auto rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent-fg)]">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * Persistent left sidebar (desktop) / bottom bar (mobile).
 * The five HQ surfaces first, parked stages below, utilities pinned
 * to the bottom. Active item carries a soft sliding highlight.
 */
export function LeftRail() {
  const pathname = usePathname();
  const { sound } = useSound();
  const pending = usePendingApprovals();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const hq = NAV_ITEMS.filter((i) => i.section === "hq");
  const parked = NAV_ITEMS.filter((i) => i.section === "parked");
  const utility = NAV_ITEMS.filter((i) => i.section === "utility");

  return (
    <>
      {/* desktop sidebar */}
      <nav
        aria-label="Primary"
        className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-hairline bg-[color-mix(in_srgb,var(--bg1)_62%,transparent)] backdrop-blur-2xl backdrop-saturate-150 md:flex"
      >
        <div className="flex h-full flex-col px-3 pt-5 pb-4">
          <Link
            href="/"
            className="mb-6 flex items-center gap-2.5 px-2"
            onClick={() => sound("tap")}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[var(--accent)] text-[var(--accent-fg)]">
              <Sprout size={17} aria-hidden />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold tracking-tight text-ink">
                FDS Operations HQ
              </span>
              <span className="block text-[10px] tracking-wide text-muted uppercase">
                Farmer Direct Supply
              </span>
            </span>
          </Link>

          <ul className="flex flex-1 flex-col gap-1 overflow-y-auto">
            {hq.map((item) => (
              <li key={item.href}>
                <RailLink
                  item={item}
                  active={isActive(item.href)}
                  badge={pending}
                  onNavigate={() => sound("tap")}
                />
              </li>
            ))}
            <li className="mt-6 mb-1.5 px-3 text-[10px] font-semibold tracking-widest text-muted uppercase">
              Parked
            </li>
            {parked.map((item) => (
              <li key={item.href}>
                <RailLink
                  item={item}
                  active={isActive(item.href)}
                  badge={pending}
                  onNavigate={() => sound("tap")}
                />
              </li>
            ))}
            <li className="mt-auto pt-6" aria-hidden />
            {utility.map((item) => (
              <li key={item.href}>
                <RailLink
                  item={item}
                  active={isActive(item.href)}
                  badge={pending}
                  onNavigate={() => sound("tap")}
                />
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* mobile bottom bar — the HQ surfaces only */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-1 overflow-x-auto border-t border-hairline bg-[var(--panel)] px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] backdrop-blur-2xl backdrop-saturate-150 md:hidden"
      >
        {[...hq, ...utility].map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
              onClick={() => sound("tap")}
              className={cn(
                "press relative flex min-w-14 flex-col items-center gap-0.5 rounded-control px-2 py-1.5 text-[10px] font-medium",
                active ? "bg-[var(--rail-active)] text-ink" : "text-muted",
              )}
            >
              <Icon
                size={18}
                aria-hidden
                className={cn(active && "text-accent-bright")}
              />
              {item.label}
              {item.approvalsBadge && pending > 0 ? (
                <span className="absolute top-0.5 right-1.5 rounded-full bg-[var(--accent)] px-1 text-[9px] font-bold text-[var(--accent-fg)]">
                  {pending}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
