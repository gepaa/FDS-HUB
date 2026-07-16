# Farming Direct Supply — AI Operations HQ

### System Blueprint & Architecture

> **What this document is.** The design for turning FDS into a business where you assign work to an AI project manager, it dispatches worker agents to actually do the work overnight, keeps a CRM in sync with Shopify and Gmail, and messages you when it needs a human. It is the foundation the CRM data model and the dashboard prototype build on.
>
> **Who it's written for.** You (the operator) and any future Claude chat that needs to understand the whole system without you re-explaining it. It sits alongside the existing `FDS_Operations_Log.md` and `FDS_Product_Import_SOP.md` — same spirit, same role: the project's memory.

---

## 1. The honest frame: what's real and what needs care

You described three things. Two are fully buildable today; one needs a specific design to be safe.

**Fully buildable now**

- A headquarters where Claude holds all the business context, keeps it updated, and executes tasks you assign.
- A CRM synced to Shopify (orders, customers) and Gmail (supplier and lead threads), with real-time status per lead/supplier and a clear "what needs to happen next."
- A dashboard where you see tasks, pipeline, and Claude's activity.
- A chat channel where Claude gives you updates and pings you when it needs something.
- A project-manager agent that reads the queue, plans, and launches worker agents to do research, drafting, catalog work, and follow-up logic.

**Needs a specific design (the supplier-outreach piece)**

You want Claude to talk to suppliers "human-to-human" and handle it by itself. The *thinking* part of that — deciding who to contact, what to say, when to follow up, reading their reply, adjusting tone, escalating to a call — Claude does genuinely well and can run overnight. The part that carries real risk is the **actual send from your real domain with zero human in the loop**:

- **Deliverability.** A brand-new automated sender that emails a batch of cold suppliers overnight is exactly the pattern spam filters punish. Get flagged once and *all* your mail — including the orders you care about — starts landing in spam. This is a slow, expensive hole to climb out of.
- **Relationship risk.** These are $1,000+ freight suppliers you want to become authorized dealer relationships with. One off-key autonomous message to the wrong supplier can cost a relationship you can't easily rebuild.
- **Account risk.** Gmail/Workspace terms and sending limits are not friendly to unattended bulk automated outbound. You can get rate-limited or suspended.

**The design that gets you 95% of the dream without the downside:** Claude does *all* the work autonomously overnight — research, first-draft, follow-up decisions, reply reading, deciding it's time for a call — and **queues each outbound message for a one-tap approval**, or auto-sends only within a tightly-scoped safe lane (defined in §5). You wake up, glance at a queue, tap approve, and 90 seconds later Claude resumes. You still sleep; the work is still done; nothing leaves your company that you didn't wave through. As trust builds and deliverability is proven, you widen the auto-send lane. This is a dial you turn up over time, not a yes/no switch you flip on day one.

This isn't Claude being cautious for its own sake — it's protecting the one asset the whole FDS model runs on: **your ability to reach a human buyer's inbox and a supplier's goodwill.**

---

## 2. The core idea in one picture

```
                         ┌─────────────────────────────┐
          YOU  ───────►  │        THE HQ (web)         │  ◄─── you assign tasks,
       (approve,         │  Dashboard · CRM · Chat ·   │       approve sends,
        take calls)      │  SOP library · Task queue   │       answer Claude's asks
                         └──────────────┬──────────────┘
                                        │
                                        ▼
                         ┌─────────────────────────────┐
                         │   PROJECT-MANAGER AGENT      │   reads the queue, plans,
                         │   ("the PM")                 │   decomposes work, dispatches
                         └──────────────┬──────────────┘
                    ┌──────────┬────────┼────────┬──────────┐
                    ▼          ▼        ▼        ▼          ▼
               Supplier    Catalog   Lead/    SEO /     Ops / QA
               Outreach    Content   CRM      Content   Audit
                agent       agent    agent     agent     agent
                    │          │        │        │          │
                    └──────────┴────────┴────────┴──────────┘
                                        │
                    reads/writes ▼      ▼ notifies you
              ┌─────────────────────────────────────────┐
              │  CONTEXT LAYER (the business's memory)   │
              │  Ops Log · Import SOP · CRM records ·    │
              │  Ahrefs data · outreach SOPs · dictionaries│
              └─────────────────────────────────────────┘
                                        ▲
                        syncs ──────────┼──────────
                     Shopify        Gmail         Ahrefs
                   (orders,       (supplier &    (keyword
                    customers)    lead threads)   data)
```

