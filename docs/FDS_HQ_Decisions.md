# FDS HQ — Workspace Decisions Log

> Locked decisions made by Pablo on top of the four spec documents. Where this log and a spec doc disagree, **this log wins** (it is newer and explicitly approved). Every future session must read this before acting.

_Last updated: 2026-07-15 (build takeover session)._

## The locked decisions (D1–D8, approved 2026-07-15)

- **D1 — Preserve the 100-supplier dataset at all costs.** Every schema/pipeline change carries all 100 suppliers + 27 interactions forward. Back up `dev.db` before any migration. If a migration can't guarantee survival, stop and ask.
- **D2 — CRM refactored to the spec spine, not preserved off-spec.** Lead record type added alongside supplier; spine fields added (`owner`, `priority`, `context_summary`, `source`, `linked_thread`, `linked_shopify_id`); MVP field set from CRM Data Model §9 first. The existing `Interaction` log is the spec's `activity_log`.
- **D3 — Pipeline stages migrated to the spec ladders** with this mapping for existing data (old value preserved as a `legacy:<OLD>` tag):
  | Old | New | Note |
  |---|---|---|
  | NOT_CONTACTED (ranked) | Qualified | Already vetted + ranked in the sheet |
  | NOT_CONTACTED (unranked — ClearSpan only) | Sourced | Not yet vetted |
  | CONTACTED | Contacted | — |
  | PENDING_REPLY | Contacted | + follow-up `next_action` so the waiting state isn't lost |
  | APPLIED | In Conversation | Dealer application = active engagement |
  | APPROVED | Authorized Dealer | — |
  | LIVE | Authorized Dealer | + tag `status:live` |
  | REJECTED | Declined | — |

  Records whose notes imply they're further along are migrated mechanically; the PM's first hygiene run proposes corrections through the report channel. No silent hand-edits.
- **D4 — Architecture: app = interface + database + context store; Claude agent = engine.** The agent reaches Shopify/Gmail/Ahrefs via claude.ai connectors and reads/writes the app's data via the **internal REST API with a bearer token (`AGENT_API_KEY`)** — one audit choke-point, survives the Postgres/Vercel move, and a future Fable front-end consumes the same API. The app's env-var integration seams (`src/lib/integrations.ts`) stay as a dormant fallback.
- **D5 — Interface organized into the five HQ surfaces** (Blueprint §3 L5): Dashboard (morning brief), CRM (leads + suppliers), Approvals (the gate), Chat (agent-message feed — thin; true two-way chat stays in Claude for now), Task Queue, SOP Library. The existing design-system kit is kept. `docs/reference/fds_hq_dashboard.html` is the UX reference.
- **D6 — Parked, not built:** Accounting/P&L, Discord comms, Google Calendar. Placeholder pages stay, demoted to a "Parked" nav section.
- **D7 — Non-negotiables:** approval gate on every outbound/irreversible action (outbound email, product going live, price/quote, discount); supplier-outreach autonomy ships at **notch 0 (draft-only)** with the dial built but not widened; the human owns the sale and all pricing; no guessing product data — missing specs/warranty/compatibility are flagged and logged, never invented.
- **D8 — Import SOP:** `docs/FDS_Product_Import_SOP.md` (converted from the authoritative docx in `docs/reference/`) is the locked source for the two-stage catalog pipeline and the `custom.*` metafield contract.

## Implementation decisions (approved 2026-07-15)

- **Unified `Record` table** with `type` (`supplier` | `lead`), not two tables — a better implementation of the Data Model's "shared spine"; **the spec is considered updated to match.** Existing supplier-only fields (`cluster`, `rank`, `bestSeller`, `dealerAppUrl`) are kept as additive.
- **Migrations are additive-only against the data table.** The physical `Supplier` table name is kept via `@@map`; no physical table rename; generated migration SQL is inspected before applying and must contain no `DROP` of the data table. Migrations are tested on a copy of `dev.db` first, then applied to the real DB, then verified (exactly 100 records, 27 interactions, per-stage counts matching the D3 arithmetic). Any drift → stop and restore from backup, never patch forward.
- **Checkpoint before the engine goes live:** the first PM cycle runs supervised, is reported, and gets Pablo's explicit nod before the first unsupervised overnight run — even at notch 0. A fresh approval is required before any autonomy-notch increase.

