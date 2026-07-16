# Deploying the HQ to Vercel

> Production = Vercel (git-linked to `gepaa/FDS-HUB`) + PostgreSQL (Neon via the Vercel Marketplace). The codebase is already production-ready: the Postgres schema + migrations live in `prisma/postgres/`, `prisma.config.ts` and `src/lib/prisma.ts` switch on `DATABASE_URL`, and `src/proxy.ts` gates the deployed app behind shared team credentials.

## One-time setup (Pablo, ~3 minutes in the dashboard)

1. **Import the repo.** vercel.com → team `gepaas-projects` → **Add New → Project** → import `gepaa/FDS-HUB` (GitHub). Framework auto-detects as Next.js; `vercel.json` already sets the build command (`prisma generate && next build`). Deploy.
2. **Create the database.** Project → **Storage → Create Database → Neon (Postgres)** → connect to the project. This auto-adds `DATABASE_URL` to the project's environment variables.
3. **Add the two remaining env vars.** Project → Settings → Environment Variables:
   - `AGENT_API_KEY` — copy the value from the local `.env` (or generate a fresh `openssl rand -hex 32` and update the local `.env` to match).
   - `TEAM_PASSWORD` — pick the shared team password (username defaults to `fds`; set `TEAM_USER` to override).
4. **Redeploy** (Deployments → ⋯ → Redeploy) so the env vars take effect.

## Then the agent takes over (from the workspace)

With the Neon `DATABASE_URL` in hand (Storage tab → `.env.local` snippet), run from the repo:

```bash
DATABASE_URL="postgres://…" npm run db:deploy   # applies prisma/postgres/migrations
DATABASE_URL="postgres://…" npm run db:seed     # loads the 100 suppliers + verifies totals
```

Then verify the live URL end-to-end (pages load behind the team gate, `/api/health` reports 100 records, agent bearer calls work against the production URL).

## How the team uses it

- Open the production URL, sign in once with `fds` / the team password (browser-native prompt, remembered per browser).
- Every push to `main` auto-deploys. No file uploads, no manual steps.
- The agent talks to production with `Authorization: Bearer $AGENT_API_KEY` — same API contract as local (`docs/sops/Hub_Agent_Interface.md`).

## Notes & gotchas

- **Local dev is untouched:** no `TEAM_PASSWORD` locally → gate off; `file:` URL → SQLite. The two Prisma schemas must stay model-identical (`prisma/schema.prisma` ↔ `prisma/postgres/schema.prisma`) — change both or the environments drift.
- **A deploy without `DATABASE_URL`** shows a friendly setup screen instead of erroring (see `src/app/layout.tsx`).
- The production seed wipes and re-seeds CRM data — **run it once at setup, never against a database that has live work in it** (the same D1 discipline as local).
- `dev.db.backup`, `assets/business/` (signed documents), and `.env` never deploy — gitignored or excluded.
- Shared Basic-auth is interim protection (Stage-7 real auth stays parked). Don't put the URL anywhere public.