**The one rule that keeps this clean (mirrors your Import SOP):** the PM *decides and dispatches*; worker agents *execute one job well*; the context layer is the *single source of truth*; and **anything that leaves the company (an email, a published product, a price) passes a gate** — either an auto-send safe-lane rule or your one-tap approval. Decisions and drafting are autonomous; irreversible external actions are gated.

---

## 3. The five layers

### Layer 1 — Context (the memory)

Everything Claude knows about FDS, kept current. This already exists in seed form (Ops Log, Import SOP, Ahrefs docs). The HQ makes it live and writable so Claude updates it as work happens.

Contents: business frame (high-ticket, lead-gen, store = top of funnel), locked architecture decisions, the collection map + tag dictionary, the metafield contract, the Ahrefs priority keywords, the CRM records, and a growing library of SOPs (§6). **The PM reads this before planning anything; workers read the slice relevant to their job.**

### Layer 2 — The Project-Manager agent (the PM)

The always-on brain. On a schedule (e.g. every night, plus on-demand when you assign a task) it:

1. Reads the task queue and the CRM for anything needing action (stale supplier, new lead, overdue follow-up).
2. Reads the context layer so its plan fits FDS reality.
3. Decomposes each task into worker jobs with clear inputs/outputs (exactly like the Stage-1/Stage-2 split in your Import SOP).
4. Dispatches worker agents, collects their output, updates the CRM and task board.
5. Queues anything that needs your approval and writes you a morning brief in the chat.

The PM never sends external mail or publishes products itself — it routes those to the gate.

### Layer 3 — Worker agents (the hands)

Each does one job well, so quality stays high (your two-brain principle, generalized):

- **Supplier Outreach agent** — finds/qualifies suppliers, drafts first contact and follow-ups, reads replies, decides when it's phone-call time, prepares your call brief.
- **Catalog Content agent** — runs Stage 1 of the Import SOP: turns a raw supplier list into a finished, metafield-complete import file.
- **Lead/CRM agent** — watches Gmail + Shopify, classifies new leads, keeps each record's status and next-action current, drafts lead replies and quote follow-ups.
- **SEO/Content agent** — buyer guides, blog posts, product copy from the Ahrefs keyword data.
- **Ops/QA agent** — runs the audit checklists, flags anything empty/misfiled, sanity-checks before things reach you.

Workers are prompts + tools + the relevant SOP. Adding a capability = adding a worker + its SOP, not rebuilding the system.

### Layer 4 — The gate (what protects the business)

A single checkpoint every *outbound, irreversible* action passes through:

- Outbound email to a supplier or lead
- Publishing a product live (vs. draft)
- Sending a price/quote
- Creating a discount

Each gated item lands in an **Approvals queue** with full context (who, why, the draft, what happens on approve). You approve/edit/reject in one tap. Everything *up to* the gate — research, drafting, follow-up logic, CRM updates, catalog prep — is autonomous. This is the same philosophy as "products stay DRAFT until verified" in your Import SOP, applied to communication.

### Layer 5 — The interface (the HQ website)

