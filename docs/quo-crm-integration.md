# Quo ⇄ CRM integration

How Farmer Direct Supply's phone system connects to the hub: what syncs,
what does not, and why.

Quo is the business telephone platform (formerly OpenPhone — it rebranded,
and the API changed with it). This integration makes the CRM the place a
salesperson looks after a call, instead of Quo.

---

## 1. What it does

- Every call on a synced Quo number becomes a `CommsActivity` row on the
  matching lead.
- Recordings, transcripts and Quo's AI summary are collected as they
  become available and shown on the lead.
- Our own extraction turns the transcript into structured sales data —
  products, budget, delivery location, objections, and crucially **what
  the salesperson promised** — and proposes a follow-up task.
- A ringing phone raises an in-app alert with the caller's history
  before anyone picks up.
- An unknown caller becomes a new lead, exactly once.

Everything the AI produces is labelled as AI-generated, editable, and
kept separate from Quo's original output.

---

## 2. Existing architecture this builds on

Discovered by inspection, not assumed:

| Concern | What the hub already uses |
|---|---|
| Framework | Next.js 16.2 App Router, React 19.2 |
| Data | Prisma 7 driver adapters — **two schemas**: `prisma/schema.prisma` (SQLite, local) and `prisma/postgres/schema.prisma` (Supabase, production) |
| Access control | One shared team password (`src/proxy.ts`); API actor is `you` \| `claude` \| `system` (`src/lib/agent-auth.ts`). No per-user accounts |
| Background work | Vercel Cron; no queue existed |
| Validation | Zod 4, with a typed env contract in `src/lib/env.ts` |
| AI | `src/lib/agent/` provider abstraction (Groq / Gemini / OpenRouter / Anthropic) |
| Design system | `src/components/kit/` |

The integration reuses all of it. `CrmRecord` remains the lead model,
`Interaction` still receives a one-line entry per call, `HqTask` carries
follow-ups, and `Approval` remains the only route for anything outbound.

---

## 3. The Quo API, as it actually is

Verified against Quo's published OpenAPI documents, not older OpenPhone
examples. Several things differ from what you would reasonably expect:

**Authentication is `Authorization: <key>` with no `Bearer` prefix.**
Quo's documentation states this explicitly. Sending `Bearer` 401s.

**There are two API surfaces on the same host.**
- `https://api.quo.com/v1/…` — stable. All call data lives here.
- `https://api.quo.com/…` (no `/v1`), with a required
  `Quo-Api-Version: 2026-03-30` header — the newer versioned surface,
  where unified webhook management lives.

We use both, deliberately. See `src/lib/quo/client.ts`.

**There are two webhook systems.** The legacy one has four separate
create endpoints, only three call events, and signs with an
`OpenPhone-Signature` header. The unified beta (open beta since
2026-05-11) has one `POST /webhooks`, 28 event types, delivery history,
test deliveries, manual retry and secret rotation — and signs with
**Standard Webhooks** (`webhook-id` / `webhook-timestamp` /
`webhook-signature`, `whsec_…` secret). The two schemes are not
interchangeable.

We target the unified API, because `call.missed` is a first-class event
there (the CRM needs missed calls) and its delivery-inspection endpoints
give the settings page real data for free. The trade-off is that it is
formally in beta.

**You cannot list calls.** `GET /v1/calls` requires *both* a
`phoneNumberId` **and** the `participants` number, and supports only 1:1
conversations. There is no "recent calls on this number" endpoint. So
reconciliation walks `GET /v1/conversations` first to discover who has
been active, then asks for calls per participant. See
`src/lib/quo/reconcile.ts`.

**`totalItems` is documented by Quo as inaccurate.** Pagination follows
`nextPageToken` until it is null, and nothing else.

**Transcripts and summaries are plan-gated, but API access is not.**
An API key works on any paid plan. Transcripts and summaries, however,
are "only available on business and scale plans" (Quo's own spec
wording) and require call recording to be enabled. Quo's *action items*
(`nextSteps`) are Scale-only in addition.

What that means per plan:

| | Starter | Business | Scale |
|---|---|---|---|
| API + webhooks | ✅ | ✅ | ✅ |
| Call sync, matching, missed calls | ✅ | ✅ | ✅ |
| Call recording | manual only | automatic | automatic |
| Transcript + Quo summary | ❌ | ✅ | ✅ |
| Quo `nextSteps` | ❌ | ❌ | ✅ |
| Our AI note + follow-up | ❌ (no input) | ✅ | ✅ |

