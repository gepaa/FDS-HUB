# FDS — Supplier Outreach SOP

### The message sequence, tone, cadence, and escalation rules for recruiting suppliers to authorized-dealer status.

> **When this triggers.** A supplier sits at `QUALIFIED` (needs first contact), a contacted supplier goes quiet, or a reply arrives. Runs inside the nightly cycle. **Notch 0: every message is a draft in Approvals.**

---

## 1. Who gets contacted

Only records that pass qualification (see Sourcing & Qualification SOP): dealer/dropship program exists or is plausible, freight-capable products ≥ $1,000, warranty offered, no obvious MAP conflict. Priority order: `rank` (Gold → Silver → Bronze) within the category Pablo has prioritized, hottest `priority` first.

## 2. The sequence

| Step | Timing | Content |
|---|---|---|
| **First contact** | after qualification | Short dealer inquiry: who FDS is (online retailer, high-ticket ag equipment), the specific category fit — name their actual product line — and the ask: "do you offer a dealer / drop-ship program?" Offer reseller details. ≤ 120 words. |
| **Follow-up #1** | day 4 quiet | One new value point (e.g. the categories we're building, our buyer profile). Reference the first email. ≤ 80 words. |
| **Follow-up #2** | day 10 quiet | Short, warm, last nudge + offer a call. After this, `ON_HOLD` with a 60-day re-engage date. |
| **Reply handling** | same run | Answer their questions from verified facts only. Application forms → fill what we know, flag what we don't. Requests for documents (reseller cert etc.) → draft the reply, flag the attachment for Pablo. |
| **Call escalation** | when they engage on terms | Propose times, and build Pablo's call brief (Quote & Call-Prep SOP). Update status → `CALL_SCHEDULED`, owner → `you`. |

## 3. Tone rules

- Sound like Pablo: direct, warm, competent. No corporate filler, no AI-sounding phrasing, no exclamation marks in first contact.
- Every first contact is **personalized to their product line** — name a real product category of theirs. Never a mail-merge blast.
- Honest scale: FDS is a growing specialist retailer, not a giant. Don't inflate.
- Sign as Pablo, Farming Direct Supply.

## 4. Never auto-send (hard stops at every notch)

Prices/margins/quotes · legal or contract language · anything with an attachment · a reply to an annoyed thread · any "no" response · first contact at volume. These are always drafted for Pablo.

## 5. Status & bookkeeping

Every draft queued → note on the record + `next_action` set. Every send (after approval) → status `CONTACTED`, `last_contact` updated, follow-up scheduled. Every reply → status `REPLIED`/`IN_CONVERSATION`, context summary refreshed. Declines → `DECLINED` with the reason logged, and a replacement supplier suggested for sourcing.
