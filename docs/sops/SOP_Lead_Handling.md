# FDS SOP — Lead Handling

### How Claude captures every buyer lead, keeps it moving, does all the around-the-sale work, and hands you a ready-to-close conversation.

> **When this SOP triggers.** A buyer lead lands — a Shopify contact/quote form, an inbound email, a phone message, an abandoned checkout, or (later) a live-chat conversation. The Lead worker agent runs this continuously.
>
> **The core rule (your division of labor).** Claude does **everything around the sale**; **you do the sale.** Capture, classify, first response, follow-ups, reminders, nurture, and product research are Claude's. The actual selling conversation — where a person decides to spend thousands — is yours. Everything Claude does here exists to get more good leads to you and to make each one easier to close.
>
> **Grounded in the model.** From the Ops Log: *"the store is the TOP of the funnel, not the closer. Real conversion is usually a phone call or quote request. People don't drop $3,000 without talking to a human first. Leads are the product."* This SOP treats every lead accordingly.

---

## 1. Capture — no lead falls through

Claude watches the sources and creates/updates a `lead` record the moment one appears:

| Source | How it's captured | Initial status |
|---|---|---|
| Shopify contact / quote form | Form submission → new lead | `New` |
| Inbound email (Gmail) | Unknown sender that reads as a buyer → new lead; known → update | `New` / advance |
| Abandoned checkout (Shopify) | High-intent signal → lead, `hot` priority | `Engaged` |
| New customer / order (Shopify) | Purchased → lead at `Won`, attach order | `Won` |
| Phone message / voicemail | You forward or note it → lead | `New` |
| Live chat (Phase B, once connected) | Chat transcript → lead | `New` / `Engaged` |

Every new lead gets a `context_summary` (who they are, what they want), a `product_interest`, an `intent` read (browsing / comparing / ready-to-buy), a `priority`, and a `next_action`. Nothing sits uncategorized.

---

## 2. Classify — read intent fast

Claude assesses each lead so the response fits:

- **Intent:** browsing (needs education) · comparing (needs a reason to pick us) · ready-to-buy (needs a quote/call fast).
- **Budget signal:** unknown / <1k / 1k–5k / 5k+ (a sub-$1k ask may be an accessory, not a core lead).
- **The objection / question:** the specific thing blocking them — captured because it feeds the sale *and* the store (recurring objections become FAQ/SEO content per the Import SOP).
- **Priority:** ready-to-buy or high budget → `hot` → surfaced to you immediately, even overnight.

---

## 3. Respond — fast, helpful, education-first

High-ticket buyers convert on trust and expertise, not price. First response is quick and genuinely useful.

- **Routine product questions** → Claude drafts the answer via the **Product Answer Desk SOP** (verified store data only, no guessing), phrased to move toward a call/quote. At notch 0 you send; the customer always hears your voice.
- **Ready-to-buy / quote request** → Claude assembles the quote inputs and hands to the **Quote & Call-Prep SOP**; pricing is your call (hard stop).
- **Needs education** → Claude drafts a helpful reply and can attach/point to the relevant buyer guide (SEO content), positioning FDS as the specialist.
- **Always nudge to the human step** where natural — *"happy to walk you through it on a quick call"* — because the call is where it closes.

**What never auto-sends** (mirrors the outreach gate): a **price or quote**, anything with a **legal/financing** attachment, a reply to an **upset** lead. Those are yours. Routine in-thread replies become safe-lane once the domain is warmed; at notch 0 all drafts wait for you.

---

## 4. Follow up & nurture — the part that quietly makes the money

Most high-ticket sales need several touches. Claude runs the cadence so no lead dies of neglect:

- **Engaged, no reply** → spaced follow-ups (helpful, not pushy), each adding value.
- **Quote sent** → structured follow-up cadence until they decide.
- **Abandoned checkout** → prompt, helpful re-engagement (offer help/a call, not just "you forgot something").
- **Not now → `Nurture`** with a scheduled re-touch date.
- **Reminders to you** — when a lead is waiting on *you* (a call, a quote number, a promised doc), Claude reminds you and keeps it on your **My Actions** list. This is the "follow ups and reminding customers" work you said Claude should own.

Every follow-up is drafted by Claude; sending follows the same gate.

---

## 5. Hand to you — the close, teed up

When a lead is ready for the human conversation, Claude doesn't just flag it — it **prepares you** (via the Quote & Call-Prep SOP): the lead's full context and history, what they want, their objection, the product facts (from the Answer Desk), a suggested quote/target, and talking points. You get a notification and a brief; you make the call. Your only job is the conversation — all the research and prep is already done.

After the call, you note the outcome (or Claude reads the follow-up thread); Claude updates status, sets the next action, and resumes follow-up.

---

## 6. Team routing (if applicable)

If sales are shared across a small team, the lead's `owner` routes it and Claude preps whoever owns it. Default: leads route to you. *(Confirm your team setup so routing is right — until then all leads default to you.)*

---

## 7. Pipeline & statuses

`New → Contacted → Engaged → Quote Requested → Quote Sent → Call/Negotiation → Won` — with `Nurture` (not now) and `Lost` (gone, log reason) as exits. Claude keeps each lead's status, `context_summary`, and `next_action` current every cycle, so you (or the PM) always see where every lead is and the single next move.

---

## 8. Inputs, outputs, QA

**Inputs:** Shopify events, Gmail threads, form/phone/chat leads, the product catalog (for answers), pricing inputs.
**Outputs:** live `lead` records with status + context + next action; drafted replies/follow-ups in the Approvals queue; hot-lead notifications; call briefs; nurture schedules; reminders on your My Actions list; recurring-objection notes fed to content/SEO.
**QA each cycle:** no lead uncaptured or uncategorized; every hot lead surfaced to you; no price/quote or legal reply auto-sent; every product claim in a draft traces to verified store data (Answer Desk gate); nothing waiting on you left un-reminded.

*Feeds into: **SOP — Product Answer Desk** (answers), **SOP — Quote & Call-Prep** (the close), and content/SEO (objections → FAQ).*