The integration is written to degrade rather than break. A plan that
does not include transcripts gets a 403, which is recorded once as
`status: absent`, `error: plan_not_entitled` — a settled fact, not a
retryable failure. No dead jobs accumulate, no extraction is queued with
nothing to read, and no follow-up is invented from a call nobody
transcribed. Upgrading later starts the AI half working with no code
change. Covered by `tests/plan-gating.test.ts`.

**Artifact readiness is a status, not a 404.** Recording, transcript and
summary endpoints return `status: absent | in-progress | completed |
failed`. A 200 with `in-progress` means "ask again shortly" and is not
counted as a failure.

**Rate limit: 10 requests/second per key.**

---

## 4. Calling: the honest position

**Quo's public API cannot start a call.** There is no `POST /calls`, no
browser voice SDK, and no embeddable softphone. This is a limitation of
the platform, not of this implementation.

So the **Call** button hands the number to the Quo desktop application
through a `tel:` link — the same mechanism Quo's own CRM integrations
use. The salesperson needs the Quo desktop app installed and set as
their default calling app. Audio is Quo's; the record of the call is
ours.

Inbound calls need no such setup, and are the majority of the value: the
alert fires on `call.ringing` and the write-up lands seconds after the
call ends.

This is deliberately behind an abstraction —
`CommunicationDialer.initiateCall()` in `src/lib/quo/dialer.ts` — which
returns a *launch instruction* rather than carrying audio. If a provider
that can carry browser audio is adopted later, only that file changes;
no lead screen has a `tel:` link hard-coded into it.

---

## 5. Data flow

```
Quo ──POST──▶ /api/integrations/quo/webhooks
                 │  verify signature over the RAW body
                 │  record WebhookEvent (idempotent on webhook-id)
                 │  enqueue JobQueue row
                 └─▶ 2xx immediately
                       │
                    after() ─▶ drainJobs()
                                 ├─ quo.process_webhook → upsert call, match lead
                                 ├─ quo.fetch_call      → authoritative call record
                                 ├─ quo.fetch_recording → segments
                                 ├─ quo.fetch_transcript→ dialogue + flat text
                                 ├─ quo.fetch_summary   → Quo's bullets
                                 └─ quo.extract         → our structured read
                                                          + proposed follow-up

Vercel Cron ──▶ /api/cron/quo-drain   (retries, stuck jobs, hourly reconcile)
```

### Lead matching order

1. Exact normalised **E.164** match on `CrmRecord.phoneE164`
2. An existing `QuoContactLink`
3. Inbound only: create a minimal lead
4. Otherwise: left unattached for review

There is **no** "last N digits" fallback. A wrong match would show one
customer's recording and transcript on another customer's record — a far
worse failure than an unmatched call.

### Why a database job queue

Vercel serverless has no long-lived process to host a worker, and Redis
or a hosted queue would be a larger operational commitment than a few
dozen jobs a day warrants. Jobs are rows in `JobQueue`, drained straight
after the webhook's 2xx via Next 16's `after()`, with cron as the safety
net. Backoff lives in `runAfter`; `dedupeKey` prevents the same work
being queued twice.

---

## 6. Idempotency and ordering

Quo guarantees neither exactly-once delivery nor ordering. Both are
handled structurally rather than hopefully:

- **Duplicates.** `WebhookEvent` is unique on `(provider,
  idempotencyKey)`, where the key is Standard Webhooks' `webhook-id` —
  stable across retries. `CommsActivity` is unique on `(provider,
  providerActivityId)`. A redelivered event changes nothing: no second
  call, no second lead, no second task, no re-download.
- **Ordering.** Every handler upserts. Call status can only move forward
  (`isForwardProgress`), so a late `call.ringing` cannot undo a completed
  call. `missed` and `voicemail` latch true. A recording that arrives
  before the CRM has ever heard of the call creates the call.
- **Not-ready.** `in-progress` artifacts raise a `not_ready` error, which
  is retried with backoff rather than recorded as a failure.

All of the above is covered by tests in `tests/webhook.test.ts`.

---

## 7. Security

- Quo is called only from the server. The API key and webhook secret are
  never exposed to the browser and never logged.
- The webhook endpoint verifies a Standard Webhooks signature over the
  **raw** request body, in constant time, with a 5-minute replay window.
  An unverifiable body is never parsed.
