# FDS — Lead Handling SOP

### What happens the moment a buyer lead lands, so no lead is ever lost to a slow follow-up.

> **When this triggers.** A quote request, contact-form message, inbound email, phone-call note, or Shopify signal (new customer, abandoned checkout, draft order) arrives. **The store is the top of the funnel; the conversion is a human conversation — Claude's job is speed, context, and never letting a thread go cold. The close is Pablo's.**

---

## 1. Capture & classify (same run it arrives)

1. Create/find the `type: lead` record (match by email). Source: `shopify` | `gmail` | `web-form` | `phone`.
2. Fill the spine: `product_interest` (which product/collection), `intent` (browsing / comparing / ready-to-buy), `priority` (ready-to-buy or ≥$2.5k interest → `hot`), `context_summary` (2–3 lines: who, what, where they are in the decision).
3. Shopify mapping (CRM Data Model §6): new order → `WON` + revenue logged; abandoned checkout → `ENGAGED` + `hot` + follow-up next action; draft order → `QUOTE_SENT` + `quote_amount`.

## 2. Respond (notch 0: drafts only)

- **Routine product questions** → answer via the Product Answer Desk SOP: verified store data only, confidence-flagged, drafted for Pablo to send.
- **Quote requests** → `QUOTE_REQUESTED`, assemble the quote inputs (product, cost, freight estimate, comparable margins) and hand to Pablo — **pricing is a hard stop; Claude never sets a number.**
- **Ready-to-buy signals** → push toward the human step: propose a call, prep the call brief, owner → `you`, ping Pablo if hot.

## 3. Nurture cadence

Quiet after our reply: nudge at day 2, day 6 (new info, not "just checking in"), then `NURTURE` with a scheduled re-touch. Post-quote: follow up day 2–3 ("any questions on the numbers?"). Every touch is logged; `next_action` always set.

## 4. Rules

- **Speed beats polish** on first response — but never at the cost of a guessed spec (accuracy gate, Answer Desk SOP §4).
- The customer always hears Pablo's voice; Claude drafts, Pablo sends.
- A lead is never `LOST` without the reason logged (feeds FAQ/SEO via the `objection` note).
