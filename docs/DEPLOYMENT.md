# Deploying the HQ to Vercel

> Production = Vercel (git-linked to `gepaa/FDS-HUB`) + **Supabase Postgres** (project `fds-hub-prod`, ref `oxhyncbypzojbtaxmmgl`, us-east-1, org Arterial). The agent manages the database through the Supabase MCP. The codebase is production-ready: Postgres schema + migrations in `prisma/postgres/`, `prisma.config.ts` and `src/lib/prisma.ts` switch on `DATABASE_URL`. **There is no access gate** — see "Who can reach this" below.

## Database state (done by the agent, 2026-07-16)

- Project `fds-hub-prod` created ($0/month tier); full schema applied (6 tables + indexes + FKs) with `_prisma_migrations` bookkeeping so `prisma migrate deploy` recognizes it.
- **All workspace data copied and verified:** 100 suppliers (95 Qualified / 1 Sourced / 2 Contacted / 1 Negotiating / 1 Call Scheduled), 38 activity entries, 6 pending approvals, 3 suggested tasks, 4 agent messages.
- **RLS enabled deny-all** on every table: Supabase's PostgREST API can read nothing; the app's only access path is its direct Prisma connection.

## One-time setup (Pablo, ~3 minutes in dashboards)

1. **Get the connection string.** supabase.com → project `fds-hub-prod` → **Connect** → copy the **Transaction pooler** URI (port 6543 — required for serverless). If you don't know the database password, Settings → Database → **Reset database password** first.
2. **Import the repo.** vercel.com → team `gepaas-projects` → **Add New → Project** → import `gepaa/FDS-HUB`. Framework auto-detects; `vercel.json` sets the build command.
3. **Add the env vars.** Project → Settings → Environment Variables:
   - `DATABASE_URL` — the Supabase transaction-pooler URI from step 1.
   - `AGENT_API_KEY` — copy from the local `.env` (keep local + Vercel identical).
   - `AI_PROVIDER` + `AI_API_KEY` — the in-app AI assistant's brain (2026-07-21). Free lane: `AI_PROVIDER=groq` with a key from console.groq.com/keys, or `AI_PROVIDER=gemini` with a key from aistudio.google.com/apikey. Paid lane: `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY`. Optional `AI_MODEL` overrides the provider default. Unset → the Assistant page shows setup instructions instead of a chat.
4. **Deploy / Redeploy.** The app comes up already full of data.

## Verification (agent, after deploy)

Pages load; `/api/health` reports 100 records; agent bearer calls work against the production URL; Vercel build logs clean (via the Vercel MCP).

## How the team uses it

- Open the production URL. There is no sign-in.
- Every push to `main` auto-deploys. No file uploads, no manual steps.
- The agent talks to production with `Authorization: Bearer $AGENT_API_KEY` — same API contract as local (`docs/sops/Hub_Agent_Interface.md`).

## Notes & gotchas

- **Local dev is untouched:** `file:` URL → SQLite. The two Prisma schemas must stay model-identical (`prisma/schema.prisma` ↔ `prisma/postgres/schema.prisma`) — change both or the environments drift.
- **A deploy without `DATABASE_URL`** shows a friendly setup screen instead of erroring (see `src/app/layout.tsx`).
- **Future schema changes in production:** generate the SQL from the postgres schema, apply via the Supabase MCP (`apply_migration`) or `DATABASE_URL=… npm run db:deploy` — same additive-only inspection discipline as local.
- `npm run db:seed` wipes and re-seeds CRM data — **never run it against production once live work exists** (the same D1 discipline as local). Production was populated by a one-time verified copy of the workspace state, not the seed.
- `dev.db.backup`, `assets/business/` (signed documents), and `.env` never deploy — gitignored or excluded.

## Who can reach this

**Nobody is asked for anything.** The team gate was removed on 2026-07-30 at the
owner's instruction: `src/proxy.ts`, `src/lib/team-auth.ts`, the `/login` page and
the `/api/auth/*` routes are gone. Anyone who has the URL — or guesses it, or
finds it in a referrer header, a forwarded link, or a browser history on a lent
laptop — has full read/write access: the CRM, supplier and lead records with
phone numbers, call recordings, the approvals gate, Self-Modify, and the
Password Control page. (Vault *contents* still need their own passphrase; the
list of which accounts exist does not.)

`public/robots.txt` asks crawlers to stay out. That is a request, not a control —
it stops honest indexers, not anyone who wants in.

Two things still authenticate, and neither changed:
- the Quo webhook, by Standard-Webhooks signature;
- agent writes, by `Authorization: Bearer $AGENT_API_KEY`.

`TEAM_USER` / `TEAM_PASSWORD` / `AUTH_SECRET` may still be set on Vercel; nothing
reads them. Deleting them is tidy but changes nothing.

**To put the door back:** revert the commit that removed those files. Real
per-user auth remains the parked Stage-7 work.
