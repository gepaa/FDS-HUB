"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Sprout } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useSound } from "@/hooks/useSound";

/**
 * Persistent left rail (desktop) / bottom bar (mobile).
 * Active item carries a sliding glass highlight + green glow.
 */
export function LeftRail() {
  const pathname = usePathname();
  const { sound } = useSound();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* desktop rail */}
      <nav
        aria-label="Primary"
        className="fixed top-3 bottom-3 left-3 z-40 hidden w-56 flex-col md:flex"
      >
        <div className="glass flex h-full flex-col rounded-panel p-3">
          <Link
            href="/"
            className="mb-4 flex items-center gap-2.5 px-2 pt-1.5"
            onClick={() => sound("tap")}
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-[10px] text-white shadow-[0_4px_14px_var(--accent-soft)]"
              style={{
                background:
                  "linear-gradient(160deg, var(--accent-bright), var(--accent))",
              }}
            >
              <Sprout size={19} aria-hidden />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold tracking-tight text-ink">
                FDS Command Hub
              </span>
              <span className="block text-[10px] tracking-wide text-muted uppercase">
                Farmer Direct Supply
              </span>
            </span>
          </Link>

          <ul className="flex flex-1 flex-col gap-0.5">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <li key={item.href} className={item.href === "/settings" ? "mt-auto" : undefined}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => sound("tap")}
                    className={cn(
                      "press relative flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium",
                      active ? "text-ink" : "text-muted hover:text-ink hover:bg-[var(--panel-soft)]",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="rail-active"
                        className="absolute inset-0 rounded-control"
                        style={{
                          background: "var(--rail-active)",
                          border: "1px solid var(--accent-soft)",
                        }}
                        transition={{ type: "spring", stiffness: 480, damping: 40 }}
                      />
                    )}
                    <Icon
                      size={17}
                      aria-hidden
                      className={cn("relative z-10", active && "text-accent-bright")}
                    />
                    <span className="relative z-10">{item.label}</span>
                    {item.stage ? (
                      <span className="relative z-10 ml-auto rounded-full border border-hairline px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-muted">
                        S{item.stage}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* mobile bottom bar */}
      <nav
        aria-label="Primary"
        className="glass-strong fixed right-3 bottom-3 left-3 z-40 flex items-center gap-1 overflow-x-auto rounded-panel px-2 py-1.5 md:hidden"
      >
        {NAV_ITEMS.map((item) => {
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
                "press flex min-w-14 flex-col items-center gap-0.5 rounded-control px-2 py-1.5 text-[10px] font-medium",
                active
                  ? "bg-[var(--rail-active)] text-ink"
                  : "text-muted",
              )}
            >
              <Icon size={18} aria-hidden className={cn(active && "text-accent-bright")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