## Connector constraints (verified 2026-07-15 — record so no future session re-litigates)

- **Shopify** connector: live (FDS · farmerdirectsupply.com · Basic · USD · Central).
- **Gmail** connector: live, but **read + create-draft only — it has NO send capability.** This is ideal for notch 0: human-in-the-loop is enforced mechanically (Claude prepares the draft in Gmail; Pablo taps Send). **When autonomy reaches notch 1+ (auto-send), the sending path is the dedicated sending subdomain via an email service with SPF/DKIM/DMARC — the deliverability groundwork in the roadmap — NOT the Gmail connector.** Do not try to bolt send onto Gmail.
- **Ahrefs** connector: authorized but the account is a trial with **0 API units** — keyword/data calls will fail until the plan is upgraded. Keyword work is parked; Pablo decides on upgrading before the SEO/Ads phase.
- **Google Ads:** no connector present; to be connected later (not blocking).

## Workspace history worth remembering

- 2026-07-15: the original workspace was damaged by an incomplete sync — git objects, all `src/app/api/**` route handlers, `SupplierDrawer.tsx`, and parts of `node_modules` were lost. Git was re-initialized (`main`, baseline commit `3b082ec`); `dev.db.backup` (100 suppliers + 27 interactions) is deliberately committed as the data safety net. The deleted routes/drawer were rebuilt against the reconciled schema, not restored.

## Addendum (2026-07-16) — authoritative SOP library adopted

- Pablo delivered the full course-grounded SOP set from his planning session; they **replaced** the interim drafts in `docs/sops/` verbatim (SOP_Supplier_Sourcing_and_Qualification, SOP_Supplier_Outreach, SOP_Lead_Handling, SOP_Quote_and_Call_Prep, SOP_Nightly_Run, SOP_Store_Build_and_Theme_Change, SOP_Google_Ads_Research [parked], SOP_Library_Index). The hub-specific mechanics live in `Hub_Agent_Interface.md`.
- **Rules now binding that the interim drafts lacked:** outreach order is **Bronze/Silver before Gold** (suppliers research the store; warm up on lower stakes); **MAP enforcement is a hard dealbreaker** for sourcing; **demo-product timing** — never display a brand's demo products while contacting that brand; prerequisites (store fullness, legitimacy assets) checked before any first contact.
- Outstanding upgrades Pablo will supply when ready: his real pitch deck + outreach template (upgrades the Outreach scaffold), his pricing rule (locks Quote & Call-Prep §4), team routing (Lead Handling §6).

## Addendum (2026-07-16, later) — outreach identity resolved + assets received

- **Canonical outreach identity: Ben Lockwood | Supplier Partnerships | Farmer Direct Supply** (legal entity Zeto International LLC, Cedar Hill TX; hello@farmerdirectsupply.com; (817) 587-4397). The Template Bank is explicit: use **"Farmer Direct Supply"** — never "Farmer Supply Direct" (the July 13 threads used the wrong order; correct it in all new drafts, but never alter an existing thread's subject line when replying).
- `docs/sops/Outreach_Email_Template_Bank.md` supersedes the scaffold scripts in SOP_Supplier_Outreach §2. Cadence per the bank: Day 0 → Day 3 → Day 8–10 (call request) → Day 17–20 (final), then re-engage date.
- **Signed Texas resale certificate** received; lives at `assets/business/Farmer_Direct_Supply_Texas_Resale_Certificate.pdf` — **gitignored; signed business documents never enter version control.** Attach only per the bank's §9 security policy (verified company-domain recipients / secure portals; never on unverified first contact).