- The endpoint is excluded from the shared team password gate — Quo
  cannot send Basic credentials. Its signature check is a stronger
  authenticator than the gate, not a weaker one.
- **Recordings are proxied.** Quo's storage URLs have no documented
  expiry and no documented access control, so they are never sent to the
  browser. Audio is streamed through
  `/api/calls/[id]/recording/[segment]`, which checks the caller and
  looks the artifact up by both call id and segment (so recordings
  cannot be enumerated). Responses are `private, no-store`.
- Transcript text, summary text, recording URLs and payloads are never
  written to application logs. Logs carry identifiers and outcomes only.
- Input and output are Zod-validated at every boundary, including the AI
  reply.

### Permissions — an honest limitation

The spec asks for Administrator / Manager / Salesperson roles enforced
server-side. **The hub has no user accounts**: access is one shared team
password, and the API actor is only `you` or `claude`. Roles cannot be
enforced against users that do not exist, and inventing an auth system
was explicitly out of scope for this stage.

What is true today:
- Every route checks the actor server-side, not in the UI.
- The agent (`claude`) is structurally barred from confirming its own
  proposed follow-ups.
- Recording access runs through one permission-checked route, so when
  roles arrive, that single function is where they attach.

Until then, anyone with the team password can play any recording. This
should be understood before recordings are enabled at scale.

---

## 8. AI extraction

Quo's transcript and summary are the source. We never re-transcribe
audio.

The extraction is validated against a strict Zod schema
(`src/lib/quo/extraction-schema.ts`) and the model is instructed, in
priority order, never to invent a budget, location, product model or
date; never to record stock or freight as confirmed unless the call
actually confirmed it; and to set `needsHumanReview` whenever anything
material is unclear. Absent values are `null` — a plausible guess is
treated as a defect, and the schema rejects out-of-range values rather
than clamping them.

Output is written to `CallExtraction`, which is **separate** from Quo's
artifacts. A human editing the CRM note never overwrites the provider's
original, and a re-run never overwrites a human's edit.

The follow-up is created as an `HqTask` with status `suggested` — the
hub's existing "propose, don't act" state. Nothing is sent to a customer;
outbound still goes through `Approval`.

---

## 9. Setup

1. **Quo API key** — Quo → workspace settings → API → generate. Requires
   owner/admin. Set `QUO_API_KEY`.
2. **Enable the integration** — `QUO_INTEGRATION_ENABLED=true`.
3. **Register the webhook** — open `/integrations/quo`, press *Test API
   connection* to confirm the key, then register a webhook pointing at
   `https://<your-host>/api/integrations/quo/webhooks`.
   Quo returns the signing secret **once**. Copy it into
   `QUO_WEBHOOK_SECRET` and redeploy. It is never stored in the database.
4. **Restrict numbers** (optional) — `QUO_PHONE_NUMBER_IDS=PN…,PN…`.
   Empty means all numbers.
5. **Region** — `QUO_DEFAULT_REGION` (default `US`) is used only for
   parsing numbers typed into the CRM; Quo always sends E.164.
6. **Normalise existing numbers** — run `backfillNormalisedNumbers()` so
   pre-existing records match on inbound calls.
7. **Recording consent** — see §12 before enabling recording.

For local development, Quo must be able to reach your machine; use a
tunnel and register that URL as a second webhook.

---

## 10. Deployment

Migrations: `20260727134815_quo_call_integration` exists for both
schemas.

The SQLite migration was **hand-rewritten**. Prisma generated a
`RedefineTables` block that would have dropped and rebuilt `Supplier` —
the real FDS dataset — which decision D1 forbids. It is now plain
`ALTER TABLE … ADD COLUMN`, verified against a 100-record database with
row counts unchanged.

Production (per `docs/DEPLOYMENT.md` and the existing convention): the
Vercel build does **not** run `prisma migrate deploy`, because the prod
connection string is the pgBouncer transaction pooler and migrations
hang on it. Apply
`prisma/postgres/migrations/20260727134815_quo_call_integration/migration.sql`
out of band against Supabase, insert the matching `_prisma_migrations`
row, and note that the file already includes the
`ENABLE ROW LEVEL SECURITY` statements needed to match every other
table's deny-all posture.

A new cron entry (`/api/cron/quo-drain`, every 10 minutes) is in
`vercel.json`. On a Vercel plan limited to daily crons, reduce the
frequency — the webhook path does the real-time work, and cron is only
the safety net.

### Rollout order

1. Local, with a tunnel and a test number
2. One internal Quo number, one or two users
3. A short reconciliation over recent calls
4. Full team

