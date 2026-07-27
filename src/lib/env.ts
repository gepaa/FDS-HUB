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

  // ---- Self-modification panel (/self-modify) ----
  // The hub runs on serverless: no checkout, no git, no minutes-long
  // processes. So the panel does NOT run a coding agent in-process —
  // it dispatches the agent-run workflow on GitHub Actions, which owns
  // the checkout and pushes a branch. See src/lib/github.ts.
  //
  // GITHUB_TOKEN: PAT with `repo` + `workflow` scope. Unset → the panel
  // shows "Connect your agent token" and refuses to dispatch. It never
  // simulates a run.
  // ANTHROPIC_API_KEY for the run itself is a GitHub Actions *secret*,
  // not an app env var — the key never passes through this app.
  GITHUB_TOKEN: z.string().optional(),
  // The single repo the panel may target (owner/name). This is the
  // scope guard: a prompt cannot redirect a run at another project.
  GITHUB_REPO: z.string().default("gepaa/FDS-HUB"),

  // ---- HQ brain: the in-app AI assistant (src/lib/agent) ----
  // AI_PROVIDER picks the backend; AI_API_KEY is its credential.
  //   groq       — free tier, fast (console.groq.com)  ← recommended free
  //   gemini     — Google AI Studio free tier (aistudio.google.com)
  //   openrouter — free-model marketplace (openrouter.ai)
  //   anthropic  — Claude via ANTHROPIC_API_KEY (paid, best quality)
  //   custom     — any OpenAI-compatible endpoint via AI_BASE_URL
  // Unset → the chat shows an honest "Not connected" setup screen.
  AI_PROVIDER: z
    .enum(["groq", "gemini", "openrouter", "anthropic", "custom"])
    .optional(),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(), // override the provider default
  AI_BASE_URL: z.string().optional(), // only for AI_PROVIDER=custom

  // ---- Password Control vault ----
  // CREDENTIAL_KEY seals every stored secret (AES-256-GCM, base64 of
  // 32 bytes: `openssl rand -base64 32`). It lives ONLY here — losing
  // it makes the vault unreadable, leaking it makes a DB dump readable.
  // PASSWORD_CONTROL_PASSPHRASE is the second gate in front of the
  // page, on top of the team login. Either unset → the vault refuses
  // to open and says so.
  CREDENTIAL_KEY: z.string().optional(),
  PASSWORD_CONTROL_PASSPHRASE: z.string().optional(),

  // ---- HQ engine: bearer token for the Claude agent's API access ----
  // (docs/FDS_HQ_Decisions.md D4 — the agent↔app audit choke-point)
  AGENT_API_KEY: z.string().optional(),

  // ---- Ad Budget Watch: daily cron auth (Vercel Cron) ----
  // Set on Vercel; the cron route accepts `Bearer <CRON_SECRET>`. Unset
  // locally = the cron route is open (dev convenience).
  CRON_SECRET: z.string().optional(),

  // ---- Quo telephony (formerly OpenPhone) — see docs/quo-crm-integration.md ----
  //
  // The master switch. Everything below is inert until this is "true":
  // no webhook processing, no background sync, no AI extraction, no
  // incoming-call alerts. Flipping it back to false is the rollback —
  // it never deletes historical CRM records.
  // Deliberately lenient: a typo here must not fail the whole env parse
  // and take the app down to the SetupRequired screen. Off unless
  // explicitly switched on.
  QUO_INTEGRATION_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1" || v === "yes"),

  // Workspace API key (Quo → Settings → API). Server-only: this must
  // never reach the browser. NOTE: Quo sends this raw, with NO "Bearer "
  // prefix — see src/lib/quo/client.ts.
  QUO_API_KEY: z.string().optional(),
  // Host only; the client appends /v1 or the versioned path itself.
  QUO_API_BASE_URL: z.string().default("https://api.quo.com"),
  // Standard-Webhooks signing secret ("whsec_…") returned when the
  // webhook subscription is created or rotated.
  QUO_WEBHOOK_SECRET: z.string().optional(),

  // Which Quo numbers we sync ("PN…", comma-separated). Empty = all.
  QUO_PHONE_NUMBER_IDS: z.string().optional(),
  // The number outbound calls and contact sync default to.
  QUO_DEFAULT_PHONE_NUMBER_ID: z.string().optional(),

  // Default region for parsing numbers that arrive without a country
  // code. Quo itself always sends E.164; this is for CRM-entered values.
  // Anything that isn't a 2-letter code falls back to US rather than
  // failing the parse.
  QUO_DEFAULT_REGION: z
    .string()
    .optional()
    .transform((v) =>
      v && /^[A-Za-z]{2}$/.test(v) ? v.toUpperCase() : "US",
    ),

  // Recordings stay provider-hosted and are streamed through our own
  // permission-checked proxy. Copying them into object storage needs a
  // blob store this project does not have yet (see Known limitations).
  QUO_RECORDING_STORAGE_MODE: z
    .string()
    .optional()
    .transform(() => "provider" as const),

  // Our own transcript→structured-data pass. Separate from the master
  // switch so it can be disabled without losing call sync. On by
  // default once the integration is enabled.
  QUO_AI_EXTRACTION_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== "false" && v !== "0" && v !== "no"),

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
