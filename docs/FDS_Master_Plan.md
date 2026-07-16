# Farming Direct Supply — Master Plan

### From ideas to an actionable build: the AI-run operating system for FDS

> **What this document is.** Your ideas, structured. You described a business that runs on three engines, a clean split between what Claude does and what you do, and a headquarters that ties it all together. This turns that vision into a concrete, phased, buildable plan — what to build, in what order, what it connects to, and the exact next actions. It builds on the Claude Code workspace you've already started and sits alongside the Blueprint and CRM Data Model.
>
> **Store:** FDS · farmerdirectsupply.com · Shopify Basic · USD · Central time (connected ✓).

---

## 1. The business in three engines

Your whole operation is a pipeline of three engines. Value flows left to right; each one feeds the next.

```
   ENGINE 1                 ENGINE 2                 ENGINE 3
  ┌──────────┐            ┌──────────┐            ┌────────────────────┐
  │ SUPPLIER │  products  │ WEBSITE  │  traffic   │ TRAFFIC → LEADS →  │
  │  Get the │ ─────────► │  Sell the│ ─────────► │      SALES         │
  │ products │            │ products │            │ Ads · leads · close│
  └──────────┘            └──────────┘            └────────────────────┘
   recruit &               Shopify store,          Google Ads + SEO bring
   authorize               SEO, catalog,           leads; Claude nurtures;
   suppliers               product pages           YOU close on the call
```

**Engine 1 — Supplier.** Find high-ticket ag-equipment suppliers, qualify them, recruit them to authorized-dealer / dropship status, then load their catalog onto the store. *(Your Import SOP already owns the catalog-loading half of this.)*

**Engine 2 — Website.** The Shopify store that presents and sells: catalog structure, per-product SEO pages, trust, and dead-easy paths to a human. *(Your Ops Log owns this.)*

**Engine 3 — Traffic → Leads → Sales.** Google Ads + SEO drive buyers in; leads get captured and nurtured; the sale closes in a human conversation. This is where the money lands.

---

## 2. The division of labor (the core rule of the whole system)

You gave the single most important design principle: **Claude runs everything except the human sales conversation.** Here is that rule made exact — this table *is* the operating contract for the HQ.

| Area | Claude does (autonomously / gated) | You do (human only) |
|---|---|---|
| **Suppliers** | Source, qualify, draft outreach, follow up, read replies, prep call briefs | Take the supplier calls; approve dealer terms |
| **Catalog** | Stage-1 content, metafields, SEO, then Stage-2 build (per Import SOP) | Approve the import file; publish live |
| **Website** | Build/edit theme via Claude Code, product pages, nav, filters | Approve big structural changes; final publish |
| **SEO / content** | Keyword research (Ahrefs), buyer guides, blog posts, product copy | Approve direction |
| **Google Ads** | Research keywords, draft campaigns/ad copy, monitor, suggest changes | Approve spend & launch; final budget calls |
| **Leads (around the sale)** | Capture, classify, respond to routine Qs, follow up, remind, nurture | — |
| **The sale itself** | **Co-pilot only:** look up product facts, draft answers, prep you | **Close the deal.** The actual selling conversation is yours |
| **Product answers** | Look up any product in Shopify, answer the customer's question, hand you a ready reply | Send it to the customer (you stay the voice) |

**The line that matters:** Claude does everything *around* the sale — the research, the follow-ups, the reminders, the product lookups — so that when you're in the actual conversation, all you're doing is the one thing only a human should do: talking a person through a $3,000 decision. Everything else is handled or teed up for you.

**Why this split is right (and matches your course):** your master course is explicit that high-ticket wins on *education-based selling* and *getting to a human*. The store is the top of the funnel; the real conversion is a call. So automating the funnel and keeping the human on the close isn't a compromise — it's the model working as designed. Claude maximizes how many good leads reach you and how well-prepped you are; you convert them.

---

