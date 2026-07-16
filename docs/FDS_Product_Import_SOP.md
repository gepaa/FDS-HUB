# Farmer Direct Supply — Product Import & Catalog Organization SOP

### The standard operating procedure for turning a raw supplier catalog into a fully organized, SEO-optimized, correctly collected Shopify store — at any scale.

**Two-stage pipeline: Content Chat (build the data) → Claude Code (build the store)**

> Converted to Markdown from the authoritative `FDS_Product_Import_SOP.docx` (kept verbatim in `docs/reference/`). Content preserved in full; formatting adapted.

---

## 0. How to use this SOP

This document exists so that importing a supplier catalog is never improvised. Every time a new catalog arrives — whether it's 40 products or 2,000 — the work runs through the same two stages and produces the same clean result: every product on the right template, in the right collection, sorted by brand, tagged for filtering, and written for Google to rank.

It is written for two different operators, and it's important not to confuse them:

- **Stage 1 — Content Chat.** A regular Claude chat (or sub-agent) whose only job is to turn the raw supplier list into a finished import file. It writes titles, descriptions, metafields, SEO, tags, and assigns collections. **It never touches the store.**
- **Stage 2 — Claude Code (build workspace).** Claude Code takes the finished file and executes it against Shopify through the CLI and the Shopify MCP: creates collections, imports products, attaches metafields, wires up navigation, uploads images. **It builds; it does not invent content.**

**The one rule that keeps this clean:** content is decided in Stage 1. Execution happens in Stage 2. Claude Code should never be writing product descriptions or inventing categories on the fly — if it has to, Stage 1 wasn't finished. This separation is what prevents a messy, half-filled, out-of-place catalog.

## 1. Ground truth — what already exists

Modeled on the file already built, `FDS_Final_75_Product_Content_and_Image_Links.xlsx`, which contains the exact structure every future import should follow. Reuse it; don't reinvent it.

| Sheet / artifact | What it defines | Role in this SOP |
|---|---|---|
| **Shopify Draft Import** | Native Shopify product CSV columns: Handle, Title, Body (HTML), Vendor, Product Category, Type, Tags, Published, Option1, Variant SKU, Variant Price, Image Src, Image Alt Text, SEO Title, SEO Description, Status, Source Product URL | The final output format of Stage 1. This is what Claude Code imports. |
| **75 Product Content** | The richer working sheet: Catalog ID, Brand, Primary/Secondary/All Collections, Target Keyword, Draft Description (HTML), SEO fields, Specification Status, Winner Status | The Stage-1 workbench where content gets drafted before it's collapsed into the import CSV. |
| **Collection Map** | Primary Collection → Secondary Collection → Product Count, handle, description, merchandising notes | The catalog taxonomy. The source of truth for what collections exist and what goes where. |
| **Image & Media Links** | Official product page, official gallery, approved Shopify image URL, Image Use Status, Supplier Media Requested | Image sourcing + the permission gate. Nothing goes live without an approved image status. |
| **Live metafield definitions** | 19 product definitions under the `custom.*` namespace, already defined in Settings → Custom data and already wired into the theme's product template (§3) | The fixed field contract. Stage 1 fills these exact keys; Claude Code never invents or renames them. |

**Locked business facts this SOP assumes (from the Operations Log):**
- FDS is high-ticket ($1,000+) agricultural equipment — closer to lead-gen than normal dropshipping. The store is the top of the funnel; the real conversion is a phone call or quote.
- The store's three jobs: rank on Google for thousands of product + buyer-intent searches, build trust for a big purchase, and make navigation + reaching a human dead easy.
- Products default to **DRAFT / Published = FALSE** until vendor authorization, variants, cost, price, freight and warranty are verified.
- Images are never uploaded from competitor or manufacturer sources until the supplier gives written permission or an approved media feed.

## 2. The pipeline at a glance

Every catalog import moves left to right through these phases. The gate between Stage 1 and Stage 2 is a human review: you don't hand a file to Claude Code until it passes the QA checklist in §8.

