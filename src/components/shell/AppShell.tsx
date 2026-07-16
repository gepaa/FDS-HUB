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
 * App chrome: left rail + top bar + animated main area.
 * Pages fade-rise on route change (respects reduced motion via CSS).
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
      <div className="px-3 pt-0 pb-24 md:ml-[15.5rem] md:pr-4 md:pb-6">
        <TopBar integrations={integrations} />
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.2, 0.8, 0.3, 1] }}
          className="mt-4"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
