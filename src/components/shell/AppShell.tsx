"use client";

import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LeftRail } from "@/components/shell/LeftRail";
import { TopBar } from "@/components/shell/TopBar";
import { IncomingCallAlert } from "@/components/crm/IncomingCallAlert";

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

  // The login screen is the front door, not a room in the house: it
  // renders without the rail, top bar or incoming-call alert, all of
  // which would be showing console furniture to someone not yet
  // signed in.
  if (pathname === "/login") return <>{children}</>;

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
      {/* Ringing-phone alert. Renders nothing unless a call is live, so
          it costs one small poll and no layout on every other page. */}
      <IncomingCallAlert />
    </div>
  );
}
