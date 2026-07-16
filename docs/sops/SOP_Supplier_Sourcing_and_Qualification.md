# FDS SOP — Supplier Sourcing & Qualification

### How Claude finds high-ticket ag-equipment suppliers, qualifies them, ranks them, and enters them into the CRM.

> **When this SOP triggers.** You assign a sourcing goal ("find 15 new tractor-implement suppliers"), the pipeline runs low on Sourced/Qualified records, or a supplier declines and needs replacing. The Sourcing worker agent runs this.
>
> **Grounded in the course.** The method below is Jordan's actual Module 3 process (mine competitors → extract brands → qualify on 4 criteria → rank Gold/Silver/Bronze), adapted to FDS's agricultural niche and CRM. Quotes are his.
>
> **Output.** New `supplier` records in the CRM at status `Sourced` (or `Qualified` once vetted), each with the qualification data filled and a Gold/Silver/Bronze rank — ready for the Outreach SOP.

---

## 1. The sourcing method — reverse-engineer from competitors

Don't search supplier directories. Find stores already selling high-ticket ag equipment and harvest the brands they carry. Jordan: *"We literally just got 21 suppliers from one website."*

**Step 1 — Find competitor stores** (Google Shopping + web search).
- Search the product type ("3-point sprayers," "skid steer grapples," "high tunnel greenhouse kits"). Set region to United States.
- Scroll past the big brands "to where the bulk of the people are at the bottom."
- **Competitor tell:** if the niche keyword is in the store's company name/URL, *"99.999% chance they are a competitor."*
- **Dropshipper tell:** no physical address, simple layout, welcome pop-up, live chat, free shipping. *"The biggest culprit is no address."* These stores' suppliers are dropship-friendly — exactly who we want.

**Step 2 — Extract every brand/supplier from each competitor store.**
- Homepage: stores highlight their brands ("our partners / our brands" logo strips).
- Product titles: *"Stores will always, and I mean always, begin the title with the brand's name."*
- List every brand on the record sheet with its source store.

**Step 3 — Loop to expand.**
- Each supplier's own site often has an *"authorized dealer"* section = a list of more competitors.
- Search a specific brand in Google Shopping → surfaces more competitors → more brands.
- Recurring brands across many stores are *"golden suppliers… your personal golden winners."*

**Idea sources beyond competitors** (Module 2): everyday observation, Wayfair categories, and the ChatGPT prompt *"Give me a list of 20 high ticket products over $1,000… just the list of potential niches/product types."* For FDS the niche is fixed (agriculture), so this is for finding sub-categories and adjacent brands.

**FDS niche note:** the market report confirms accessible dealer-friendly suppliers exist here — Harvest Right (dealer program), LeisureCraft ("Become a dealer" online app), Homestead Implements (Affirm financing), plus the 100 already in the CRM. Extend the existing 8 category clusters; don't fragment.

---

## 2. The four qualification criteria (run every candidate through these)

| # | Criterion | Standard | Dealbreaker? | How Claude checks |
|---|---|---|---|---|
| 1 | **Price point** | Minimum $1,000; sweet spot ~$2,000–3,000+ | Under $1,000 → not a standalone supplier (only as accessory/upsell) | Scan the brand's range on Google Shopping / a competitor. Is the bulk high-ticket? ~10 min, doesn't need to be exact |
| 2 | **MAP (minimum advertised price)** | Brand enforces MAP | **YES — hard dealbreaker.** *"If a supplier has no MAP, it's a deal breaker. I do not work with suppliers that do not enforce MAP, period."* | Check if all stores sell the product at the same price on Google Shopping. If it's "one big mess," verify with a known competitor |
| 3 | **Brand search demand** | 1,000–5,000/mo = sweet spot · 100–1,000 = solid · >5,000 = very competitive · <100 = low but still worth closing | No | Ahrefs Keywords Explorer on the brand name, top branded keyword's monthly volume *(needs Ahrefs units — see note)* |
| 4 | **Competition level** | <15 stores = excellent · 15–30 = good · 30+ = competitive | No | Count stores selling the brand on Google Shopping |

