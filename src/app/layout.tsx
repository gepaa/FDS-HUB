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
  // Serverless has no writable filesystem: a deployment without a real
  // DATABASE_URL would 500 on every query. Show setup steps instead.
  if (process.env.VERCEL && (process.env.DATABASE_URL ?? "").trim() === "") {
    return (
      <html lang="en" className="dark h-full antialiased">
        <body className="min-h-full">
          <main
            style={{
              minHeight: "100dvh",
              display: "grid",
              placeItems: "center",
              fontFamily: "system-ui, sans-serif",
              background: "#0a0e14",
              color: "#e6ebe8",
              padding: "2rem",
            }}
          >
            <div style={{ maxWidth: "36rem", lineHeight: 1.6 }}>
              <h1 style={{ fontSize: "1.4rem", marginBottom: "0.75rem" }}>
                🌱 FDS Operations HQ — one step left
              </h1>
              <p style={{ opacity: 0.85 }}>
                The app is deployed but has no database yet. In Vercel →
                Project → Settings → Environment Variables, set{" "}
                <code>DATABASE_URL</code> (a Neon or Vercel Postgres
                connection string), <code>AGENT_API_KEY</code>, and{" "}
                <code>TEAM_PASSWORD</code>, then redeploy. Migrations + seed
                run from the workspace — see README → Database.
              </p>
            </div>
          </main>
        </body>
      </html>
    );
  }

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
