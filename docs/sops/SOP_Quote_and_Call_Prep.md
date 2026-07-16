# FDS SOP — Quote & Call-Prep

### The brief Claude assembles before you talk to anyone — buyer or supplier — so you walk in fully prepped and only do the human part.

> **When this SOP triggers.** A lead is ready for a sales call/quote, or a supplier is ready for a dealer call. Claude builds the brief and notifies you. Runs on demand and on the nightly cycle for anything scheduled.
>
> **Why it exists.** You do the conversation; Claude does everything else. A call should never start with you researching — the context, the numbers, and the talking points are ready before you dial. This is the SOP that makes "you only do the selling" real.
>
> **Hard rule.** Claude **assembles** pricing inputs and a suggested number; **you set the final price.** Pricing never auto-sends to a customer at any autonomy level.

---

## 1. Two brief types

**A. Buyer call / quote** — closing a sale.
**B. Supplier call** — closing a dealer relationship (handoff from the Outreach SOP).

Same structure, different content. Both delivered as a one-screen brief + a notification with the best call window.

---

## 2. The buyer call/quote brief

Claude assembles:

1. **Who & context** — name, `context_summary`, how they came in, timeline of touches (from the CRM/Gmail).
2. **What they want** — `product_interest` (exact product/variant), their intent, budget signal.
3. **The objection** — the specific thing to resolve on the call.
4. **Product facts** — pulled via the **Product Answer Desk SOP**: specs, compatibility/fit, freight, warranty, lead time — all verified from Shopify, with ❌ flags on anything unconfirmed (e.g. exact freight to their zip).
5. **The quote inputs** — supplier cost, freight estimate, and comparable market prices, so you can price with full information.
6. **Suggested number** — a target price / margin band per §4, clearly marked as a suggestion for you to set.
7. **Talking points** — education-first angles that build trust (the FDS win condition), plus the natural close.
8. **Next step** — send quote / schedule follow-up / mark Won.

You take the call, set the price, and close. Claude drafts the quote email for your approval once you give the number, then runs the follow-up cadence.

---

## 3. The supplier call brief

Claude assembles:

1. **Who & context** — brand, what they carry, their rank (Gold/Silver/Bronze), thread history.
2. **Their likely dealer terms** — from their site/replies: dealer program, MAP, freight model, warranty.
3. **Our questions** — the dealer-application question set (Outreach SOP §3): dropship? minimum order? wholesale margin? MAP enforcement? inventory feed? freight type? warranty handling? product data? ad/marketplace rules?
4. **Our legitimacy answers, ready** — EIN, South Dakota resale certificate, address, business phone.
5. **The target** — the dealer discount/margin to aim for, and our positioning (a professional, education-driven store that represents their brand well).
6. **Next step** — submit application / get authorized / request media feed.

You take the call and get us approved; Claude then triggers the Import SOP prep for that supplier's catalog.

---

## 4. Pricing framework (buyer quotes)

*Confirm your preferred rule and Claude applies it consistently; until you set one, Claude presents all three and asks.*

- **Cost + target margin:** supplier cost + freight, then a target margin band you define, priced at or above MAP. The course's one worked example ran ~33% ($5,000 order, $3,000 COGS, $250 shipping, $100 fees → $1,650 profit); synthesized guidance suggests 20–40% gross on high-ticket. Payment fees ~3%.
- **Sell at MAP/list:** price at the supplier's MAP; margin comes from the dealer discount. Claude confirms MAP per product. (MAP is the floor either way — never advertise below it; it's why we can win on service, not price.)
- **Case by case:** Claude assembles cost/freight/comps; you set every number.

Whatever the rule, Claude always shows the cost/freight/comp breakdown so your number is informed, and always treats **freight** explicitly (parcel vs LTL/liftgate/white-glove) since it's material on $1,000+ items and a wrong freight assumption eats the margin.

---

## 5. What Claude does vs. you

- **Claude:** assemble the brief, pull verified product facts, gather pricing inputs, draft the quote email (after you set price), schedule follow-ups, log outcomes.
- **You:** the conversation, the final price, the relationship.

---

## 6. Inputs, outputs, QA

**Inputs:** the CRM record + thread history, the product catalog (Answer Desk), supplier cost/freight data, your pricing rule.
**Outputs:** a one-screen brief, a call-window notification, a drafted (not sent) quote email pending your price, updated CRM next-action.
**QA:** every product fact in the brief is verified or ❌-flagged; the suggested number is labeled a suggestion, never sent as a price without you; freight is explicitly accounted for; the brief is complete enough that you start the call with zero prep.

*Feeds from: Lead Handling, Supplier Outreach, Product Answer Desk. Feeds into: the human call (yours), then Import SOP (won suppliers) or Won/Nurture (buyers).*
