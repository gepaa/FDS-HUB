# FDS — Quote & Call-Prep SOP

### The brief Claude assembles before Pablo gets on any call, and the inputs behind every quote — so the human close starts with everything known.

> **When this triggers.** A supplier or lead reaches a call (`CALL_SCHEDULED` / `CALL_NEGOTIATION`), or a quote needs to go out (`QUOTE_REQUESTED`). Output: a call brief on the record + (for quotes) the assembled inputs handed to Pablo. **Claude never sets the price.**

---

## 1. The call brief (posted to the record's activity log + linked in the morning brief)

**For a supplier call:**
- Who they are: company, products, size signals, the cluster they'd fill.
- The story so far: thread summary, what they've asked, what we promised.
- What we want: dealer authorization, dropship terms, freight handling, media permission (Import SOP §7), catalog access.
- Talking points: why FDS is a good dealer for them (specialist storefront, SEO-driven buyer traffic, high-ticket focus).
- Numbers context: their MSRP range, typical dealer margins in the category *from verified sources* — flagged ❌ if unknown. **Target margin is Pablo's call; the brief gives context, not the answer.**
- Open questions + anything we couldn't verify.

**For a buyer call:**
- The buyer: name, location, what they're buying, for what use, `intent`, budget signals.
- The product: verified specs (Answer Desk discipline — ✅/⚠️/❌ per fact), freight expectations, lead time, warranty.
- Their objections/questions so far, with suggested verified answers.
- The close path: what saying "yes" looks like (quote → deposit → freight booking).

## 2. Quote assembly (pricing = human hard stop)

Claude assembles: product + variant, supplier cost (verified), freight estimate to the buyer's zip (or ❌ flagged), comparable listed prices, and margin math at 2–3 candidate price points. It hands this package to Pablo via Approvals (`kind: price_quote`). **Pablo picks the number**; Claude then drafts the quote email for approval like any outbound.

## 3. Rules

- Every fact in a brief traces to the store, the thread, or the supplier's materials — anything else is marked unverified.
- Briefs are short: one screen. Context Pablo can absorb in 90 seconds beats a dossier.
- After the call, Pablo's outcome note goes on the record; Claude re-plans the next action from it.
