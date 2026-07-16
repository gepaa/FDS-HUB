# FDS SOP — Supplier Outreach

### How Claude contacts suppliers, follows up, escalates to a call, and gets FDS approved as an authorized dealer — with the human in the loop.

> **When this SOP triggers.** A `Qualified` supplier is ready for first contact, a contacted supplier goes quiet, or a supplier replies. The Outreach worker agent runs this on the nightly cycle.
>
> **Source note — read this.** Jordan's course ends before the outreach module, so the *scripts* below are scaffolding built from (a) the legitimacy posture he does teach, (b) the synthesized templates in your Master Course Doc, and (c) high-ticket best practice. **They are placeholders to be replaced by your real pitch deck and outreach wording** — see §7. What IS from the course (verbatim) and locked: the prerequisites, the outreach-order rule, and the "demo products" tactic.
>
> **Autonomy.** Ships at **notch 0 — draft only.** Claude drafts every message into Gmail; you send. The Gmail connector is draft-only, so this is enforced mechanically, not just by policy. What never auto-sends even later is in §6.

---

## 1. Prerequisites — never contact a supplier before these are true

From the course, the hard rule: suppliers research you before approving. *"When you call suppliers to get approved as an authorized dealer, the first thing they're going to ask is what's your website?… they really want to find a website… You can't just call a supplier and say I love your products… and I don't have a store… It is just never going to work that way."*

Before any first contact, confirm:

1. **The store looks real and full enough.** A credible catalog exists. Per the course, seed with **demo products before outreach**: *"pick five, six different brands, and enter two products from each brand."*
2. **The demo-product timing rule.** *"Never put a supplier's product on your website and contact them at the same time."* When you reach out to a brand, remove that brand's demo products first, so the store still shows 10–14 products from *other* brands and you're not caught displaying a line you're not yet authorized for.
3. **Business legitimacy assets are ready** (Module 1): EIN, resale certificate, business phone/toll-free, professional email (info@farmerdirectsupply.com — *"You don't email suppliers as a gmail.com. That is not professional."*), and a commercial-looking address.
4. **Outreach order respected:** start **Bronze/Silver**, save **Gold** until the store is fuller (Sourcing SOP §4).

If any prerequisite is false, Claude flags it rather than sending — a weak approach burns a supplier you only get to approach once.

---

## 2. The message sequence

A staged cadence per supplier. Claude drafts each stage; you approve/send.

**Stage 1 — First contact (email).** Short, professional, positions FDS as a legitimate niche retailer and asks about their dealer/dropship program. Scaffold (replace with your wording):

> **Subject: Dealer / Wholesale Partnership Inquiry — Farming Direct Supply**
> Hello [Supplier], I'm Pablo with Farming Direct Supply, a US online retailer specializing in high-ticket agricultural equipment. I came across your [product line] and believe it's a strong fit for our customers. Do you work with online retailers / authorized dealers, and can you ship direct to customers on behalf of dealers? I'd love to learn your dealer requirements, wholesale pricing, MAP policy, product-data availability, fulfillment/freight process, and warranty handling. Could you send your dealer application or wholesale info? Happy to provide our EIN and reseller certificate. — Pablo, Farming Direct Supply · farmerdirectsupply.com · [phone]

**Stage 2 — Follow-up #1** (~3–4 days, no reply). Brief, references the first email, adds one value point, offers a call.

**Stage 3 — Follow-up #2** (~4–5 days later). Different angle; offers to call their sales/dealer line directly. For suppliers with no email or a contact form only, Claude preps a **phone script** for you (or fills the web form as a queued action).

**Stage 4 — Escalate to a call** (see §4). When a supplier engages or the thread is warm, the move is a human call — that's where dealer approval actually happens.

**Stage 5 — Application** (they reply positively). Claude drafts answers to their dealer application using our real business data, assembles the docs they ask for (EIN, resale cert), and queues it for you to submit/attach.

Each stage updates the CRM status: `Contacted → Replied → In Conversation → Call Scheduled → Negotiating → Authorized Dealer` (or `On Hold` / `Declined`).

---

## 3. The dealer-application question set (what suppliers ask / what we ask them)

When a supplier engages, Claude prepares answers to and questions for these (from the course + synthesized list). Capture the answers into the supplier record — they feed pricing, the Import SOP, and future products:

