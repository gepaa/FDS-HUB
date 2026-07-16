# Farming Direct Supply — Product Answer Desk SOP

### The sales co-pilot: Claude looks up any product and hands you a ready-to-send answer, so you close without doing the research.

> **When this SOP triggers.** A customer asks a product question — in live chat, over email, or on a call — and you need the answer fast and correct. You paste (or forward) the question; Claude pulls the product from the live Shopify store and returns a customer-ready reply plus the facts behind it.
>
> **Why it exists.** In the FDS model the sale closes in a human conversation, and buyers spending $1,000+ ask detailed questions (freight, hitch category, flow rate, warranty, lead time). Digging through Shopify mid-conversation is slow and loses momentum. This SOP makes Claude your instant product-knowledge desk so **you stay in the conversation and Claude does the lookup.**
>
> **The one rule:** every answer comes from *verified store data*, never a guess. If a fact isn't in Shopify or verified, Claude says so and flags it — the same accuracy-over-speed discipline as the Import SOP. A wrong spec on a $3,000 freight item is worse than a slower answer.

---

## 1. What Claude has to work with (the data behind every answer)

FDS product pages are driven by the `custom.*` metafields. That's exactly what makes this desk possible — the answer to almost any buyer question already lives in a structured field. Claude reads these off the live store via the Shopify connector:

| Buyer asks about… | Comes from | Field(s) |
|---|---|---|
| Quick specs (capacity, weight, size) | Key Specs strip | `custom.key_specs` |
| Full detailed specs | Spec table | `custom.spec_table` |
| "Will it fit my tractor?" | Compatibility / description | `custom.compatibility` (if present) + spec table + body |
| Hitch category / HP range | Tags + specs | `hp:` / `hitch:` tags, `spec_table` |
| Features & benefits | Features list | `custom.features_list` |
| What's in the box | What's included | `custom.whats_included` |
| Warranty | Warranty block | `custom.warranty` |
| Delivery time | Lead time badge | `custom.lead_time` |
| Freight / delivery access | Freight note / description | `custom.freight_note` (if present) + body |
| Common objections | FAQ | `custom.faq` |
| Price | Variant price | Shopify price |
| Model / config | Model field | `custom.model_configuration` |
| Manuals / spec sheets | Documents | `custom.documents` |
| Compatible add-ons | Accessories | `custom.accessories` |

Because the store is wired to these keys, "answer the customer's question" becomes "read the right field and phrase it for a buyer."

---

## 2. The flow (four steps, seconds each)

```
  You paste the             Claude finds the          Claude reads the         Claude hands you
  customer's question  ───► product in Shopify   ───► right field(s) &    ───► a ready-to-send
  (+ product if known)      (search by name/SKU/      verifies the fact         answer + the raw
                            model/what they viewed)                             facts + confidence
```

**Step 1 — Intake.** You give Claude the question. Best case you also name the product or paste the link; if not, Claude identifies it from the SKU, model, description, or (when connected to chat/CRM) what the customer was viewing.

**Step 2 — Locate.** Claude searches the live store (`search_products` / `get-product`) and confirms it has the *exact* product and variant — never a similar one.

**Step 3 — Read & verify.** Claude pulls the relevant metafield(s). If the field is filled and verified → use it. If it's empty or the product is still DRAFT/unverified → Claude does **not** invent it; it flags the gap (see §4).

**Step 4 — Deliver.** Claude returns three things:
1. **A customer-ready answer** — in your voice, phrased to move the sale forward.
2. **The raw facts** — so you can trust and adjust it.
3. **A confidence flag** — ✅ verified from store · ⚠️ partial/needs check · ❌ not in store, needs supplier.

---

## 3. Answer style rules (so it sounds like FDS, not a spec dump)

