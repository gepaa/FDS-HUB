# Farming Direct Supply — Operations Log & Context Hub

> **What this doc is:** the single source of truth for the entire Farming Direct Supply (FDS) Shopify operation. It's not just theme development — it covers the whole store: theme build, product/catalog work, backend config, apps, SEO/content, and ongoing strategy decisions.
>
> **How to use it:** at the start of any new planning chat in this Project, point Claude here first. It orients whoever's helping (me or a future chat) without you re-explaining everything. Update it as decisions get made and work gets done. Think of it as the project's memory.

---

## 1. Business context (the non-negotiable frame)

- **Brand:** Farming Direct Supply (FDS) — high-ticket dropshipping, agricultural equipment (tractor attachments, greenhouses, farming supply needs).
- **Price point:** $1,000+ products. This is NOT normal dropshipping. Closer to a lead-gen agency that happens to sell products.
- **Customer journey:** the store is the TOP of the funnel, not the closer. Real conversion is usually a **phone call or quote request**. People don't drop $3,000 without talking to a human first.
- **Therefore the store's three jobs:**
  1. **Rank on Google** for thousands of product + buyer-intent searches (SEO is survival, not polish).
  2. **Build trust** so a stranger will call about a big purchase.
  3. **Make navigation + getting to a human dead easy** (huge catalog, prominent call/quote CTAs everywhere).
- **Scale:** thousands of SKUs. Findability and per-product SEO are core, not afterthoughts.
- **Leads are the product.** Losing someone to confusing nav or a hard-to-find CTA = lost money.

---

## 2. Environment setup — where everything lives

**Two separate places. Don't mix them up.**

### Side A — This Claude app (Planning HQ)
- **This Project** ("High Ticket Dropshipping - Farming Direct Supply") = strategy, planning, content generation, prompt-writing, troubleshooting, consulting.
- **Nothing here touches the live store.** This is the thinking layer.
- Holds: foundational docs (course modules, Ahrefs data, reference screenshots), this log, drafted content, and the prompts to carry into Claude Code.

### Side B — Claude Code (Build workspace, on your computer)
- This is where the actual store gets built and changed. Your "chat → see it on the store" loop lives HERE, not in the Claude app.
- **The model:** one folder = the theme = a git repo = connected via CLI to a hidden **development theme** on the store.
  - Prompt Claude Code → it edits files → CLI pushes to dev theme → refresh browser → see it.
  - No download/re-upload loop. The folder IS the theme, permanently.
- **Base theme:** Dawn (github.com/Shopify/dawn) — NOT the current CLI default (Skeleton, as of CLI 4.0 / May 2026). Dawn gives working sections to renovate; Skeleton is a bare shell we don't want.
- **Golden workflow rhythm:** `pull → dev → push → publish`. **Always pull FIRST** (apps add code on Shopify's side; skipping pull = overwritten/lost work).
- **Safety:** always work on the **dev theme**, never live. Going live is deliberate: `push` then `publish` by ID. Can't happen by accident.
- **Git = your safety net.** Version history means nothing is ever truly lost.

---

## 3. Workstreams (the whole operation, not just theme)

Theme is ONE of these. All of them live under this Project + Claude Code workspace.

### 3a. Theme / storefront build  *(active — current focus)*
Renovating Dawn into the FDS store, section by section, via Claude Code.

### 3b. Product & catalog management
Publishing products, writing SEO-optimized descriptions, per-product FAQs, spec tables. Thousands of SKUs. Category taxonomy.

### 3c. Backend & store config
Shopify settings, shipping, payments, navigation menus (Admin-side), collections structure.

### 3d. Apps & integrations
Conversion apps that sit on top of the theme (see Section 6).

### 3e. SEO & content strategy
Blog posts, buyer guides ("Which X to choose?"), keyword strategy from Ahrefs data. Core to the whole model.

### 3f. Consulting / decisions
Ongoing strategic thinking — this Project is also a place to work through business decisions, not just execute builds.

---

## 4. Key architecture decisions (locked)

| Decision | Choice | Why |
|---|---|---|
| Build from scratch vs. base theme | **Base theme (Dawn)** | Scratch = rebuilding invisible plumbing (cart, checkout, catalog engine) with no coding background. Advantage is in the layer ON TOP, not the plumbing. |
| Which base | **Dawn**, not Skeleton | Dawn has working sections to renovate; friend's Garage Auto Supplies proved custom features layer onto a base fine. |
| Enterprise theme ($400 file) | **Not using it** | Licensed/copyrighted code, no license to use or derive from. Legal + business risk. The patterns are copyable; the code isn't. Don't need it anyway. |
| High-ticket "optimization" | **Comes from custom sections + apps, not a theme** | No Shopify theme is inherently "high-ticket optimized." It's the product-page sections + conversion apps you add. |
| Where building happens | **Claude Code**, not the Claude app | The Claude app can't run CLI or touch the store. |

---

## 5. Header/nav system — first build target

Three stacked systems, built/controlled differently:

1. **Utility bar (top strip):** custom section. Phone #, trust hook, first CTA. Editable in theme customizer. Easy warm-up build.
2. **Main header (logo + always-on search + account/cart):** custom section for the visible bar; search ENGINE is core Shopify search + likely **Search & Discovery app** (native search gets weak across thousands of SKUs). Build the bar, point at Shopify search, upgrade engine later.
3. **Mega-menu (Agri Supply-style, category images):** custom section that RENDERS Shopify's native menus (menu content edited in Admin → Navigation, not code). Category images attached via section settings. **Must build desktop hover-panel AND mobile drawer separately** (a lot of traffic is mobile).

**Before building the menu:** lock the category taxonomy (department → subcategory tree). The menu is easy to build; a bad taxonomy is expensive to reorganize. Study Agri Supply's structure as a model.

**Prompting tip:** feed Claude Code the reference screenshots (Agri Supply mega-menu especially). It builds better from images than descriptions.

---

## 6. Apps vs. theme (what NOT to hand-build)

A lot of "incredible customer experience" is apps, not theme code. Don't code what an app does better:

- **Reviews w/ photos:** Junip / Judge.me / Okendo (Breeo uses Junip)
- **Financing / "as low as $X/mo":** Shop Pay Installments / Affirm
- **Search across many SKUs:** Shopify Search & Discovery (free, first-party) + filters
- **Live chat / "talk to an expert":** a support/chat app
- **Quote requests:** app or custom form section (TBD)

---

## 7. Build log (running record — newest at top)

> Format: date — what happened / decided / next.

- **[setup phase]** — Planning HQ (this Project) established with foundational docs. Architecture decisions locked (see §4). Header system blueprinted (§5). Next: set up Claude Code environment (Dawn + git + dev theme), then build header starting with utility bar.

---

## 8. Open questions / to-decide

- Category taxonomy tree (needed before mega-menu build).
- Quote-request flow: app vs. custom section?
- Which review app.
- Launch checklist definition.
- Content/SEO plan sequencing from Ahrefs data.

---

*Keep this doc current. It's the reason a 3-week-old chat won't need you to re-explain the whole business.*
