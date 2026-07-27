import { prisma } from "@/lib/prisma";
import { completeText, extractJson } from "@/lib/agent/complete";
import { resolveProviderConfig } from "@/lib/agent/provider";
import {
  parseExtraction,
  safeFollowUpDate,
  type CallExtraction,
} from "@/lib/quo/extraction-schema";
import { quoStatus } from "@/lib/quo/config";

/**
 * Turning a call into structured sales data.
 *
 * Quo gives us the transcript and its own summary. On the Business plan
 * it does NOT give us action items — those are a Scale-plan feature —
 * so the follow-up a salesperson actually needs comes from here.
 *
 * What this deliberately does not do:
 *   - it never rewrites Quo's transcript or summary; those rows are
 *     stored separately and left alone
 *   - it never marks a deal won or lost
 *   - it never sends anything to a customer
 *   - it never creates a task that is already live: follow-ups land as
 *     `suggested` and wait for a human
 */

const SYSTEM_PROMPT = `You extract structured sales data from telephone calls for Farmer Direct Supply (FDS), which sells high-ticket farming and homesteading equipment: tractor attachments, livestock handling gear, greenhouses, fencing, sprayers, irrigation and trailers.

You will be given a call transcript and, when available, the phone system's own summary. Return ONE JSON object and nothing else — no prose, no markdown fence.

RULES, in order of importance:

1. Never invent. If a budget, delivery location, product model, quantity or date was not actually stated, the value is null. An empty answer is correct; a plausible guess is a defect.
2. Never record that stock is available unless the call contains an explicit confirmation from an authorised source. Wanting it in stock is not confirmation.
3. Never record that freight or a price is confirmed unless it actually was. Distinguish "I'll find out and call you back" from "it is $450".
4. The promise flags (inventoryPromiseMade, pricingPromiseMade, freightPromiseMade) describe what OUR salesperson committed to doing or asserted — not what the customer asked for.
5. Record commitments verbatim in meaning. Do not soften, upgrade or invent a promise the salesperson did not make.
6. If the transcript is unclear, partial, or you are unsure about anything material, set needsHumanReview to true and list what you are unsure about in uncertainties.
7. intentScore is 0-100 buying intent based only on evidence in the call. Explain it in one sentence in intentReason.
8. recommendedFollowUpAt must be an ISO 8601 date-time, or null. Use null rather than picking an arbitrary date.

Return exactly this shape:
{
  "shortSummary": string,
  "customerNeed": string | null,
  "productsMentioned": [{"name": string, "model": string | null, "quantity": number | null}],
  "productCategory": string | null,
  "budget": {"amount": number | null, "currency": string | null, "confidence": number},
  "deliveryLocation": {"city": string | null, "state": string | null, "postcode": string | null, "country": string | null},
  "desiredTimeline": string | null,
  "questionsAsked": [string],
  "objections": [string],
  "shippingConcerns": [string],
  "priceMatchRequested": boolean | null,
  "inventoryPromiseMade": boolean,
  "pricingPromiseMade": boolean,
  "freightPromiseMade": boolean,
  "customerCommitments": [string],
  "salespersonCommitments": [string],
  "recommendedNextAction": string | null,
  "recommendedFollowUpAt": string | null,
  "intentScore": number,
  "intentReason": string,
  "needsHumanReview": boolean,
  "uncertainties": [string]
}`;

/** Transcripts can be long; keep the prompt within a sane budget. */
const MAX_TRANSCRIPT_CHARS = 24_000;

export type ExtractionOutcome =
  | { status: "completed"; extraction: CallExtraction }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

export async function runExtraction(
  activityId: string,
): Promise<ExtractionOutcome> {
  if (!quoStatus().canExtract) {
    return { status: "skipped", reason: "extraction_disabled" };
  }

  const activity = await prisma.commsActivity.findUnique({
    where: { id: activityId },
    include: { artifacts: true },
  });
  if (!activity) return { status: "skipped", reason: "activity_missing" };

  const transcript = activity.artifacts.find((a) => a.kind === "transcript");
  const summary = activity.artifacts.find((a) => a.kind === "summary");

  const transcriptText = transcript?.text?.trim() ?? "";
  const summaryBullets = parseJsonArray(summary?.bullets);

  // Nothing to read. Not a failure — plenty of calls are 20 seconds of
  // "wrong number", and on the Starter plan there are no transcripts at
  // all. Recording this as skipped keeps the settings page honest.
  if (!transcriptText && summaryBullets.length === 0) {
    await writeStatus(activityId, "skipped", "no_transcript_or_summary");
    return { status: "skipped", reason: "no_transcript_or_summary" };
  }

  const speakerHint =
    activity.direction === "incoming"
      ? "The customer called us."
      : "We called the customer.";

  const user = [
    `${speakerHint} Call duration: ${activity.durationSec ?? "unknown"} seconds.`,
    summaryBullets.length
      ? `\nPHONE SYSTEM SUMMARY:\n${summaryBullets.map((b) => `- ${b}`).join("\n")}`
      : "",
    transcriptText
      ? `\nTRANSCRIPT:\n${transcriptText.slice(0, MAX_TRANSCRIPT_CHARS)}`
      : "\n(No transcript available — work only from the summary above, and set needsHumanReview to true.)",
  ]
    .filter(Boolean)
    .join("\n");

  let raw: string | null;
  try {
    raw = await completeText(SYSTEM_PROMPT, user);
  } catch (err) {
    const reason = err instanceof Error ? err.message : "model_error";
    await writeStatus(activityId, "failed", reason);
    return { status: "failed", reason };
  }

  if (!raw) {
    await writeStatus(activityId, "skipped", "no_ai_provider");
    return { status: "skipped", reason: "no_ai_provider" };
  }

  const parsed = parseExtraction(extractJson(raw));
  if (!parsed) {
    await writeStatus(activityId, "failed", "invalid_extraction_shape");
    return { status: "failed", reason: "invalid_extraction_shape" };
  }

  const model = resolveProviderConfig()?.model ?? null;

  await prisma.callExtraction.upsert({
    where: { activityId },
    create: {
      activityId,
      status: "completed",
      model,
      data: JSON.stringify(parsed),
      crmNote: buildCrmNote(parsed),
      intentScore: parsed.intentScore,
      needsHumanReview: parsed.needsHumanReview,
      error: null,
    },
    update: {
      status: "completed",
      model,
      data: JSON.stringify(parsed),
      // A human edit of the note is never overwritten by a re-run.
      ...(await noteUpdateFor(activityId, parsed)),
      intentScore: parsed.intentScore,
      needsHumanReview: parsed.needsHumanReview,
      error: null,
    },
  });

  await proposeFollowUp(activityId, parsed);

  return { status: "completed", extraction: parsed };
}