**Why MAP is non-negotiable:** without it, competitors race to the bottom and *"neither one of us is making money."* MAP *"keeps a level playing field… may the best man win whoever provides better customer service and knowledge."* That's the FDS model exactly — we win on trust and expertise, not price. A no-MAP brand destroys that, so it's excluded no matter how good it looks otherwise.

**Additional FDS qualification fields to capture** (from the CRM Data Model + Import SOP): `freight_terms` (parcel vs LTL/freight — critical for $1,000+ items), `warranty_offered`, `dealer_program` (dropship / stocking / none), `media_permission` (do they provide approved images/feed — gates our image use), authorized-dealer requirements, and product-data availability (specs, manuals, images for the metafields). Avoid suppliers vague about warranty, shipping, or lead times; never build the store around a single supplier.

**Ahrefs note:** criterion 3 needs Ahrefs API units. The account is currently on a 0-unit trial, so brand-demand scoring is parked — Claude still sources and qualifies on criteria 1, 2, 4, flags demand as "pending Ahrefs," and backfills once units are available.

---

## 3. The ranking — Gold / Silver / Bronze

Jordan's exact tiers, which map to the existing CRM ranks on your 100 suppliers:

- **Gold** — enforces MAP · $2,000–3,000 price point · under 15 stores · 1,000–5,000 search demand · a bestseller for top competitors. *The "bread makers."*
- **Silver** — enforces MAP · $1,000–3,000 · over 15 stores · 100–1,000 search demand · a good seller for a top competitor.
- **Bronze** — does **not** enforce MAP and/or price point under $1,000.

*"Everything is a little bit moldable,"* but price and MAP dominate: no MAP or weak price → cannot be Gold. Rank is stored on the record and drives outreach order (next section + the Outreach SOP).

---

## 4. The outreach-priority rule (why rank matters)

Critical sequencing from the course — **do not start outreach with your best suppliers:**

> *"When it comes time to reaching out to these suppliers, we start out with bronze and silver… Once we get a couple of those approved and on the website and make our website more whole… then we reach out to those gold tier suppliers because those are the important ones… our bread makers."*

Reason: suppliers research your store before approving you (see Outreach SOP). A fuller store approves better. So you warm up on lower-stakes Bronze/Silver, build a credible catalog, *then* approach Gold. The Sourcing worker sets each record's rank so the Outreach worker pulls in the right order.

---

## 5. What Claude does vs. what needs you

- **Claude (autonomous):** all sourcing, brand extraction, criteria 1/2/4 checks, ranking, and writing records into the CRM at `Sourced`/`Qualified`. This is research — no gate needed.
- **You:** nothing during sourcing. Your first involvement is approving the outreach that follows (Outreach SOP). Optionally review the NEW-SUPPLIERS list in the morning brief.

---

## 6. Output contract (what a finished record looks like)

Every sourced record hands to the Outreach SOP with: company/brand, contact email + phone (researched), source store(s), price-point read, MAP status (✅/❌/unverified), competition count, brand-demand (or "pending Ahrefs"), freight/warranty/dealer-program/media notes where findable, Gold/Silver/Bronze rank, `product_categories` (mapped to the Collection Map), and status `Sourced` or `Qualified`. Anything unverifiable is flagged, never guessed — same discipline as the Import SOP.

---

## 7. QA gate before a batch is "sourced"

- No brand added that fails the MAP dealbreaker (unless deliberately tagged accessory/upsell).
- No duplicates against the existing 100 (dedupe by brand/company).
- Every record has a rank and at least a contact path (email or a "find contact" next action).
- Categories map to the existing Collection Map — extend, don't fragment.
- Records that can't be qualified (missing MAP/price data) stay `Sourced` with a "verify MAP" next action, not promoted to `Qualified`.

*Feeds directly into: **SOP — Supplier Outreach.***
