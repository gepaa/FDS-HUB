import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";
import {
  CALL_OUTCOMES,
  stageForOutcome,
  type CallNote,
  type CallOutcome,
} from "@/lib/cockpit";

export const dynamic = "force-dynamic";

const endInput = z.object({
  outcome: z.enum(CALL_OUTCOMES.map((o) => o.id) as [CallOutcome, ...CallOutcome[]]),
  durationSec: z.number().int().nonnegative(),
  contextSummary: z.string().trim().min(1).max(4000), // human-edited AI draft
  nextAction: z.string().trim().max(500).optional(),
  followUpDate: z.string().optional(), // yyyy-mm-dd
  quoteAmount: z.number().nonnegative().optional(),
  data: z.string().max(60000).optional(),
  notes: z.string().max(60000).optional(),
});

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

/**
 * POST /api/cockpit/[id]/end — close the call. Writes, atomically:
 * 1. the session row (outcome, duration, final state)
 * 2. a full call entry on the record's activity log
 * 3. the record itself: stage per outcome, the human-approved context
 *    summary + next action, follow-up date, quote, lastContactDate.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  const { id } = await params;

  const session = await prisma.callSession.findUnique({
    where: { id },
    include: { record: true },
  });
  if (!session) return Response.json({ error: "Not found" }, { status: 404 });
  if (session.endedAt) {
    return Response.json({ error: "Call already ended" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = endInput.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") },
      { status: 400 },
    );
  }
  const input = parsed.data;
  const record = session.record;

  let notes: CallNote[] = [];
  try {
    notes = JSON.parse(input.notes ?? session.notes) as CallNote[];
  } catch {
    notes = [];
  }
  const confirmed = notes.filter((n) => n.kind === "confirmed");
  const objections = notes.filter((n) => n.kind === "objection");
  const others = notes.filter((n) => n.kind === "note");

  const outcomeLabel =
    CALL_OUTCOMES.find((o) => o.id === input.outcome)?.label ?? input.outcome;
  const logBody = [
    `Call — ${outcomeLabel} (${fmtDuration(input.durationSec)})`,
    confirmed.length
      ? `Confirmed:\n${confirmed.map((n) => `• ${n.text}`).join("\n")}`
      : null,
    objections.length
      ? `Objections:\n${objections.map((n) => `• ${n.text}`).join("\n")}`
      : null,
    others.length ? `Notes:\n${others.map((n) => `• ${n.text}`).join("\n")}` : null,
    input.quoteAmount ? `Quote discussed: $${input.quoteAmount.toLocaleString()}` : null,
    input.nextAction ? `Next: ${input.nextAction}${input.followUpDate ? ` (${input.followUpDate})` : ""}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const newStage = stageForOutcome(input.outcome, record.type);
  const followUp =
    input.followUpDate && !Number.isNaN(new Date(input.followUpDate).getTime())
      ? new Date(`${input.followUpDate}T12:00:00`)
      : null;

  const [, , updatedRecord] = await prisma.$transaction([
    prisma.callSession.update({
      where: { id },
      data: {
        endedAt: new Date(),
        durationSec: input.durationSec,
        outcome: input.outcome,
        ...(input.data !== undefined ? { data: input.data } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    }),
    prisma.interaction.create({
      data: {
        recordId: record.id,
        type: "call",
        actor: actor === "claude" ? "claude" : "you",
        body: logBody.slice(0, 4000),
      },
    }),
    prisma.crmRecord.update({
      where: { id: record.id },
      data: {
        ...(newStage && newStage !== record.status ? { status: newStage } : {}),
        contextSummary: input.contextSummary,
        ...(input.nextAction ? { nextAction: input.nextAction } : {}),
        ...(followUp ? { nextActionDate: followUp } : {}),
        ...(input.quoteAmount !== undefined ? { quoteAmount: input.quoteAmount } : {}),
        lastContactDate: new Date(),
      },
    }),
  ]);

  if (newStage && newStage !== record.status) {
    await prisma.interaction.create({
      data: {
        recordId: record.id,
        type: "status",
        actor: actor === "claude" ? "claude" : "you",
        body: `Status ${record.status} → ${newStage} (call outcome: ${outcomeLabel})`,
      },
    });
  }

  return Response.json({
    ok: true,
    record: {
      id: updatedRecord.id,
      status: updatedRecord.status,
      nextAction: updatedRecord.nextAction,
    },
  });
}
