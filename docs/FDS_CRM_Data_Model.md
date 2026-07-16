# Farming Direct Supply — CRM Data Model

### The structure that lets Claude see every lead and supplier in real time, know each one's status and next action, and take action on its own.

> **What this is.** The blueprint for the CRM at the center of the HQ. It defines the records, their fields, the pipeline stages, and — critically — how Shopify and Gmail feed into it so the picture stays live. It's written to be built either as a Fable app or as a Claude-native artifact backed by a simple store. Both use the same model below.
>
> **Design principle (from the FDS Ops Log):** *leads are the product.* So the CRM isn't a contact list — it's an action engine. Every record answers three questions at a glance: **where is this?** (status), **what's the context?** (who they are, what they want, the history), and **what happens next?** (the single next action and who owns it).

---

## 1. Two record types, one shared spine

FDS has two relationship types that flow in opposite directions but share the same machinery:

- **Leads** — potential *buyers* coming *in* (store visitors, quote requests, phone inquiries). The store is top-of-funnel; the conversion is a call. The CRM's job: never lose one to a slow or missing follow-up.
- **Suppliers** — potential *dealer relationships* you're recruiting *out* (manufacturers/wholesalers of high-ticket ag equipment). The CRM's job: run outreach + follow-up to authorized-dealer status.

Both are "a relationship with a status, context, and a next action," so they share a spine and differ only in their pipeline and a few fields.

---

## 2. The shared spine (fields every record has)

