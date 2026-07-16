# FDS — Supplier Sourcing & Qualification SOP

### Where new high-ticket ag suppliers come from and the checklist that gates them into the pipeline.

> **When this triggers.** A sourcing task is queued ("recruit 15 trailer suppliers"), a supplier declines and needs replacing, or a category gap opens. Output: `SOURCED` records that either pass to `QUALIFIED` or get parked with the reason logged.

---

## 1. Where to source

- **Category-first:** work from the store's Collection Map (Import SOP §4.2) — source for the categories being built, not randomly.
- Manufacturer/dealer directories, "become a dealer" pages, industry associations, competitor brand lists (brands competitors carry are proven dropship-friendly), and the master course's supplier-research patterns.
- Every find enters the CRM as `type: supplier`, `status: SOURCED`, with `source: sourced`, the website URL, and the niche.

## 2. The qualification checklist (all must pass → `QUALIFIED`)

| Check | Pass condition | Feeds field |
|---|---|---|
| **High-ticket fit** | Core products ≥ $1,000 | `bestSeller`, cluster |
| **Dealer program** | Dealer/reseller program exists (or strong dropship signals) | `dealerProgram` |
| **Dropship viability** | Ships single units freight/LTL direct to customer | `dropship`, `freightModel` |
| **Warranty** | Manufacturer warranty stated | `warranty` |
| **MAP sanity** | No policy that makes online resale impossible | `mapPolicy` |
| **Category fit** | Lands in an existing or planned collection | `productCategories` |
| **US coverage** | Ships/serves the continental US | notes |

Failures don't get deleted — they stay `SOURCED` with the failing check in `notes`, or `DECLINED` if definitively unfit, so nobody re-sources them.

## 3. Rules

- **No guessing:** a checklist item that can't be verified from their site/materials is logged as unknown (`dealerProgram: unknown`), not assumed. Unknowns are questions for the first-contact email — they don't block outreach, but a fabricated "pass" is worse than an unknown.
- Rank new finds Gold/Silver/Bronze by revenue potential × dropship-friendliness, mirroring the original sheet's rubric.
- Set `context_summary` (who they are, what they'd fill) and `next_action` ("Draft first contact") before leaving the record.
