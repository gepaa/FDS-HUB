# FDS SOP — Nightly Run (the PM agent's cycle)

### What the project-manager agent does on each scheduled run, and exactly what the morning brief must contain.

> **When this SOP triggers.** On the scheduled overnight run (default: overnight US Central, brief ready by ~6–7 AM), plus on-demand when you assign a task. The PM agent runs this.
>
> **Role.** The PM is the brain that reads the queue and the CRM, plans, dispatches the worker agents, collects their output, updates the boards, and writes you the morning brief. It never sends external mail or publishes itself — it routes those to the Approvals gate.
>
> **Autonomy.** Everything up to the gate is autonomous. At **notch 0**, all outbound is drafted and queued. First live cycle runs **supervised** before any unsupervised overnight run.

---

## 1. The cycle, step by step

1. **Read context.** Load the SOP library + the CRM + the task queue. The PM re-reads context every run so its plan fits current reality (nothing acts on stale info).
2. **Scan for what needs action:** new leads, hot leads, stale suppliers, quiet threads past cadence, replies received, tasks you assigned, overdue next-actions.
3. **Plan & decompose.** Turn each task and each due next-action into worker jobs with clear inputs/outputs.
4. **Dispatch workers:**
   - **Sourcing** — find/qualify suppliers to hit assigned goals or refill the pipeline.
   - **Outreach** — draft first contacts and follow-ups (Bronze/Silver before Gold), read replies.
   - **Lead/CRM** — capture + classify new leads, draft responses, run nurture, flag hot ones.
   - **Content/SEO** — buyer guides / product copy when queued (Ahrefs-dependent work parked until units).
   - **Ops/QA** — run audits, sanity-check outputs before they reach you.
5. **Collect & update.** Write results back to the CRM (statuses, context summaries, next-actions) and the task board.
6. **Route to the gate.** Every outbound email, price/quote, publish, or discount goes to the **Approvals queue** with full context and reasoning — never fired by the PM.
7. **Write the morning brief** (§2) and post it to the Chat/Dashboard.
8. **Log the run** — what ran, what it produced, any errors, for auditability.

---

## 2. The morning brief — required contents

The brief is the single thing you read to run your day. It must contain, in this order:

1. **Headline** — the one or two things that matter most (a hot lead, a supplier who wants a call).
2. **What needs you** — the short list of human-only actions: calls to make, prices to set, docs to attach, approvals to tap. Each with the context to act in seconds.
3. **Approvals summary** — count and types queued (X first-contacts, Y follow-ups, Z replies), linked to the queue.
4. **Overnight results** — suppliers sourced, outreach drafted, leads captured, replies handled, briefs built. Concrete numbers.
5. **Pipeline movement** — notable status changes (new hot lead, supplier → In Conversation, a decline + its queued alternates).
6. **Flags & blockers** — anything stuck, missing (e.g. "Ahrefs units needed"), or needing a decision.
7. **Suggested next tasks** — things the PM recommends queuing, for one-tap approval.

Tone: concise, scannable, honest. If a run did little (quiet night), say so plainly — no padding.

---

## 3. Cadence & safety

- **Frequency:** nightly by default; you can add a midday run. Time-zone: US Central (store timezone).
- **Notifications mid-run:** if something is *hot* or needs a decision before morning (a ready-to-buy lead, an upset thread), the PM pings you in Chat rather than waiting for the brief.
- **Supervised first:** the first full cycle runs with you watching; unsupervised overnight runs begin only after you approve. A fresh approval is required before any autonomy-notch increase.
- **Gate integrity:** the PM has no send/publish capability of its own — those live behind Approvals. This is enforced structurally, not by policy.

---

## 4. Inputs, outputs, QA

**Inputs:** the task queue, the CRM, the SOP library, connector data (Shopify live; Gmail read+draft; Ahrefs when funded).
**Outputs:** updated CRM + task board, a filled Approvals queue, the morning brief, a run log.
**QA each run:** context re-read before planning; every outbound routed to the gate (nothing sent by the PM); every hot item surfaced; the brief covers all seven required sections; the run is logged.

*Orchestrates: all worker SOPs. Reports through: Chat + Dashboard.*