| Phase | Who runs it | Input | Output |
|---|---|---|---|
| A. Intake & normalize | Content Chat | Raw supplier list (CSV/PDF/URL dump) | Clean row-per-product working sheet |
| B. Taxonomy assignment | Content Chat + you | Working sheet + Collection Map | Every product mapped to Primary → Secondary collection (new ones flagged) |
| C. Content generation | Content Chat | Working sheet | Titles, HTML descriptions, metafields, tags, SEO for every product |
| D. Image resolution | Content Chat + you | Official product pages | Image status per product (approved / requested / placeholder) |
| E. QA & sign-off | You | Finished import file | Approved file + collection creation list |
| F. Collection build | Claude Code | Collection creation list | Parent + child collections live, filters configured |
| G. Product import | Claude Code | Approved import CSV | Products imported as DRAFT, metafields attached, images placed |
| H. Post-import audit | Claude Code + you | Live draft catalog | Audit report; nothing empty, nothing misfiled |

## 3. Metafield architecture — the heart of the design

The whole product page is driven by metafields so you never build a template per product. The FDS theme's product template is **already wired** to the definitions below — each metafield feeds a specific block on the page. The field list is not a proposal; it is fixed reality. Fill every field and the page renders complete; leave one blank and that block renders empty or collapses.

**Hard rule — match the live store exactly.** Every definition lives under the `custom` namespace (`custom.*`). Do NOT invent a new namespace and do NOT rename keys — the theme reads these exact keys, so a renamed or re-namespaced field silently shows nothing on the page. If Shopify and this list ever disagree, Shopify wins; update this doc.

### 3.1 Identity & source fields (pinned)

| custom.key | Field name | Type | What it holds / feeds |
|---|---|---|---|
| `catalog_id` | Catalog ID | single line text | FDS catalog ID (e.g. FDS-031). Primary key that ties the product to the import sheet. |
| `model_configuration` | Model / Config | single line text | Exact model / configuration code (e.g. CMMC2-165-3PT). Powers exact-match SEO + high-intent search. |
| `source_product_url` | Source URL | single line text | Supplier / competitor source page. Evidence trail for specs, images, and price verification. |

### 3.2 Product-page content fields (what the customer sees)

| custom.key | Field name | Type | What it holds / feeds on the page |
|---|---|---|---|
| `short_promise` | Short Promise | single line text | One-liner under the title (Solo Stove style). Benefit in one sentence. |
| `key_specs` | Key Specs | JSON — list of `{icon, label, value}` | Icon spec strip under the gallery. At-a-glance specs. |
| `spec_table` | Spec Table | JSON — list of `{group, label, value}` | Full grouped specifications table. Core buyer-comparison content. |
| `features_list` | Features List | list.text | Features & Benefits bullets. Each item 'Name \| benefit' style. |
| `whats_included` | What's Included | list.text | "Included with your purchase" box. Reduces pre-sale questions. |
| `who_its_for` | Who It's For | list.text | "Who this is for" checklist. Buyer self-selection (replaces the old 'best_for' idea). |
| `faq` | FAQ | JSON — list of `{q, a, category}` | Product FAQ accordion AND FAQPage schema. 5–10 real buyer objections. Major SEO + trust asset. |
| `warranty` | Warranty | rich text | Warranty accordion. **Verified terms only — never guessed.** |
| `brand_story` | Brand Story | rich text | Brand card. Short brand credibility block. |

### 3.3 Media & logistics fields

| custom.key | Field name | Type | What it holds / feeds on the page |
|---|---|---|---|
| `documents` | Documents | list.file_reference | Documents / manuals (PDF) block. Spec sheets, manuals. |
| `video_url` | Video URL | url | Video embed on the page. |
| `dimension_image` | Dimension Image | file_reference | Dimension drawing shown next to the spec table. |
| `lead_time` | Lead Time | single line text | "Usually ships in 20–25 business days" badge. Sets delivery expectation on freight items. |
| `accessories` | Accessories | list.product_reference | Optional Accessories module — links to compatible add-on products (raises AOV). |
| `accessory_group` | Accessory Group | single line text | Groups accessories to their parent product for the Accessories module. |
| `notes` | Notes | single line text | Internal ops notes. Not customer-facing; used for import bookkeeping. |

**Accuracy rule for metafields:** Google ranks each page on how relevant and complete it is to the searcher's query. That relevance lives in these metafields. So: no placeholder text, no guessed specs, no invented warranty. If a value isn't verified, **leave it empty and keep the product DRAFT** — never fill a field with a guess just to make the page look full. Accuracy over speed, every time.