- **Buyer-first, not database-first.** Lead with the answer to what they asked, then the supporting spec — not a wall of fields.
- **High-ticket tone:** helpful, expert, unhurried, trust-building. These buyers are spending real money; the voice is a knowledgeable advisor, not a bot.
- **Always nudge toward the human step** where natural: offer a call, a quote, or "happy to walk you through it." The store's job is to get them to you.
- **You stay the voice.** Claude drafts; you send. The customer is always talking to *you*, never "an AI."
- **Never overpromise.** No guessed compatibility, no invented warranty, no "yes it fits" unless the data says so. For freight/fit questions on big equipment, a wrong yes causes a returned pallet.

---

## 4. The accuracy gate (the non-negotiable)

This is the heart of the SOP — it mirrors the Import SOP's "leave it empty rather than guess" rule, applied to live selling.

| Situation | What Claude does |
|---|---|
| Fact is in a verified, filled metafield | Answer confidently, mark ✅ verified |
| Fact is missing / field empty | **Does not guess.** Says "that spec isn't confirmed in our system yet — I can verify with the supplier and come right back," marks ❌, and logs it |
| Product is DRAFT / specs unverified | Flags it; gives what's verified, withholds what isn't |
| Two variants differ and it's unclear which the buyer means | Asks which one rather than assuming |
| Compatibility / freight / fit question with incomplete data | Errs conservative; offers to confirm with supplier before the buyer commits |

**Every ❌ becomes an action.** A missing fact isn't just a non-answer — Claude logs it so the gap gets filled (ask the supplier, update the metafield), so the *next* buyer who asks gets an instant ✅. The answer desk makes the catalog better over time.

---

## 5. Example (end to end)

**Customer message you paste in:**
> "Looking at the 105-gallon 3-point sprayer — will it work on my 45hp Kubota, and how long to ship?"

**Claude returns:**

**✅ Ready-to-send answer:**
> Great question — yes, the 105-gallon 3-point sprayer is a solid match for your 45hp Kubota. It mounts on a Category 1 & 2 three-point hitch and is rated for tractors in the 25–60hp range, so you're right in the sweet spot. On delivery: it ships freight, usually in about 20–25 business days since it comes direct from the manufacturer. Happy to get you an exact freight quote to your zip and walk you through setup on a quick call whenever you're ready.

**Facts behind it:**
- Hitch: `hitch:cat-1`, `hitch:cat-2` · HP: `hp:25-45`, spec table "25–60 hp" ✅
- Lead time: `custom.lead_time` = "Usually ships in 20–25 business days" ✅
- Ship: `ship:freight` ✅
- Exact freight cost to buyer's zip: ❌ not in store → **flagged: needs freight quote** (a you/quote step)

**Confidence:** ✅ fit + timing verified · ❌ exact freight cost needs a quote (offered in the reply).

---

## 6. Phased rollout (matches the Master Plan)

**Phase A — Inside the HQ (now).** You paste the customer's question into the HQ chat; Claude answers from the live store. Works today with the Shopify connector. Zero setup beyond the connection you already have.

**Phase B — Wired into live chat (later).** Once you pick a live-chat/helpdesk app and connect it, Claude reads incoming customer questions directly and drafts answers in place — you still approve/send. Same SOP, less copy-paste.

---

## 7. What this SOP does NOT do

- It does not send anything to a customer on its own — **you send.** (You are the voice of the sale.)
- It does not set prices or make quotes — pricing is a human hard-stop (see CRM Data Model §8).
- It does not invent specs, compatibility, or warranty — missing data is flagged, never filled with a guess.
- It does not replace the sales conversation — it *equips* it.

---

## 8. Inputs, outputs, and the QA line

**Inputs:** the customer's question; ideally the product name/SKU/link or the CRM record.
**Outputs:** a customer-ready answer, the raw verified facts, a confidence flag, and a logged list of any missing data to fill.
**QA line (before you send):** every claim in the answer traces to a verified store field or is explicitly flagged. If you see a fact with no ✅ behind it, don't send it as fact — that's the whole discipline.

---

*This is the first of the Engine-3 sales SOPs. Its companion is the Quote & Call-Prep SOP (the brief Claude builds before you get on a call). Together they make the human close as easy as possible — which is exactly the point: Claude does everything around the sale so you can do the sale.*