Do you work with online-only retailers? · Do you allow dropshipping / direct-to-customer? · Dealer requirements & minimum opening order? · Wholesale pricing / margins? · **MAP enforcement?** · How is inventory updated (feed/CSV/API)? · Lead times? · Shipping type (parcel / LTL / white-glove / curbside / liftgate)? · Who handles damaged freight? · Who handles warranty? · Product data/images/manuals available (for our pages)? · Paid ads on brand keywords allowed? · Marketplace restrictions (Amazon/eBay)? · *"What makes your best retailers successful?"*

The legitimacy answers Claude has ready: EIN (on request), **South Dakota resale certificate** (accepted broadly), Nevada/commercial address, business phone. If a supplier balks at a non-US operator, the address handles it — the course's exact fix for *"we don't do business in Canada."*

---

## 4. When and how to escalate to a call (the key human step)

The sale of the *dealer relationship* closes by voice, same as the buyer sale does. Claude escalates to a call when: the supplier replies with interest, asks questions best handled live, the thread has gone back-and-forth twice, or they explicitly ask to talk.

At escalation, Claude does **not** wing it — it builds a **call brief** (handoff to the Quote & Call-Prep SOP): the supplier's context, what they carry, their likely dealer terms, our talking points, the questions in §3, and a target (dealer discount / margin). It sends you a notification with the brief and the best window. You take the call; Claude logs the outcome and sets the next action.

---

## 5. Follow-up discipline & handling replies

- **Cadence:** ~3–4 days to first follow-up, ~4–5 to second, then space out. Human-paced, never a blast.
- **Read every reply:** Claude classifies the reply (interested / needs info / not now / no / asks for a doc) and drafts the right next move — an answer, the application, a doc request to you, or a re-engage date.
- **"Not now" → `On Hold`** with a re-engage date, not `Declined`.
- **"No" → `Declined`**, log the reason, and trigger the Sourcing SOP to line up alternates (the course's "50% won't even pick up the phone" reality means you always need a fresh bench).
- **Quiet after full sequence → `On Hold`**, low priority, occasional re-touch.

---

## 6. The gate — what never auto-sends (even above notch 0)

- **First contact from a cold domain at volume** — always paced/approved until the sending domain is warmed (deliverability groundwork).
- **Anything with a legal/contract attachment** (dealer agreements) — your signature, your call.
- **Replies to an upset or escalating supplier** — human tone required.
- **A "no" or a walk-away** — human judgment.

At notch 0 everything is draft-only regardless. As the dedicated sending domain warms (SPF/DKIM/DMARC), in-thread follow-ups and replies move to the safe-lane (auto-send) first; first-contact-at-volume last. The Gmail connector can't send, so notch-1 sending will run through the dedicated sending subdomain + an email service — not Gmail.

---

## 7. Replace this scaffolding with your real material

The scripts here are placeholders. To make this SOP match how FDS actually wins suppliers, drop in: **your supplier pitch deck**, **your current outreach email/template** (the one behind the 100-supplier sheet), and any **objection responses** you've learned work. Claude will fold your wording in and this becomes your true outreach playbook. Until then, the scaffold is safe because everything ships as a draft you review.

---

## 8. Inputs, outputs, QA

**Inputs:** `Qualified` supplier records (from Sourcing SOP), your business legitimacy assets, the store's current catalog state.
**Outputs:** drafted messages in Gmail (queued to Approvals), updated CRM statuses/next-actions, call briefs for warm suppliers, logged declines with alternates queued.
**QA before anything queues:** prerequisites met (§1), correct outreach order (Bronze/Silver before Gold), demo-product timing respected, no MAP-failing supplier being pursued, tone professional and on-brand, and every send still passing through your approval at notch 0.

*Feeds into: **SOP — Quote & Call-Prep** (for supplier calls) and **SOP — Product Import** (once a supplier is Authorized Dealer).*

---

## Workspace addendum (2026-07-16)

Per §7, the scaffolding above is superseded: **all outreach wording now comes from [`Outreach_Email_Template_Bank.md`](Outreach_Email_Template_Bank.md)** (identity: Ben Lockwood / Farmer Direct Supply — never "Farmer Supply Direct"; cadence Day 0 / 3 / 8–10 / 17–20; attachment security policy §9; sending checklist §11). The pitch deck remains to be dropped in for Template 9.
