import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/shell/Providers";
import { AmbientBackground } from "@/components/shell/AmbientBackground";
import { AppShell } from "@/components/shell/AppShell";
import { getIntegrations } from "@/lib/integrations";

export const metadata: Metadata = {
  title: {
    default: "FDS Command Hub",
    template: "%s · FDS Command Hub",
  },
  description:
    "Operator console for Farmer Direct Supply — CRM, accounting, Shopify, tasks, comms, and calendar in one glass surface.",
};

export const viewport: Viewport = {
  themeColor: "#0A0E14",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const integrations = getIntegrations().map(({ id, name, connected }) => ({
    id,
    name,
    connected,
  }));

  return (
    <html lang="en" className="dark h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full">
        <Providers>
          <AmbientBackground />
          <AppShell integrations={integrations}>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
