# FDS — Hub Agent Interface (the mechanical wiring)

### How the PM and worker agents actually read/write the HQ app. Companion to `SOP_Nightly_Run.md` — that SOP says *what* the cycle does; this doc says *how* it touches the hub.

> Every agent session working FDS starts here after reading `docs/README.md` and `docs/FDS_HQ_Decisions.md`.

---

## 1. Authentication

All agent reads/writes go through the hub's REST API with the bearer token:

```
Authorization: Bearer $AGENT_API_KEY     # value in .env (never commit)
Base URL: http://localhost:3000          # dev; production URL after deploy
```

Requests with the token are attributed `actor: claude` in every activity log. Requests with a *wrong* token are rejected (401) — never silently demoted. The UI (no token) writes as `actor: you`.

## 2. Endpoints

| Surface | Endpoint | Agent may | Agent may NOT (enforced 403) |
|---|---|---|---|
| CRM | `GET/POST /api/records`, `GET/PATCH /api/records/[id]`, `POST /api/records/[id]/interactions`, `POST /api/records/import`, `GET /api/records/export` | create records, update statuses/context/next-actions (status moves auto-log), log activity | delete records or activity entries |
| The gate | `GET/POST /api/approvals`, `PATCH /api/approvals/[id]` | queue drafts (`status: pending`); mark an **approved** item `executed` after performing it | approve/reject/snooze anything — deciding is human-only |
| Task queue | `GET/POST /api/tasks`, `PATCH/DELETE /api/tasks/[id]` | suggest tasks (lands as `suggested`); move `queued→running→done` + write `result` | promote its own suggestions, cancel human tasks, delete |
| Chat | `GET/POST /api/messages` | post `brief` / `ping` / `log`; read Pablo's `role: you` notes | — |
| Health | `GET /api/health` | check DB + counts | — |

`Approval.kind`: `outbound_email` · `publish_product` · `price_quote` · `discount` · `other`. Every approval carries `draftBody` + `reasoning` (why queued, what happens on approve).

## 3. The execution loop for approved items (notch 0)

1. `GET /api/approvals?status=approved`.
2. Perform the approved action — for `outbound_email`: **create the Gmail draft** on the right thread via the Gmail connector (it cannot send; Pablo taps Send in Gmail). For anything the agent cannot complete (signature, attachment only Pablo has), ping instead of improvising.
3. `PATCH /api/approvals/[id]` → `status: executed`.
4. Log it on the record (`POST .../interactions`, type `email`) and advance the CRM status per the relevant SOP.

## 4. Status ladders (must match `src/lib/domain.ts`)

- Supplier: `SOURCED → QUALIFIED → CONTACTED → REPLIED → IN_CONVERSATION → CALL_SCHEDULED → NEGOTIATING → AUTHORIZED` (+ `ON_HOLD`, `DECLINED`)
- Lead: `NEW → CONTACTED → ENGAGED → QUOTE_REQUESTED → QUOTE_SENT → CALL_NEGOTIATION → WON` (+ `NURTURE`, `LOST`)

## 5. Session facts

- Dev server: `.claude/launch.json` → `fds-hub-dev` (port 3000). Prisma/tsc run via `node node_modules/prisma/build/index.js` / `node node_modules/typescript/lib/tsc.js` (sandbox blocks `.bin`).
- Migration policy: **additive-only** against the `Supplier` physical table — see `docs/FDS_HQ_Decisions.md`. Inspect generated SQL; no DROP.
- Outreach voice: match the real Gmail threads (Ben Lockwood / Bennet Manning, hello@farmerdirectsupply.com) until Pablo rules otherwise.
- Seed (`npm run db:seed`) wipes and rebuilds CRM data from `data/suppliers.csv` and must keep verifying: 100 suppliers · 1 Sourced / 95 Qualified / 4 Contacted · clusters 33/18/11/7/7/4/4/16.