/** Only refresh the generated note if nobody has edited it. */
async function noteUpdateFor(
  activityId: string,
  parsed: CallExtraction,
): Promise<Record<string, unknown>> {
  const existing = await prisma.callExtraction.findUnique({
    where: { activityId },
    select: { crmNoteEditedAt: true },
  });
  if (existing?.crmNoteEditedAt) return {};
  return { crmNote: buildCrmNote(parsed) };
}

/**
 * The editable CRM note. Short on purpose — a salesperson scanning a
 * lead needs the shape of the call, not a retelling of it.
 */
export function buildCrmNote(e: CallExtraction): string {
  const lines: string[] = [e.shortSummary];

  if (e.customerNeed) lines.push(`Need: ${e.customerNeed}`);

  if (e.productsMentioned.length) {
    const items = e.productsMentioned
      .map((p) =>
        [p.name, p.model, p.quantity ? `x${p.quantity}` : null]
          .filter(Boolean)
          .join(" "),
      )
      .join("; ");
    lines.push(`Products: ${items}`);
  }

  if (e.budget.amount !== null) {
    const cur = e.budget.currency ?? "";
    const confidence = e.budget.confidence < 0.6 ? " (uncertain)" : "";
    lines.push(`Budget: ${cur}${e.budget.amount}${confidence}`);
  }

  const place = [
    e.deliveryLocation.city,
    e.deliveryLocation.state,
    e.deliveryLocation.postcode,
  ]
    .filter(Boolean)
    .join(", ");
  if (place) lines.push(`Delivery: ${place}`);

  if (e.desiredTimeline) lines.push(`Timeline: ${e.desiredTimeline}`);
  if (e.objections.length) lines.push(`Objections: ${e.objections.join("; ")}`);

  if (e.salespersonCommitments.length) {
    lines.push(`We promised: ${e.salespersonCommitments.join("; ")}`);
  }
  if (e.customerCommitments.length) {
    lines.push(`They agreed: ${e.customerCommitments.join("; ")}`);
  }

  // Surface unverified promises loudly — this is the thing that costs
  // FDS money when it is forgotten.
  const promises: string[] = [];
  if (e.inventoryPromiseMade) promises.push("stock");
  if (e.pricingPromiseMade) promises.push("price");
  if (e.freightPromiseMade) promises.push("freight");
  if (promises.length) {
    lines.push(`⚠ Promised to confirm: ${promises.join(", ")} — not verified.`);
  }

  if (e.uncertainties.length) {
    lines.push(`Unclear: ${e.uncertainties.join("; ")}`);
  }

  return lines.join("\n");
}

/**
 * Create the proposed follow-up.
 *
 * Status `suggested` is the CRM's existing "the agent proposes, a human
 * accepts" state. Nothing here goes out to a customer, and nothing is
 * queued for execution — accepting it is a deliberate click.
 */
async function proposeFollowUp(
  activityId: string,
  e: CallExtraction,
): Promise<void> {
  if (!e.recommendedNextAction) return;

  const existing = await prisma.hqTask.findFirst({
    where: { activityId, source: "quo_call" },
  });
  if (existing) return; // one proposal per call

  const activity = await prisma.commsActivity.findUnique({
    where: { id: activityId },
    include: { record: { select: { id: true, name: true } } },
  });
  if (!activity) return;

  const who = activity.record?.name ?? "caller";
  const due = safeFollowUpDate(e.recommendedFollowUpAt);

  const detailLines = [e.recommendedNextAction];
  if (e.salespersonCommitments.length) {
    detailLines.push(`Promised: ${e.salespersonCommitments.join("; ")}`);
  }
  if (e.intentReason) detailLines.push(`Intent: ${e.intentReason}`);

  await prisma.hqTask.create({
    data: {
      title: `Follow up with ${who}`,
      detail: detailLines.join("\n"),
      status: "suggested",
      assignee: "you",
      origin: "claude",
      recordId: activity.recordId,
      activityId,
      dueDate: due,
      priority: e.intentScore >= 70 ? "hot" : e.intentScore >= 40 ? "warm" : "cold",
      source: "quo_call",
      aiGenerated: true,
      humanConfirmed: false,
    },
  });
}

async function writeStatus(
  activityId: string,
  status: string,
  error: string | null,
): Promise<void> {
  await prisma.callExtraction.upsert({
    where: { activityId },
    create: { activityId, status, error },
    update: { status, error },
  });
}

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
