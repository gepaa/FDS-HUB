# FDS SOP — Google Ads Research & Campaign

### How Claude researches keywords, structures campaigns, and drafts ads to drive high-ticket buyers to the store — with spend always gated to you.

> **Status: written now, parked until connected.** Needs the **Google Ads connector** (not yet present) and **Ahrefs API units** (currently 0). Claude drafts and researches now where possible; live campaign work begins once both are connected. Keyword research overlaps with the existing Ahrefs Analysis SOP — use them together.
>
> **When it triggers.** You assign ads research/a campaign, or a new authorized-dealer catalog is ready to promote. The SEO/Ads worker runs this.
>
> **The hard gate.** Claude researches, structures, and drafts everything. **You approve spend and launch.** No budget, bid, or campaign goes live without you — money-out is always a human action.

---

## 1. Where ads fit in the FDS model

The store is top-of-funnel; the real conversion is a call/quote. So ads don't "sell" — they buy qualified traffic that becomes leads that you close. High AOV ($1,000+) is what makes paid acquisition viable: there's margin to absorb the click cost. Two channels matter most for high-ticket ag:

- **Google Shopping / Performance Max** — product-feed-driven; buyers searching a specific product. The store already has the Shopify → Google feed path (Simprosis-style app) from the build.
- **Search** — high-intent buyer keywords ("buy 3-point sprayer," "[brand] dealer," "best high tunnel greenhouse kit"). This is where the Ahrefs commercial-intent keyword work pays off.

SEO remains the survival channel (Ops Log); ads are the accelerator on top, especially for new catalogs before they rank organically.

---

## 2. Keyword research (with Ahrefs, once funded)

1. Pull buyer-intent keywords from the existing Ahrefs data (priority-A keywords, commercial-intent lists already in the project) and from Keywords Explorer for each product/brand.
2. Prioritize by **commercial intent** (ready-to-buy phrasing), volume, and competition — the same discipline as supplier brand-demand scoring.
3. Group into tight themes (by product type, by brand, by use-case) so ad groups and landing pages match search intent.
4. Map each keyword theme to the **best landing page** — a specific product or collection, not the homepage. Relevance is what keeps click cost down and conversion up.

Until Ahrefs units exist, Claude works from the keyword docs already in the project and flags where fresh pulls are needed.

---

## 3. Campaign structure (drafted for your approval)

- **Shopping/PMax:** clean product feed (accurate titles, the metafield-driven data, approved images), segmented by collection/brand, with product-level priority on high-margin, in-stock, verified products.
- **Search:** tightly-themed ad groups (one intent per group), keyword match types chosen deliberately, negative keywords to exclude tire-kickers and sub-$1,000 accessory searches.
- **Landing pages:** point to the matching product/collection with clear call/quote CTAs (the human step). A great ad to a weak page wastes spend.
- **Budget & bids:** Claude proposes a starting budget and bid strategy with a rationale; **you set and approve the actual numbers.**

---

## 4. Ad copy (drafted, education-first)

High-ticket buyers respond to expertise and trust, not discounts (MAP means we don't compete on price anyway). Copy leads with specialization, product education, financing availability where offered, and "talk to a specialist" CTAs. Claude drafts headline/description variants for A/B testing; you approve before launch.

---

## 5. Monitor & optimize (once live)

On the nightly cycle, Claude reviews campaign data and drafts optimization suggestions: pause wasted spend, shift budget to converting themes, add negatives, flag high-cost/low-return keywords, spot products with impressions but no clicks (feed/image issue) or clicks but no leads (landing-page/price issue). Every change that affects spend is proposed for your approval, not applied silently.

---

## 6. The gate — what needs you

- **Setting or increasing any budget or bid** — always yours.
- **Launching or unpausing a campaign** — yours.
- **Approving ad copy before it runs** — yours (brand + claims).

Claude does all research, structuring, drafting, and monitoring; the money-out decisions are human, every time. This mirrors the whole system's rule: Claude does the work up to the irreversible/external action, you make that call.

---

## 7. Inputs, outputs, QA

**Inputs:** Ahrefs keyword data, the product catalog/feed, authorized-dealer products to promote, your budget guidance.
**Outputs:** keyword research, drafted campaign structures, drafted ad copy, a proposed budget, and (once live) optimization recommendations — all queued for your approval.
**QA:** every landing page matches its keyword intent; only verified, in-stock, MAP-compliant products promoted; sub-$1,000 accessory searches excluded via negatives; no spend change applied without your approval; ad claims traceable and on-brand.

*Pairs with: the Ahrefs Analysis SOP (keywords) and the Store Build SOP (feed/landing pages). Blocked on: Google Ads connector + Ahrefs units.*