### Rollback

Set `QUO_INTEGRATION_ENABLED=false`. That stops webhook processing (the
endpoint acknowledges and discards), background sync, AI extraction and
the incoming-call alert, in one switch. `QUO_AI_EXTRACTION_ENABLED=false`
disables only the AI pass, keeping call sync.

Disabling deletes nothing. Every call, recording reference, transcript
and note already stored stays exactly where it is.

---

## 11. Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `QUO_INTEGRATION_ENABLED` | yes | Master switch; also the rollback |
| `QUO_API_KEY` | yes | Workspace API key. Server-only |
| `QUO_WEBHOOK_SECRET` | yes | `whsec_…` signing secret |
| `QUO_API_BASE_URL` | no | Defaults to `https://api.quo.com` |
| `QUO_PHONE_NUMBER_IDS` | no | Restrict sync to specific numbers |
| `QUO_DEFAULT_PHONE_NUMBER_ID` | no | Default outbound/sync number |
| `QUO_DEFAULT_REGION` | no | Parsing region for CRM-typed numbers |
| `QUO_RECORDING_STORAGE_MODE` | no | `provider` only — see limitations |
| `QUO_AI_EXTRACTION_ENABLED` | no | Defaults on; disable the AI pass alone |

---

## 12. Privacy, recording and retention

Recordings and transcripts are sensitive customer data and are treated as
such: access-controlled, proxied, never logged, never cached by a shared
cache.

`CallArtifact.retentionDeleteAt` exists so a retention policy can be
applied, but **no sweep job is implemented yet** — see limitations.

**FDS must confirm the recording-consent law for every region it calls
into.** Several jurisdictions require all-party consent, and the
requirement follows the customer's location, not the company's. This
software cannot make that determination and none of this is legal advice.

---

## 13. Known limitations

1. **No per-user roles.** The hub has no user accounts. Anyone with the
   team password can play any recording. (§7)
2. **No outbound calling from the CRM.** Quo's API cannot start a call;
   the button hands off to the Quo desktop app. (§4)
3. **The AI half needs a Business plan.** On Starter there is no
   transcript, so there is no AI note and no proposed follow-up — every
   other feature works. Quo's own `nextSteps` needs Scale regardless;
   our extraction covers that gap on Business. See §3.
4. **The unified webhook API is in open beta.** Event names and payload
   shape are pinned to version `2026-03-30`, but Quo may change the beta.
   The delivered envelope is parsed defensively (both the documented
   nested `data.*` shape and the flat shape shown in Quo's own example
   are accepted) because their documentation is inconsistent on this
   point. Worth confirming against a real test delivery.
5. **Recordings are not copied to our own storage.** The project has no
   object store; `QUO_RECORDING_STORAGE_MODE` accepts only `provider`.
   If Quo deletes a recording, it is gone — the row remains, and the
   proxy returns 410.
6. **No retention sweep.** The column exists; the job does not.
7. **Reconciliation is bounded and indirect.** Because calls cannot be
   listed directly, it walks conversations first and is capped
   (conversations, calls, pages). A very busy period could exceed the
   window; the settings page reports when a run was truncated rather
   than pretending it was complete.
8. **Messages are stored but not acted on.** SMS events are recorded as
   `WebhookEvent` rows and skipped; the MVP is calls.
9. **The incoming-call alert polls** every 8 seconds rather than using a
   push transport, because the hub has no pub/sub layer. Worst-case
   latency is a few seconds.
10. **Rate limiting is per-instance.** The client paces itself to stay
    under 10 req/s, but several serverless instances could collectively
    exceed it; 429 is therefore also handled as retryable.

---

## 14. Tests

`npm test` — 88 tests, no network and no Quo credentials required.

Unit: phone normalisation (including that a shared numeric suffix is
*not* a match), signature verification (tampered body, wrong secret,
replay, rotation, malformed headers), envelope parsing in both shapes,
missed-call inference, status ordering, extraction schema, note
building.

Integration, against a real SQLite database built from the committed
migrations: unknown caller → exactly one lead; repeat callers → still one
lead; concurrent calls → still one lead; existing lead matched; duplicate
delivery is a no-op; a late `call.ringing` cannot undo a completed call;
a recording arriving before its call still lands; multi-segment
recordings stored once each; transcript speaker separation preserved;
`nextSteps` stays empty on Business; missed flag latches; the interaction
log gets exactly one entry.
