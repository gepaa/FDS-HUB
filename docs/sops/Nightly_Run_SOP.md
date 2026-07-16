# FDS — Nightly Run SOP

### What the PM agent does on every scheduled cycle, and what the morning brief must contain.

> **When this triggers.** On the nightly schedule (and on demand when Pablo assigns work). **Autonomy: notch 0 (draft-only)** — nothing outbound ever sends; every outbound draft lands in Approvals. A fresh approval from Pablo is required before any notch increase (docs/FDS_HQ_Decisions.md).
>
> **Who runs it.** The PM agent — a Claude session in this workspace with the Shopify + Gmail connectors and the hub API (`AGENT_API_KEY` bearer token against `/api/*`).

---

## 0. Read before acting (the context layer)

1. `docs/FDS_HQ_Decisions.md` — the rules. Non-negotiable.
2. This SOP, plus the SOP for any job the run will touch.
3. The task queue (`GET /api/tasks?status=queued`) and Pablo's chat notes (`GET /api/messages` — anything `role: you` since the last run).
4. The CRM (`GET /api/records`) — statuses, owners, next actions, due dates.

## 1. The run, in order

1. **Ingest.** Read new Gmail threads from known CRM contacts (match by email/domain). For each: update `last_contact`, refresh `context_summary`, advance status if the thread shows it (e.g. Contacted → Replied), set the next action. Log every touch to the record's activity log (`POST /api/records/[id]/interactions`).
2. **Hygiene.** Find records whose notes/threads contradict their status, records with no `next_action`, stale owners, and overdue follow-ups. Fix what is internal-only (next actions, owners, priorities, context summaries — these are CRM updates, not outbound). Anything that would *change history* or looks ambiguous → propose in the brief, don't silently edit.
3. **Work the queue.** For each queued task, plan → execute the internal parts → draft the outbound parts. Move it `queued → running → done` via `PATCH /api/tasks/[id]` and write a `result`.
4. **Outreach cadence** (per Supplier_Outreach_SOP): qualified suppliers needing first contact → draft; contacted suppliers quiet ≥ 4 days → draft follow-up; replies → draft responses and set next steps; call-ready threads → build the call brief.
5. **Gate everything outbound.** Every draft becomes `POST /api/approvals` with `kind`, the full draft, and `reasoning` (why this, why now, what happens on approve). **Hard stops that are never auto-sent at any notch:** prices/quotes, legal/contract attachments, replies to upset threads, cold first-contact at volume.
6. **Execute approved items.** Items with `status: approved` from earlier decisions: perform the approved action — at notch 0 this means **creating the Gmail draft** (the Gmail connector cannot send; Pablo taps Send in Gmail). Then `PATCH` the approval to `executed`, log it on the record, update the status.
7. **Suggest.** If the run exposes work worth doing that nobody queued, `POST /api/tasks` (it lands as `suggested` — Pablo promotes it).
8. **Brief.** Post the morning brief (`POST /api/messages`, `kind: brief`).

## 2. The morning brief — required contents

- **Headline:** the single most important thing (a hot reply, a call to take, a risk).
- **What ran:** counts — records touched, drafts queued, replies read, tasks advanced.
- **Awaiting Pablo:** every pending approval and every `owner: you` action, one line each.
- **Exceptions & proposals:** anything ambiguous, any hygiene change the PM wants but didn't make, any data gap (missing spec, missing contact).
- **Tomorrow:** what the next run intends to do.

## 3. Rules that bind every run

- **Notch 0.** Draft-only. No send, no publish, no price, no discount — ever — without a human tap first.
- **No guessing.** Missing facts are flagged in the brief and logged as gaps, never invented (Import SOP discipline).
- **Attribution.** All agent writes go through the bearer-token API so they're logged as `actor: claude`.
- **The agent never deletes** records, activity entries, or tasks, and never decides its own approvals — the API enforces this; don't work around it.
- **Human-paced.** Even approved sends go out at human cadence, never as a burst.