## 3. What Claude can actually touch (capabilities, grounded in what's connected)

| Capability | Status | What it unlocks |
|---|---|---|
| **Shopify** (products, orders, customers, collections, inventory, analytics, GraphQL) | ✅ Connected | The whole website + catalog engine, the product answer desk, revenue/lead data |
| **Ahrefs** (keywords, SERP, rank tracking, site audit, backlinks) | ⚠️ Needs authorize | Keyword research → SEO + Google Ads targeting |
| **Claude Code** (theme build, git, CLI) | ✅ You've started it | The actual store build — your "chat → see it on the store" loop |
| **Gmail** | ⚠️ Needs authorize | Real-time supplier + lead thread awareness → the autonomous overnight loop |
| **Google Ads** | ➕ To connect | Campaign research, monitoring, optimization suggestions |
| **Live chat / helpdesk** | ➕ To choose + connect | The product answer desk wired directly into the chat (Phase 2) |

*The three marked "authorize/connect" are the gating items for full autonomy — §7 lists them as the first actions.*

---

## 4. The four things the HQ must do (your feature list, structured)

Everything you've described collapses into four jobs the headquarters performs. The dashboard prototype already shows the shape; this is the definitive list.

**4.1 Hold the context and keep it current.** Every SOP, the collection map, the metafield contract, the Ahrefs data, the CRM, the store facts — one live memory Claude reads before acting and updates as work happens. *This is what makes it "tailored to your business," not a generic tool.*

**4.2 Run the work (PM agent + workers).** You assign tasks in plain language; the PM plans and dispatches worker agents overnight; results land on the board and in your morning brief. Covers Engines 1–3 minus the human close.

**4.3 The CRM — leads + suppliers, always live.** Synced to Shopify and Gmail. Every record shows status, context, and next action. The engine that lets Claude act on leads and suppliers even when you don't prompt it. *(Full spec in the CRM Data Model doc.)*

**4.4 The Sales Cockpit (new — your product answer desk).** The piece that makes *your* job easy. When a customer asks something, Claude pulls that product from Shopify — specs, freight, compatibility, warranty, lead time — and hands you a ready-to-send answer, so you never dig through the store mid-conversation. **Phased:** start inside the HQ (you paste the question, Claude answers), then wire it into the live-chat app once chosen. This turns the HQ from an ops tool into your real-time selling assistant. Fully specified in the companion **Product Answer Desk SOP**.

---

## 5. The SOP library (how Claude knows how to do everything, per engine)

Each recurring job gets a playbook a worker follows. Mapped to the three engines:

| Engine | SOP | Status |
|---|---|---|
| — | **Product Import SOP** | ✅ Exists (your gold standard) |
| — | **Ahrefs Analysis SOP** | ✅ Exists |
| 1 Supplier | **Supplier Sourcing & Qualification** | ⬜ To draft |
| 1 Supplier | **Supplier Outreach** (sequence, cadence, escalation, what never auto-sends) | ⬜ To draft |
| 2 Website | **Store Build / Theme Change** (Claude Code rhythm: pull→dev→push→publish) | ⬜ To draft (from Ops Log) |
| 3 Traffic | **Google Ads Research & Campaign** | ⬜ To draft |
| 3 Leads | **Lead Handling** (capture → classify → respond → nurture → hand to you) | ⬜ To draft |
| 3 Sales | **Product Answer Desk** (the sales co-pilot) | ✅ **Drafted in this package** |
| 3 Sales | **Quote & Call-Prep** (the brief before you call anyone) | ⬜ To draft |
| Ops | **Nightly Run** (what the PM does each run; morning-brief contents) | ⬜ To draft |

A new capability = a new SOP + a worker that follows it. Most of these can be drafted straight from your existing docs.

---

## 6. The phased roadmap

Sequenced so you get a working system fast, then widen it. Builds on your existing Claude Code workspace.

