# FDS Operations HQ

The AI-run headquarters for **Farmer Direct Supply** (farmerdirectsupply.com) —
high-ticket agricultural equipment. The Claude agent runs everything around
the sale (sourcing, outreach drafting, CRM upkeep, briefs); the human approves
every outbound action and closes every deal.

**Read [docs/README.md](docs/README.md) first** — the context layer (specs,
locked decisions, SOP library) lives there and governs all work in this repo.

## The five surfaces

| Surface | What it is |
| ------- | ---------- |
| **Dashboard** | Morning brief, KPIs, "what needs you" |
| **CRM** | Supplier + lead pipelines on one shared record spine — status, context, next action per record |
| **Approvals** | The gate: every outbound email, publish, price, or discount waits here for a one-tap decision |
| **Task Queue** | Assign work in plain language; the PM plans and runs it |
| **Chat** | Async feed: PM briefs/pings/logs + your notes for its next run |
| **SOP Library** | Renders `docs/` live — the playbooks the agent follows |

(Accounting, Shopify panel, Comms, Calendar are parked placeholders.)

## Architecture (Decisions D4)

- **This app** = interface + database + context store. Next.js 16 App Router,
  Prisma 7, SQLite locally (Postgres-ready), the original liquid-glass kit.
- **The engine** = Claude agent sessions (supervised now; scheduled nightly
  once approved) using claude.ai connectors (Shopify live, Gmail read+draft)
  and this app's REST API with a bearer token (`AGENT_API_KEY`). Every agent
  write is attributed `actor: claude`; the API structurally prevents the agent
  from deleting data, deciding approvals, or promoting its own suggestions.
  See [docs/sops/Hub_Agent_Interface.md](docs/sops/Hub_Agent_Interface.md).
- **Autonomy: notch 0 (draft-only).** The Gmail connector cannot send — the
  human-in-the-loop is mechanical, not just policy.

## Quickstart (local)

```bash
npm install            # also runs `prisma generate`
cp .env.example .env   # local SQLite works out of the box; set AGENT_API_KEY
npx prisma migrate dev # create/apply the database
npm run db:seed        # load the real FDS supplier list + verify totals
npm run dev            # http://localhost:3000
```

The seed imports `data/suppliers.csv` (the real Supplier Outreach sheet) and
asserts the known totals: **100 suppliers · 50 Gold / 46 Silver / 3 Bronze /
1 unranked · pipeline 1 Sourced / 95 Qualified / 4 Contacted · clusters
33/18/11/7/7/4/4/16**. `dev.db.backup` is a committed snapshot (data safety
net — Decisions D1).

## Database rules (non-negotiable)

Migrations against the CRM data table are **additive-only** — the physical
table keeps its original `Supplier` name via `@@map`, generated SQL is
inspected before applying, and any migration containing a `DROP` of the data
table is rewritten by hand (see `prisma/migrations/*_record_spine`). Test on
a copy of `dev.db`, apply, then verify counts. Details in
[docs/FDS_HQ_Decisions.md](docs/FDS_HQ_Decisions.md).

For production: Postgres (Neon/Vercel), flip `provider` in
`prisma/schema.prisma`, set `DATABASE_URL`, `prisma migrate deploy`, seed.
The runtime picks the driver from the URL (`file:` → SQLite, else pg) in
`src/lib/prisma.ts`.

## Scripts

| Command | What it does |
| ------- | ------------ |
| `npm run dev` | Dev server (also available via `.claude/launch.json` → `fds-hub-dev`) |
| `npm run build` | Production build |
| `npm run db:migrate` / `db:deploy` | Migrations (dev / production) |
| `npm run db:seed` | Re-seed from `data/suppliers.csv` + verify totals |
| `npm run db:studio` | Prisma Studio data browser |
| `npx tsx scripts/migrate-stages.ts` | One-time legacy-stage migration (idempotent, self-verifying) |

## Design system

Apple-inspired liquid glass, dark by default — tokens in
`src/app/globals.css`, components in `src/components/kit/` (panels, cards,
data table, drawer, modal, toasts, pills, segmented control), ambient
background, WebAudio UI sound (mute in the command bar). Stage colors ship
with visible labels + counts, never color-alone.
