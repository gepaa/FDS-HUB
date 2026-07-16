# FDS SOP — Store Build & Theme Change

### How Claude Code safely edits the FDS Shopify store — the pull → dev → push → publish rhythm — without ever breaking the live store.

> **When this SOP triggers.** Any change to the storefront: theme sections, product pages, navigation, filters, or catalog structure. Claude Code (not the Claude app) runs this — it has the CLI and Shopify MCP.
>
> **Source.** This codifies the workflow already locked in your Operations Log. The rules here are non-negotiable because a careless push can take the live store down.

---

## 1. The golden rhythm — always in this order

**`pull → dev → push → publish`**

1. **Pull FIRST, always.** Apps add code on Shopify's side; skipping the pull overwrites/loses their work. Every session starts with a pull.
2. **Dev.** Work against the **development theme**, never live. The folder = the theme = a git repo, connected via CLI to a hidden dev theme. Prompt Claude Code → it edits files → CLI pushes to dev → refresh browser → see it. No download/re-upload loop.
3. **Push.** Push changes to the dev theme to preview.
4. **Publish — deliberately, by ID.** Going live is a separate, intentional act (`push` then `publish` by theme ID). It cannot happen by accident.

**Safety rails (locked):** always work on the dev theme; never edit live; git is the safety net (version history means nothing is lost); publishing is always your deliberate call.

---

## 2. Base theme & architecture (locked decisions from the Ops Log)

- **Base theme: Dawn** (not Skeleton) — Dawn has working sections to renovate.
- **Build on a base, don't build from scratch** — the advantage is in the custom sections + apps layered on top, not rebuilding cart/checkout plumbing.
- **No use of the licensed enterprise theme file** — legal/business risk; patterns are copyable, code isn't.
- **High-ticket "optimization" comes from custom sections + conversion apps**, not from a theme.

---

## 3. What Claude Code builds (and the order)

Per the Ops Log, the header system is the first target, built as three stacked systems: the utility bar (phone/trust/CTA — the warm-up build), the main header (logo + always-on search + account/cart, pointing at Shopify search, upgrading the engine later with Search & Discovery), and the mega-menu (category images, desktop hover-panel AND mobile drawer built separately).

**Before the mega-menu:** lock the category taxonomy (department → subcategory tree) — a bad taxonomy is expensive to reorganize. Feed Claude Code reference screenshots (it builds better from images).

**Catalog work** follows the two-stage Product Import SOP: content is decided in the Content Chat (Stage 1); Claude Code executes the build (Stage 2) — creates collections, imports products as DRAFT, attaches the `custom.*` metafields (exact keys, never renamed), places images per the permission gate, wires nav and filters, runs the post-import audit.

---

## 4. The gate — what's safe vs. what needs you

- **Autonomous (dev theme):** editing sections, building pages, importing products **as DRAFT**, wiring nav/filters, committing to git. All reversible, all on dev.
- **Needs you (irreversible / live):** **publishing a theme live**, **publishing products** (DRAFT → live), and any structural change you want to review first. Products stay DRAFT until vendor authorization, price, freight, and warranty are verified (Import SOP). Images never go live without written supplier permission or an approved feed.

---

## 5. Non-negotiables (the "never" list)

- Never edit or publish to the live theme without a deliberate publish-by-ID.
- Never skip the pull at session start.
- Never invent or rename a `custom.*` metafield key — the theme is wired to the exact keys; a renamed field silently renders nothing.
- Never upload competitor/manufacturer images to the live store without permission.
- Never publish a product that isn't verified — DRAFT until confirmed.
- Never work without git; commit as the safety net.

---

## 6. Inputs, outputs, QA

**Inputs:** the finished import file (from Stage 1), reference screenshots, the locked taxonomy, the Ops Log decisions.
**Outputs:** changes on the dev theme (previewable), products imported as DRAFT with metafields, wired nav/filters, git commits, and a post-import audit report.
**QA before you publish:** pulled first; worked on dev only; metafield keys exact and JSON valid; no orphan products, no empty collections, no bare live images; SEO present; everything committed to git. Publishing is your call, once the audit passes.

*Pairs with: **SOP — Product Import** (catalog) and the Operations Log (architecture).*