| Field | Type | What it holds | Source |
|---|---|---|---|
| `record_id` | ID | FDS-LEAD-#### or FDS-SUP-#### | system |
| `type` | enum | `lead` \| `supplier` | system |
| `name` | text | Person or company name | Gmail / Shopify / manual |
| `company` | text | Company (for suppliers, the brand) | enriched |
| `email` | email | Primary contact email | Gmail / Shopify |
| `phone` | text | Best number to call | enriched / manual |
| `status` | enum | Pipeline stage (see §3) | Claude / manual |
| `owner` | enum | `claude` \| `you` \| `unassigned` | system |
| `next_action` | text | The single next thing to do | Claude |
| `next_action_due` | date | When it's due | Claude |
| `priority` | enum | `hot` \| `warm` \| `cold` | Claude |
| `context_summary` | text | 2–3 line "who is this / what do they want" | Claude (from thread) |
| `last_contact` | datetime | Last inbound or outbound touch | Gmail |
| `last_activity` | datetime | Any change on the record | system |
| `source` | enum | `shopify` \| `gmail` \| `web-form` \| `phone` \| `manual` \| `sourced` | system |
| `linked_thread` | link | Gmail thread ID(s) | Gmail |
| `linked_shopify_id` | link | Shopify customer/order ID | Shopify |
| `tags` | list | Free/controlled tags (mirror the store's `dimension:value` style) | Claude |
| `activity_log` | list | Timestamped events (emails, status changes, notes) | system |

**The three at-a-glance fields** — `status`, `context_summary`, `next_action` — are what you and Claude read first. If those three are always current, the CRM is doing its job.

---

## 3. Pipelines (the status ladders)

### 3a. Supplier pipeline (outbound recruiting)

```
Sourced → Qualified → Contacted → Replied → In Conversation
   → Call Scheduled → Negotiating → Authorized Dealer ✓
                    ↘ On Hold   ↘ Declined ✗
```

| Status | Meaning | Typical next action (Claude) | Auto-send safe? |
|---|---|---|---|
| **Sourced** | Found, not yet vetted | Qualify against checklist | n/a (internal) |
| **Qualified** | Passes freight/warranty/dealer criteria | Draft first-contact email | ❌ gate: first contact |
| **Contacted** | First email sent | Wait; schedule follow-up | — |
| **Replied** | They answered | Read reply, draft response | ✅ reply is safe-lane |
| **In Conversation** | Active back-and-forth | Move toward a call | ✅ in-thread follow-ups |
| **Call Scheduled** | A call is set | Build your call brief | n/a |
| **Negotiating** | Terms/dealer program in play | Draft; **you** approve pricing/legal | ❌ hard stop |
| **Authorized Dealer** | Won — can list their products | Trigger catalog import (Import SOP) | n/a |
| **On Hold** | Paused (their side or yours) | Re-engage date set | — |
| **Declined** | No | Log reason; queue alternates | n/a |

### 3b. Lead pipeline (inbound buyers)

```
New → Contacted → Engaged → Quote Requested
   → Quote Sent → Call/Negotiation → Won ✓
                                    ↘ Nurture  ↘ Lost ✗
```

| Status | Meaning | Typical next action (Claude) | Auto-send safe? |
|---|---|---|---|
| **New** | Inbound lead just landed | Classify, draft first response | ❌ gate (or safe-lane reply if they emailed first) |
| **Contacted** | First reply sent | Wait / follow-up cadence | ✅ in-thread |
| **Engaged** | They replied, interested | Answer questions, qualify | ✅ in-thread |
| **Quote Requested** | They want pricing | Assemble quote inputs for you | ❌ hard stop: pricing = you |
| **Quote Sent** | Quote delivered | Follow-up cadence | ✅ follow-up only |
| **Call/Negotiation** | Talking numbers | Call brief; **you** close | n/a |
| **Won** | Purchased | Post-sale handoff, log | n/a |
| **Nurture** | Not now | Scheduled re-touch | ✅ nurture emails |
| **Lost** | Gone | Log reason | n/a |

---

## 4. Supplier-only fields

| Field | Type | Why it matters for FDS |
|---|---|---|
| `product_categories` | list | Which collection(s) they'd fill (maps to your Collection Map) |
| `freight_terms` | text | Freight/LTL handling — core for $1,000+ items |
| `warranty_offered` | text | Verified warranty (feeds the `warranty` metafield later) |
| `map_policy` | text | Minimum advertised price rules — affects your pricing |
| `dealer_program` | enum | `dropship` \| `stocking` \| `none` \| `unknown` |
| `media_permission` | enum | `granted` \| `requested` \| `none` — gates images (Import SOP §7) |
| `authorization_status` | enum | `none` \| `pending` \| `authorized` |
| `catalog_size_est` | number | Rough SKU count they could add |

## 5. Lead-only fields

| Field | Type | Why it matters |
|---|---|---|
| `product_interest` | text | Which product/collection they asked about |
| `budget_signal` | enum | `unknown` \| `<1k` \| `1k-5k` \| `5k+` |
| `quote_amount` | money | If a quote was sent |
| `shopify_order_id` | link | If they've purchased |
| `intent` | enum | `browsing` \| `comparing` \| `ready-to-buy` |
| `objection` | text | The thing blocking the sale (feeds FAQ/SEO too) |

---

## 6. How Shopify feeds the CRM

The Shopify connector is already available. Mapping:

| Shopify object | Becomes / updates | How |
|---|---|---|
| **New customer** | A `lead` record (if not already one) | On create → make/lookup lead by email |
| **New order** | Lead → `Won`; attach `shopify_order_id`; log revenue | Order create event |
| **Abandoned checkout** | Lead → `Engaged` / `hot` priority; next action = follow-up | Checkout event |
| **Draft order / quote** | Lead `Quote Sent`; set `quote_amount` | Draft order |
| **Customer note/tag** | Merge into `context_summary` / `tags` | Sync |
| **Product a lead viewed/bought** | `product_interest` + link to collection | Order line items |

*Direction:* Shopify → CRM is read/enrich (Claude watches). CRM → Shopify is write-gated (creating a draft order/quote is a gated action you approve).

## 7. How Gmail feeds the CRM

Gmail is the live wire for both suppliers and leads. (Gmail connector needs to be authorized — see notes at end.) Mapping:

| Gmail event | CRM effect |
|---|---|
| **Inbound email from a known contact** | Update `last_contact`; re-summarize `context_summary`; advance status (e.g. Contacted → Replied); set a next action; **notify you if it's hot or needs a decision** |
| **Inbound from an unknown sender** that looks like a lead/supplier | Create a new record, classify `type`, draft a first response for the gate |
| **Your outbound (manual) email** | Log it; keep status honest so Claude doesn't double-message |
| **Reply matching a queued draft** | Supersede the draft; re-plan |
| **A thread going quiet N days** | Auto-generate a follow-up next action (safe-lane at notch 1+) |

Claude reads threads to keep `context_summary` and `next_action` true, so when you open a record you instantly know the story and the move — and so the PM can act overnight without you.

---

## 8. The "what needs to be done" logic (why the CRM is an engine, not a list)

Every record continuously resolves to **one** `next_action` with an owner and a due date. The PM computes this each run:

- **If `owner = claude` and the action is safe-lane** → the worker does it (draft/queue or auto-send per the autonomy notch).
- **If `owner = claude` and the action hits a hard stop** (price, legal, "no," cold-volume, a call) → it's drafted and dropped in **Approvals**, and you're pinged.
- **If `owner = you`** (take the call, attach a doc, make a pricing call) → it shows in your **My Actions** list and in the morning brief.

This is the mechanism behind "Claude solves the problem and works even when you don't prompt it": the CRM always knows the next move for every relationship, and the PM executes every move that's safe to execute.

---

## 9. Minimum viable version (build this first)

Don't build all 30+ fields on day one. The MVP that already delivers the core value:

**Spine:** `record_id, type, name, company, email, status, owner, next_action, next_action_due, priority, context_summary, last_contact, source, linked_thread, activity_log`
**Plus supplier:** `product_categories, dealer_program, media_permission, authorization_status`
**Plus lead:** `product_interest, intent, quote_amount`

That's enough to run the overnight loop, show a real pipeline board, and drive the approvals queue. Add the rest as workflows demand them.

---

## 10. Build notes for each platform

**As a Claude-native artifact (fastest):** the CRM is a JSON/table store the dashboard artifact reads and the nightly PM writes. Shopify sync is live via the connector; Gmail sync once authorized. Good enough to prove the whole loop this week.

**As a Fable app (later):** each record type is a table with the fields above; the pipeline is a Kanban board keyed on `status`; Shopify/Gmail come in via their connectors or a sync job; the approvals queue is a filtered view of gated actions. The model above is the schema — hand it straight to the build.

> **One connector note:** the Shopify connector is live now. **Gmail (and Ahrefs) still need to be authorized** before Claude can read supplier/lead threads or pull keyword data automatically. Until Gmail is connected, the CRM runs on Shopify data + anything you paste in; connecting Gmail is what turns on the real-time thread awareness that makes the overnight supplier loop fully autonomous.