Where you live: **Dashboard** (today's state), **CRM** (leads + suppliers pipeline), **Approvals** (one-tap queue), **Chat** (Claude ↔ you), **Task queue** (assign work), **SOP library** (how Claude does everything). The dashboard prototype in this package shows this concretely.

---

## 4. How "Claude works while you sleep" actually runs

A concrete night, so it's not abstract:

1. **10:00 PM — you assign work** in the HQ: *"Recruit 15 new tractor-implement suppliers this week; follow up with everyone we've already contacted."*
2. **The PM plans.** Reads the CRM: 8 suppliers contacted, 3 replied, 2 went quiet, 3 never answered. It builds a job list.
3. **Overnight, workers run.** The Outreach agent researches new suppliers from the target category, drafts personalized first-contact emails, drafts follow-up #2 for the quiet ones, and reads the 3 replies that came in — one wants a call, one asked for your reseller certificate, one said no.
4. **Everything external is drafted and queued, not sent** (or auto-sent only within the §5 safe lane).
5. **Claude messages you** in chat: *"12 supplier emails drafted and queued for approval. Cimarron replied and wants a call — brief is ready, best window is Thu AM ET. Baumalight asked for your reseller cert; I've drafted the reply, just attach the doc. One supplier declined; I've logged it and lined up two alternates."*
6. **7:00 AM — you spend 10 minutes:** approve the queue, tap "call" on the Cimarron brief when you're ready, attach the cert. Claude resumes and sends the approved batch on a human-paced schedule.

The result: a full night of qualified outreach, follow-up, reply-handling, and call prep — done — with your judgment applied only where it matters and where it's legally/relationally yours to apply.

---

## 5. The autonomy dial (your specific request, made safe)

You asked for Claude to act human-to-human and handle it itself. Here's how to get there **without** betting your inbox reputation on night one. Autonomy is a dial with four notches; you start low and turn it up as each safe lane proves itself.

| Notch | What Claude does unattended | What still needs you | When to use |
|---|---|---|---|
| **0 — Draft only** *(start here)* | All research, drafting, follow-up logic, reply reading, CRM updates, call briefs | Approve every outbound send (one tap) | Weeks 1–2, while warming the domain and proving deliverability |
| **1 — Safe-lane auto-send** | Auto-sends **replies to suppliers who already emailed you** and **follow-ups to threads already in progress** (replying is deliverability-safe; those addresses already know you) | Approve *first contact* to a brand-new cold supplier | Once a few dozen sends have gone clean |
| **2 — Widened lane** | Auto-sends first contact to new suppliers **in batches of N/day on a warmed domain**, throttled and human-paced | Approve anything unusual: a "no," a price/quote, a legal doc, an angry thread | Once the domain is warmed and deliverability is stable |
| **3 — Supervised autonomy** | Runs the whole outreach loop; only surfaces exceptions and call-ready leads | Take the calls; approve quotes/prices/legal | Steady state, once you trust the patterns |

**Hard stops that never auto-send at any notch** (always your call): sending a **price or quote**, anything with a **legal/contract** attachment, replying to an **upset or escalating** thread, and **first contact at volume from a cold domain**. These are the actions where a mistake is expensive and irreversible — precisely the ones your Import SOP would keep in "DRAFT until verified."

**The deliverability groundwork that makes notches 1–3 possible** (do this before turning the dial up): use a **dedicated sending domain or subdomain** for outreach (never your main store/checkout domain — protect that at all costs), set up **SPF, DKIM, and DMARC**, **warm the domain** by ramping volume slowly over ~2–4 weeks, and keep outreach volume human-paced. This is standard cold-outreach hygiene; skipping it is what turns "AI does my outreach" into "my email stopped working."

---

## 6. The SOP library — how Claude knows how to do everything

Your instinct is exactly right: Claude executes reliably when the "how" is written down, not improvised. You already have two excellent SOPs. The HQ needs a small library so every recurring job has a playbook a worker agent follows. Each SOP is a short doc: *when it triggers, the steps, the inputs it needs, the output it produces, and the gate/QA before anything ships.*

**Already written (reuse as-is):**

- **Product Import SOP** — raw catalog → finished import file → store build. The gold standard; other SOPs should match its structure.
- **Ahrefs Analysis SOP** — keyword/priority work.

**To write next (drafts can be generated from your existing docs):**

1. **Supplier Sourcing & Qualification SOP** — where to find high-ticket ag suppliers, the qualify checklist (freight terms, warranty, MAP policy, dealer program, drop-ship willingness), how they enter the CRM.
2. **Supplier Outreach SOP** — the message sequence (first contact → follow-up cadence → "let's talk" → call prep), tone rules, what escalates to a human call, what never auto-sends.
3. **Lead Handling SOP** — when a store lead/quote request comes in: classify, respond, what info to capture, when to push to a call, follow-up cadence.
4. **Quote & Call-Prep SOP** — the brief Claude assembles before you call anyone (their context, history, what they want, your talking points, the number to hit).
5. **Daily/Nightly Run SOP** — what the PM does on each scheduled run and what the morning brief must contain.

These live in the context layer and are versioned like the Ops Log. **A new capability is a new SOP + a worker that follows it.**

---

## 7. Platform recommendation (you asked me to advise)

**Recommendation: a hybrid — start Claude-native this week, graduate the interface to Fable once the workflows are proven.** Here's the reasoning, then the tradeoffs.

**Why not "just build it all in Fable first":** Fable (or any web-app builder) gives you a beautiful custom interface, but the *hard, valuable* parts of your vision aren't the UI — they're (a) the scheduled overnight agents, (b) the connectors to Shopify/Gmail/Ahrefs, (c) the approval gate, and (d) the SOP-driven worker orchestration. Those already exist as native Claude capabilities right now: scheduled tasks, live connectors, agent dispatch, and persistent artifacts. If you pour weeks into a bespoke site first, you're rebuilding plumbing that already works — the exact mistake your Ops Log warns against ("scratch = rebuilding invisible plumbing").

**The hybrid path:**

| Phase | Home | You get |
|---|---|---|
| **Now → 2 weeks** | **Claude-native.** HQ = a persistent dashboard artifact pulling Shopify/Gmail/Ahrefs live, + scheduled nightly agents + the chat/approvals here. | A *working* system in days. Real overnight runs. Real CRM sync. You learn what you actually need before committing to a design. |
| **Once proven** | **Fable front-end** over the same engine, if you want a branded, multi-user, always-on website with logins for a team. | The polished HQ website you pictured — but now built to match workflows you've validated, not guessed at. |

**Fable's real strengths** (worth it later): a persistent hosted URL your whole team logs into, custom branding, multi-user roles, and a UI exactly to your taste. **What it doesn't replace:** the connectors, the scheduler, and the agent engine — those keep running underneath whatever front-end you choose. So Fable becomes the *face*; Claude stays the *engine*.

**Bottom line:** don't let building the website delay having the system. Get the engine running native this week (the dashboard prototype in this package is step one), prove the overnight loop, then dress it in Fable when the shape is settled. If you'd rather go straight to Fable, that's viable too — I'll hand you the exact data model and component spec — you'll just wait longer for the first real overnight run.

---

## 8. Build sequence (what to do in what order)

1. **Foundation — context + SOPs** *(this package starts it).* Blueprint (this doc), CRM data model, and the 5 new SOPs drafted from your existing docs. → *Claude can reason about the whole business.*
2. **The engine — connectors + nightly PM run.** Wire Shopify + Gmail live, stand up the PM as a scheduled task with the Nightly Run SOP, at **autonomy notch 0 (draft only)**. → *First real overnight run: research + drafts + morning brief, nothing sent.*
3. **The interface — HQ dashboard + approvals + chat.** The prototype here, made live against the connectors. → *You can see state and approve in one place.*
4. **Deliverability groundwork — dedicated domain, SPF/DKIM/DMARC, warm-up.** → *Unlocks turning the autonomy dial up.*
5. **Turn the dial — notch 1, then 2.** Widen the auto-send safe lane as deliverability proves out. → *Less approving, same safety.*
6. **Graduate to Fable** (optional) once workflows are validated. → *Branded, team-ready HQ website.*

---

## 9. Risks & how the design handles each

| Risk | How the design handles it |
|---|---|
| Automated outreach tanks email deliverability | Dedicated sending domain (never the store domain), SPF/DKIM/DMARC, domain warm-up, human-paced volume, start at draft-only |
| An agent sends something off-key to a supplier | The gate: outbound is drafted + queued; hard-stops (price/legal/"no"/cold-volume) never auto-send |
| Claude acts on stale/ wrong context | Context layer is the single source of truth; PM re-reads it each run; SOPs pin the "how" |
| Catalog/store gets messy from autonomous edits | Reuse the Import SOP's DRAFT-until-verified + QA gate + post-import audit; nothing publishes live without your say |
| System becomes a black box you can't trust | Every run writes a morning brief; every gated action shows its full reasoning; you can always see *why* |
| Over-investment in UI before workflows are proven | Hybrid platform path: native engine now, Fable face later |

---

## 10. What's in this package

1. **`FDS_HQ_Blueprint.md`** — this document.
2. **`FDS_CRM_Data_Model.md`** — the CRM structure: leads + suppliers, statuses, context fields, next-action logic, and how Shopify + Gmail map in. Build-ready for Fable or a Claude artifact.
3. **HQ Dashboard prototype** — a live, clickable artifact showing the dashboard, CRM pipeline, approvals queue, chat, and SOP library, populated with FDS-realistic sample data.

*Keep this doc current alongside the Ops Log. It's the reason a future chat understands the whole HQ without you re-explaining it.*

---

## Workspace addendum (2026-07-15 — added during the build; see docs/FDS_HQ_Decisions.md for all locked decisions)

**Gmail connector constraint (affects §5, the autonomy dial):** the authorized Gmail connector is **read + create-draft only — it cannot send.** At notch 0 this enforces the gate mechanically: Claude drafts in Gmail, Pablo taps Send. At notch 1+ the auto-send path is the dedicated sending subdomain via an email service (SPF/DKIM/DMARC — the §5 deliverability groundwork), **not** the Gmail connector. Do not attempt to bolt send onto Gmail.
