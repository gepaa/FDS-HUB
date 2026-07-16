# FDS SOP Library — Index

The playbooks each worker agent follows. Copy all of these into the repo's `docs/` (per the Phase 3 plan) so the context layer lives in version control. Each SOP states when it triggers, the steps, inputs/outputs, and the gate/QA.

## The three business engines → which SOP runs

**Engine 1 — Supplier**
- **Supplier Sourcing & Qualification** — find suppliers, qualify on the 4 criteria, rank Gold/Silver/Bronze, enter CRM. *(course-grounded, verbatim method)*
- **Supplier Outreach** — message sequence, follow-ups, escalate to call, dealer approval. *(scaffold — replace with your pitch deck/template)*
- **Product Import** — raw catalog → finished import file → store build. *(already existed — your gold standard)*

**Engine 2 — Website**
- **Store Build & Theme Change** — the `pull → dev → push → publish` rhythm, locked safety rails. *(from Ops Log)*
- **Product Import** *(shared with Engine 1)*

**Engine 3 — Traffic → Leads → Sales**
- **Google Ads Research & Campaign** — keywords → structure → ad copy → optimize. *(parked: needs Ads connector + Ahrefs units)*
- **Ahrefs Analysis** — keyword/priority research. *(already existed)*
- **Lead Handling** — capture → classify → respond → nurture → hand to you.
- **Product Answer Desk** — the sales co-pilot: verified product answers on tap. *(written earlier)*
- **Quote & Call-Prep** — the brief before any call; pricing inputs, you set the number.

**Operations**
- **Nightly Run** — the PM's cycle + the morning-brief contract.

## Cross-cutting rules baked into every SOP
- **The gate:** outbound email, publishing live, prices/quotes, discounts, ad spend — never fire autonomously; queued for one-tap approval. Supplier outreach ships at **notch 0 (draft-only)**.
- **The human owns the sale.** Claude does everything around it; you do the conversation and set every price.
- **No guessing.** Missing product/supplier data is flagged and logged, never invented (Import SOP discipline).
- **MAP is sacred.** No-MAP suppliers are excluded; we never advertise below MAP — we win on trust and expertise.

## Still to source from you (to upgrade scaffolds)
- Your **supplier pitch deck** + **current outreach email/template** → upgrades the Supplier Outreach SOP from scaffold to your real playbook.
- Your **pricing rule** preference → locks the Quote & Call-Prep framework.
- Your **team/sales routing** → locks Lead Handling ownership.
- The mentor's **outreach, phone-sales, and ads modules** aren't in the transcript — if you have them, they'd fill the three scaffolded areas with the real method.