### Phase 0 — Foundation *(this package + a couple of hours)*
- Blueprint, CRM Data Model, Master Plan (this doc), first SOP — **done / in progress.**
- **You:** authorize Gmail + Ahrefs, connect Google Ads. Confirm what's already in your Claude Code workspace so we extend it, not duplicate it.
- **Outcome:** Claude can reason about the whole business and the connectors are live.

### Phase 1 — The engine runs *(week 1)*
- Draft the remaining SOPs (§5) from your docs.
- Stand up the **PM agent as a nightly scheduled run** at **autonomy notch 0 (draft-only)**.
- Wire the CRM MVP against Shopify (+ Gmail once authorized).
- **Outcome:** first real overnight run — suppliers sourced, outreach + follow-ups drafted, leads captured, a morning brief. Nothing sent without you.

### Phase 2 — The cockpit *(week 2)*
- Make the dashboard live against the connectors (tasks, CRM, approvals, chat).
- Turn on the **Product Answer Desk** inside the HQ.
- Add **Google Ads research** (keywords from Ahrefs → draft campaigns).
- **Outcome:** you run the day from one screen; product answers on tap; ads pipeline started.

### Phase 3 — Turn up autonomy *(weeks 3–4)*
- Deliverability groundwork: dedicated sending domain, SPF/DKIM/DMARC, warm-up.
- Move outreach to **notch 1 → 2** (safe-lane auto-send) as the domain proves out.
- Wire the answer desk into the chosen **live-chat app**.
- **Outcome:** less approving, same safety; the funnel runs largely on its own up to the human close.

### Phase 4 — Graduate the interface *(when workflows are proven)*
- Optional: rebuild the HQ face in **Fable** for a branded, team-login website over the same engine.
- **Outcome:** the polished HQ website you pictured — built to match validated workflows.

---

## 7. Next actions (concrete, ordered)

**Yours (unblock the build):**
1. **Authorize Gmail and Ahrefs** in your claude.ai connector settings. *(These turn on the autonomous supplier/lead loop and keyword research.)*
2. **Connect Google Ads** (or tell me to research the connect steps).
3. **Confirm the Claude Code workspace state** — send me what's there (theme? git? dev theme connected? any HQ scaffolding?) so the plan plugs into it.
4. **Pick a live-chat app** (or ask me to compare options) for the Phase-3 answer-desk wiring.

**Mine (say the word and I start):**
1. Draft the remaining SOPs (§5) from your existing docs — Supplier Outreach and Lead Handling first.
2. Wire the **PM nightly run** at draft-only and define the morning brief.
3. Add Google Ads + the Sales Cockpit to the dashboard prototype.
4. Set up the CRM MVP against your live Shopify store.

---

## 8. What "done" looks like

A single screen — your company's cockpit — where:

- You type what you need in plain language and Claude runs it overnight.
- Suppliers get sourced, contacted, and followed up automatically; you just take the calls.
- The store and its SEO get built and maintained by Claude.
- Google Ads and keywords are researched and optimized on autopilot.
- Every lead has a live status and a next action, worked whether or not you're online.
- When you're closing a sale, Claude is in your ear with every product fact you need.
- The only thing left for you is the part that was always yours: **talking to a person and closing the deal.**

That's the business you described — a full operating system for FDS, run by Claude, tailored entirely to you, always up to date. This plan is the path to it.

---

## Package contents

1. **`FDS_HQ_Blueprint.md`** — system architecture, the autonomy dial, the gate.
2. **`FDS_CRM_Data_Model.md`** — leads + suppliers schema, pipelines, Shopify/Gmail mapping.
3. **`FDS_Master_Plan.md`** — this document: the 3 engines, division of labor, roadmap, next actions.
4. **`FDS_Product_Answer_Desk_SOP.md`** — the sales co-pilot playbook (first new SOP).
5. **HQ Dashboard prototype** — the live, clickable interface.

*Keep this current alongside the Ops Log. It's the map for the whole build.*
