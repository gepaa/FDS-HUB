import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";
import { completeText, extractJson } from "@/lib/agent/complete";
import { playbookQuestions } from "@/lib/cockpit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const assistInput = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("questions"),
    recordId: z.string(),
    context: z.string().max(4000).optional(), // free-form call context so far
  }),
  z.object({
    mode: z.literal("summary"),
    recordId: z.string(),
    outcome: z.string(),
    confirmedNotes: z.array(z.string()).max(60),
    otherNotes: z.array(z.string()).max(60),
    objection: z.string().optional(),
    quote: z.string().optional(),
  }),
]);

/**
 * POST /api/cockpit/assist — lightweight AI helpers for the cockpit.
 * Always answers: falls back to playbook content when no model is
 * configured or the model reply doesn't parse. Summaries are DRAFTS —
 * the UI keeps them editable and only confirmed notes feed them.
 */
export async function POST(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;

  const body = await request.json().catch(() => null);
  const parsed = assistInput.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const record = await prisma.crmRecord.findUnique({
    where: { id: input.recordId },
  });
  if (!record) return Response.json({ error: "Record not found" }, { status: 404 });

  if (input.mode === "questions") {
    const fallback = playbookQuestions(record.type, record.status);
    const raw = await completeText(
      "You are a sales coach for Farming Direct Supply, a high-ticket agricultural equipment dealer. Reply ONLY with a JSON array of 4 short, concrete questions the rep should ask next on this live call. No preamble.",
      `Record: ${record.name} (${record.type}, stage ${record.status}, priority ${record.priority ?? "-"})
Product interest: ${record.productInterest ?? "-"}
Context summary: ${record.contextSummary ?? "-"}
Notes so far this call:
${input.context || "(none yet)"}`,
    ).catch(() => null);
    const questions = extractJson<string[]>(raw);
    const clean =
      Array.isArray(questions) && questions.length
        ? questions.filter((q) => typeof q === "string").slice(0, 5)
        : fallback;
    return Response.json({ questions: clean, source: questions ? "ai" : "playbook" });
  }

  // ---- mode === "summary" ----
  const confirmed = input.confirmedNotes.join("\n- ");
  const others = input.otherNotes.join("\n- ");
  const fallbackSummary = [
    `Call outcome: ${input.outcome}.`,
    confirmed ? `Confirmed: ${input.confirmedNotes.join("; ")}.` : null,
    input.objection ? `Main objection: ${input.objection}.` : null,
    input.quote ? `Quote discussed: ${input.quote}.` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const raw = await completeText(
    `You write CRM summaries for a high-ticket ag-equipment dealer. Base the summary ONLY on the CONFIRMED facts; unconfirmed notes may inform the suggested next action but must not be stated as fact. Reply ONLY with JSON: {"contextSummary": "2-3 sentences, present state of the deal", "nextAction": "one concrete next step, imperative"}`,
    `Record: ${record.name} (${record.type}, stage ${record.status})
Existing summary: ${record.contextSummary ?? "-"}
Call outcome: ${input.outcome}
Main objection: ${input.objection || "-"}
Quote discussed: ${input.quote || "-"}
CONFIRMED facts from the call:
- ${confirmed || "(none)"}
Unconfirmed notes (context only):
- ${others || "(none)"}`,
  ).catch(() => null);
  const ai = extractJson<{ contextSummary?: string; nextAction?: string }>(raw);
  return Response.json({
    contextSummary: ai?.contextSummary?.trim() || fallbackSummary,
    nextAction:
      ai?.nextAction?.trim() ||
      (input.outcome === "quote_requested"
        ? "Build the quote and queue it for approval"
        : "Follow up per agreed date"),
    source: ai ? "ai" : "fallback",
  });
}