### 3.4 Verification status — tracked in the sheet, not on the product

The product page has no 'spec status' field, deliberately. Verification status (verified / draft / needs-supplier) is tracked in the import spreadsheet's **Specification Status** column. Any product with unverified specs, warranty, or price stays DRAFT until confirmed with the supplier.

### 3.5 Two fields worth adding later (optional, not yet built)

| Proposed custom.key | Type | Why it's worth adding |
|---|---|---|
| `compatibility` | list.text | Tractor HP range, hitch category, machine fit, required accessories. Prevents mis-orders on freight items; can power storefront filters. |
| `freight_note` | multi-line text | Delivery access / unloading requirements (liftgate, forklift, etc.). Sets expectations before a big freight purchase. |

Until those exist, the description's bullet list and 'Before ordering' paragraph carry the compatibility and freight guidance.

## 4. Stage 1 — Content Chat: build the import file

**Goal:** one finished file where every row is a publish-ready product, matching the Shopify Draft Import schema, with every metafield filled. When you can hand this file to Claude Code without explaining anything, Stage 1 is done.

### 4.1 Intake & normalize
- One row per product. One SKU family = one row (variants become options, not new rows).
- Capture the source product URL for every row — the evidence trail.
- Flag anything under the $1,000 high-ticket threshold. It doesn't get its own product unless it's a deliberate accessory/upsell.
- De-duplicate against the existing catalog by model / configuration code (`custom.model_configuration`).

### 4.2 Assign taxonomy (before writing a word of copy)
Taxonomy first. Copy second. Every product must land on Primary Collection → Secondary Collection using the existing Collection Map. If a product doesn't fit any existing secondary collection, you do not force it — you flag a NEW collection for creation (§6).

