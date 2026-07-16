"use client";

import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LeftRail } from "@/components/shell/LeftRail";
import { TopBar } from "@/components/shell/TopBar";

/** Serializable slice of integration state for client chrome. */
export interface IntegrationSummary {
  id: string;
  name: string;
  connected: boolean;
}

/**
 * App chrome: fixed left sidebar + sticky top bar + centered content
 * column. Pages fade-rise on route change (respects reduced motion
 * via CSS).
 */
export function AppShell({
  integrations,
  children,
}: {
  integrations: IntegrationSummary[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh">
      <LeftRail />
      <div className="md:pl-60">
        <TopBar integrations={integrations} />
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.2, 0.8, 0.3, 1] }}
          className="mx-auto w-full max-w-6xl px-4 pt-8 pb-28 md:px-8 md:pb-14"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
