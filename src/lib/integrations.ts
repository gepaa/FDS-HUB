import { env } from "@/lib/env";

/**
 * Integration registry — the single source of truth for connection
 * state. Server-only (reads env). Each entry is an honest seam: the
 * client + UI exist, and `connected` flips to true the moment the
 * human drops the credential into the environment.
 */
export interface IntegrationStatus {
  id: string;
  name: string;
  description: string;
  stage: number;
  connected: boolean;
  requiredEnv: string[];
  setupUrl?: string;
}

export function getIntegrations(): IntegrationStatus[] {
  return [
    {
      id: "database",
      name: "Postgres Database",
      description:
        "Primary data store — Supabase Postgres in production, local SQLite for dev.",
      stage: 0,
      connected: !env.DATABASE_URL.startsWith("file:"),
      requiredEnv: ["DATABASE_URL"],
      setupUrl: "https://supabase.com/dashboard",
    },
    {
      id: "shopify",
      name: "Shopify Admin",
      description:
        "Live store analytics, orders, and customer management via the Admin GraphQL API.",
      stage: 3,
      connected: Boolean(env.SHOPIFY_STORE_DOMAIN && env.SHOPIFY_ADMIN_TOKEN),
      requiredEnv: ["SHOPIFY_STORE_DOMAIN", "SHOPIFY_ADMIN_TOKEN"],
      setupUrl: "https://admin.shopify.com",
    },
    {
      id: "discord",
      name: "Discord",
      description:
        "Post to and read from designated channels; surface notifications in the comms hub.",
      stage: 4,
      connected: Boolean(env.DISCORD_BOT_TOKEN),
      requiredEnv: ["DISCORD_BOT_TOKEN", "DISCORD_WEBHOOK_URL", "DISCORD_CHANNEL_IDS"],
      setupUrl: "https://discord.com/developers/applications",
    },
    {
      id: "gmail",
      name: "Gmail",
      description:
        "Read threads and send from the store domain; log supplier replies against the CRM.",
      stage: 4,
      connected: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
      setupUrl: "https://console.cloud.google.com/apis/credentials",
    },
    {
      id: "calendar",
      name: "Google Calendar",
      description:
        "Embedded agenda, event creation from tasks and supplier follow-ups.",
      stage: 5,
      connected: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
      setupUrl: "https://console.cloud.google.com/apis/credentials",
    },
    {
      id: "agents",
      name: "Agent Harness",
      description:
        "Dispatch and monitor Claude Code / Codex runs against connected repos.",
      stage: 5,
      connected: Boolean(env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY),
      requiredEnv: ["ANTHROPIC_API_KEY", "OPENAI_API_KEY"],
      setupUrl: "https://console.anthropic.com",
    },
  ];
}