**Current collection tree (from the Collection Map — extend, don't fragment):**

| Primary Collection | Secondary Collections |
|---|---|
| Farm Sprayers | 3-Point Sprayers · Pull-Behind Sprayers · UTV Sprayers |
| Fencing & Post Equipment | Post Hole Diggers |
| Greenhouses & High Tunnels | Caterpillar Tunnels · High Tunnel Greenhouses · Polycarbonate Greenhouses |
| Irrigation Equipment | Pasture Irrigation Systems |
| Livestock Equipment | Livestock Weighing & EID |
| Planters, Seeders & Drills | Corn & Row Planters · No-Till Drills · Seed Drills & Crop Seeders |
| Skid Steer & Loader Attachments | Concrete Mixers · Tree Pullers & Grapples |
| Tractor Implements | Brush Cutters & Mowers · Cultipackers & Seedbed Tools · Land Grading Equipment · Pallet Forks · Post Hole Diggers · Rotary Tillers · Snow Removal Attachments · Tractor Grapples |

Each product also gets: a **Vendor/Brand** (how the store sorts by brand), a **Product Type** (its secondary category), and an **All Collections** list (a product can belong to a primary, a secondary, AND merchandising collections like 'Best Sellers' or 'Financing Available').

### 4.3 Generate product content (the per-product content contract — nothing is optional)
- **Product Title.** Brand + product + key configuration/model. Pattern: `{Brand} {Capacity/Size} {Product Type} — {Config} – {MODEL}`.
- **Body (HTML) description.** Structured, not a wall of text: short benefit-led intro, a bullet list (configuration, who it's for, freight note), then a 'Before ordering' confirmation paragraph. Original FDS copy — never paste supplier copy.
- **Every `custom.*` metafield from §3.** JSON fields (`key_specs`, `spec_table`, `faq`) must be valid JSON in the exact shapes the theme expects, or the block won't render. Leave a field empty rather than guessing.
- **Target Keyword.** The exact-match buyer phrase this page should rank for, from the Ahrefs priority keyword data where a match exists.
- **SEO Title (≤60 chars) and SEO Description (≤155 chars).** Written for the click, containing the target keyword.
- **Tags.** The filtering backbone — §5.
- **Image Alt Text.** Descriptive + keyword-bearing.

### 4.4 Description structure (from the course)
Short description → specs table (metafield) → documents → video (if any). The narrative description sells; the specs live in the metafield table so the template renders them consistently.

## 5. Tagging system — how customers filter thousands of SKUs

Tags follow a strict, prefixed convention — every tag is `dimension:value`, so filters group cleanly and never collide.

| Tag dimension | Example values | Powers the filter… |
|---|---|---|
| `brand:` | brand:Cimarron · brand:Baumalight | Shop by brand |
| `type:` | type:UTV Sprayer · type:No-Till Drill | Product type filter |
| `hp:` | hp:25-45 · hp:45+ · hp:sub-compact | Tractor HP compatibility |
| `hitch:` | hitch:cat-1 · hitch:cat-2 · hitch:3-point | Hitch / mount compatibility |
| `capacity:` | capacity:105gal · capacity:6ft | Size / capacity |
| `use:` | use:food-plot · use:pasture · use:commercial | Use case |
| `ship:` | ship:freight · ship:parcel | Shipping expectation |
| `price:` | price:1000-2500 · price:2500-5000 · price:5000+ | Price band |
| `status:` | status:best-seller · status:financing · status:new | Merchandising badges |

**Tag discipline:** the controlled vocabulary lives in the Collection Map / tag dictionary. Stage 1 may only use existing tag values or propose a new one explicitly (same rule as collections). When in doubt, reuse.

## 6. Collections — parent, child, and the 'no orphans' rule

| Collection type | How it's populated | Example |
|---|---|---|
| Parent (Primary) | Automated: condition = product 'Type' or tag is in the set of its children | Farm Sprayers (all sprayers) |
| Child (Secondary) | Automated: condition = tag `type:UTV Sprayer` | UTV Sprayers |
| Brand | Automated: condition = tag `brand:X` (or Vendor = X) | Cimarron |
| Merchandising | Automated: condition = tag `status:best-seller` etc. | Best Sellers · Financing Available |

**The no-orphans rule:** every product must resolve into at least one Primary and one Secondary collection. If a product doesn't fit any existing secondary collection, you do NOT drop it into the nearest-ish bucket. You create a new, correctly-named collection, add it to the Collection Map, and only then import.

**New-collection flag (Stage 1 output):** when Stage 1 hits a product with no home, it adds a row to a **NEW COLLECTIONS NEEDED** list with: proposed Primary, proposed Secondary, suggested handle, description, and the products that would fill it. You approve it in QA; Claude Code creates it in Stage 2, **before** the products that need it are imported.

## 7. Images — the permission-gated approach

| Image Use Status | Meaning | What Claude Code does |
|---|---|---|
| **approved** | Supplier gave written permission OR approved media-feed URL | Uploads it, sets Image Src, applies alt text |
| **requested** | Supplier media asked for, not yet received | Imports product with NO image, leaves DRAFT, logs it |
| **placeholder** | Branded FDS placeholder while awaiting media | Uploads the neutral placeholder |
| **research-only** | Competitor/manufacturer image for reference only | **NEVER uploads** — reference only |

Two practical import paths, decided per catalog:
- **Path A — URL import.** Approved image URLs go in the Image Src column; imported with the products.
- **Path B — folder upload.** Approved-images folder named by Handle or SKU; Claude Code matches filenames and uploads via CLI.

**Never do this:** upload competitor or manufacturer images to the live store without written permission or an approved media feed. A product with no approved image ships as DRAFT with a placeholder — never live bare or with a borrowed image.

## 8. QA gate — before anything reaches Claude Code

You (the human) run it. If any item fails, the file goes back to Stage 1.

**Per-product checklist:**
- Title follows the pattern and contains brand + model.
- Description is original, structured (intro → bullets → before-ordering), free of supplier copy-paste.
- Every `custom.*` metafield filled, or intentionally empty for an unverified value — in which case Specification Status is 'needs-supplier' and the product stays DRAFT. JSON fields valid in the theme's expected shape.
- Primary + Secondary collection assigned; no orphans.
- Tags use only the controlled vocabulary; every filter dimension present.
- SEO Title ≤60 chars, SEO Description ≤155 chars, both containing the target keyword.
- Image Use Status set; nothing marked 'approved' without real permission.
- Price references present; Published = FALSE / Status = draft.
- Warranty and 'authorized dealer' language verified, not guessed.

**Per-batch checklist:**
- NEW COLLECTIONS NEEDED list reviewed and approved.
- No duplicate model numbers against the existing catalog.
- Every new tag value approved and added to the dictionary.
- Row count matches the supplier catalog (minus deliberately-excluded low-ticket items).

## 9. Stage 2 — Claude Code: build the store

Execution order (collections and metafield definitions must exist before the products that depend on them):

1. **Verify metafield definitions.** Confirm every `custom.*` definition from §3 exists in Settings → Custom data. Do NOT create a new namespace or rename keys.
2. **Create new collections.** Parents first, then children, each automated with the tag/type conditions from §6.
3. **Import products as DRAFT.** Status = draft / Published = FALSE. Map every column including SEO fields.
4. **Attach metafields.** Exact keys from §3. Validate JSON fields before writing. 'needs-supplier' products stay draft.
5. **Place images per status.** Follow the §7 gate exactly.
6. **Wire navigation.** Mega-menu (Admin → Navigation) reflects the parent → child tree. Menu content is edited in Admin, not code.
7. **Configure filters.** Search & Discovery filters map to the §5 tag dimensions.
8. **Run the post-import audit (§10)** and produce a report.

**What Claude Code must NOT do:** write or rewrite descriptions, invent categories, create a new metafield namespace or rename any `custom.*` key, create tag values not in the dictionary, mark images approved, or publish anything live. If it finds a product it can't place using the file, it **stops and reports** rather than guessing.

## 10. Post-import audit — 'nothing empty, nothing out of place'

| Check | Pass condition |
|---|---|
| Orphan products | Zero products with no collection |
| Empty collections | Every collection has ≥1 product (or is intentionally staged) |
| Empty metafields | No live-eligible product with a blank required metafield |
| Missing SEO | Every product has SEO Title + Description |
| Image status | Every product approved-with-image or draft-with-placeholder — none live & bare |
| Tag integrity | No tags outside the dictionary; full filter dimension set per product |
| Brand sort | Every product has a Vendor/brand and appears in its brand collection |
| Draft safety | All new products draft/unpublished until you publish deliberately |

Audit output: counts imported, collections created, flagged-items list. Anything flagged goes back around — it doesn't get published to hide it.

## 11. Workflow & how to prompt each stage

Split it, deliberately: one brain writes the content; a different brain builds the store.

**Stage 1 prompt skeleton (Content Chat):** give it this SOP, the Collection Map, the Ahrefs priority keywords, and the raw supplier catalog. Ask for a finished Shopify Draft Import file: one row per product, every metafield filled, taxonomy from the Collection Map, tags from the controlled vocabulary, SEO against Ahrefs targets, NEW COLLECTIONS NEEDED list separate, image status per product, nothing under $1,000 unflagged, no supplier copy-paste.

**For very large catalogs:** split by Primary Collection, one sub-agent per collection, then a merge pass that reconciles into one import file, de-dupes tags, and consolidates the NEW COLLECTIONS list.

**Stage 2 prompt skeleton (Claude Code):** the approved import file + approved NEW COLLECTIONS list → §9 in order → §10 audit + report. Do not write content, invent categories, or publish anything.

**Why the two-brain split:** content generation is a judgment task; store execution is a precision task. Keeping them separate gives a clean human QA gate in between — where a store's quality is actually won or lost.

## 12. One-page quick reference

| Step | Stage | Deliverable |
|---|---|---|
| 1. Normalize raw catalog | Content Chat | Row-per-product working sheet |
| 2. Assign taxonomy | Content Chat | Primary+Secondary per product; NEW COLLECTIONS list |
| 3. Write content + metafields | Content Chat | Titles, HTML, all `custom.*` metafields (JSON valid) |
| 4. SEO + tags | Content Chat | SEO Title/Desc + controlled-vocab tags |
| 5. Image status | Content Chat + you | Image Use Status per product |
| 6. QA gate | You | Approved import file (pass/fail) |
| 7. Create collections | Claude Code | Parent+child collections live |
| 8. Import as DRAFT | Claude Code | Products + metafields in, unpublished |
| 9. Images + nav + filters | Claude Code | Store looks complete |
| 10. Audit | Claude Code + you | No orphans, nothing empty, report |
| 11. Publish deliberately | You | Go live once verified |

**Content is decided in Stage 1. Execution happens in Stage 2. The QA gate between them is where quality is won.**
