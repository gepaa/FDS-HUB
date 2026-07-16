import { z } from "zod";

/**
 * Typed environment contract for the whole project.
 *
 * Every integration is a *seam*: the variable is declared here from day
 * one, optional until the human supplies the real credential. Missing
 * optional credentials surface as honest "Not connected" states in the
 * UI (see lib/integrations.ts) — never a crash, never fake data.
 */
const envSchema = z.object({
  // ---- Stage 0: database ----
  // SQLite file for local dev; Neon/Vercel Postgres URL in production.
  DATABASE_URL: z.string().min(1).default("file:./dev.db"),

  // ---- Stage 3: Shopify (human supplies via Dev Dashboard app) ----
  SHOPIFY_STORE_DOMAIN: z.string().optional(),
  // New Dev Dashboard apps: client credentials, exchanged for 24h
  // tokens automatically (lib/shopify.ts).
  SHOPIFY_CLIENT_ID: z.string().optional(),
  SHOPIFY_CLIENT_SECRET: z.string().optional(),
  // Legacy admin-created custom apps: static shpat_ token.
  SHOPIFY_ADMIN_TOKEN: z.string().optional(),

  // ---- Stage 4: comms ----
  DISCORD_BOT_TOKEN: z.string().optional(),
  DISCORD_WEBHOOK_URL: z.string().optional(),
  DISCORD_CHANNEL_IDS: z.string().optional(), // comma-separated
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // ---- Stage 5: agent harness ----
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  // ---- HQ engine: bearer token for the Claude agent's API access ----
  // (docs/FDS_HQ_Decisions.md D4 — the agent↔app audit choke-point)
  AGENT_API_KEY: z.string().optional(),

  // ---- Team access gate (production) — see src/proxy.ts ----
  TEAM_USER: z.string().optional(), // defaults to "fds"
  TEAM_PASSWORD: z.string().optional(), // unset = gate off (local dev)

  // ---- Stage 7: auth ----
  AUTH_SECRET: z.string().optional(),

  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

/**
 * Validation problems found at boot. When non-null, pages render the
 * SetupRequired screen instead of crashing.
 */
export const envError: string | null = parsed.success
  ? null
  : parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");

export const env: Env = parsed.success
  ? parsed.data
  : envSchema.parse({ DATABASE_URL: "file:./dev.db" });
