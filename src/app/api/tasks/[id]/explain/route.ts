import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";
import { completeText, extractJson } from "@/lib/agent/complete";
import { getProvider } from "@/lib/agent/provider";
import {
  EXPLAIN_SYSTEM,
  renderBrief,
  suggestionFrom,
  type Explanation,
} from "@/lib/tasks/explain";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/tasks/[id]/explain — expand a shorthand note into a real task.
 *
 * The brief is written onto the card. The suggested priority and due date
 * are NOT applied: they come back for a human to accept with one tap, the
 * same shape as every other AI proposal in the hub.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  const { id } = await params;

  const task = await prisma.hqTask.findUnique({
    where: { id },
    include: { record: true, attachments: true, assignedTo: true },
  });
  if (!task) return Response.json({ error: "Not found" }, { status: 404 });

  const context = [
    `TASK: ${task.title}`,
    task.detail ? `NOTES: ${task.detail}` : null,
    task.assignedTo ? `OWNER: ${task.assignedTo.name}` : null,
    task.priority ? `CURRENT PRIORITY: ${task.priority}` : null,
    task.dueDate
      ? `CURRENT DUE DATE: ${task.dueDate.toISOString().slice(0, 10)}`
      : null,
    task.record
      ? `LINKED CRM RECORD: ${task.record.name} — ${task.record.type}, stage ${task.record.status}${
          task.record.contextSummary ? `. Context: ${task.record.contextSummary}` : ""
        }`
      : null,
    // Titles only. The files themselves are not read — they can be
    // anything a teammate uploaded, and this prompt is not the place to
    // start trusting their contents.
    task.attachments.length
      ? `ATTACHED (titles only): ${task.attachments.map((a) => a.label).join("; ")}`
      : null,
    `TODAY: ${new Date().toISOString().slice(0, 10)}`,
  ]
    .filter(Boolean)
    .join("\n");

  // Three different failures, three different messages. Collapsing them
  // into one "no model configured" was actively misleading: it sent the
  // operator to fix an API key that was already set, while the real
  // error from the provider went in the bin.
  if (!getProvider()) {
    return Response.json(
      {
        error:
          "No model is configured for this hub. Set AI_PROVIDER + AI_API_KEY (or ANTHROPIC_API_KEY) and try again.",
      },
      { status: 503 },
    );
  }

  let raw: string | null;
  try {
    raw = await completeText(EXPLAIN_SYSTEM, context);
  } catch (e) {
    return Response.json(
      {
        error: `The model call failed: ${
          e instanceof Error ? e.message : String(e)
        }`,
      },
      { status: 502 },
    );
  }
  if (!raw) {
    return Response.json(
      { error: "The model returned an empty reply." },
      { status: 502 },
    );
  }

  const parsed = extractJson<Explanation>(raw);
  // A model that ignored the JSON instruction still wrote something
  // useful; keep its prose rather than throwing the turn away.
  const brief = parsed ? renderBrief(parsed) : raw.trim().slice(0, 4000);
  if (!brief) {
    return Response.json(
      { error: "The model replied with nothing usable." },
      { status: 502 },
    );
  }

  const updated = await prisma.hqTask.update({
    where: { id },
    data: { aiBrief: brief, aiBriefAt: new Date() },
  });

  return Response.json({
    aiBrief: updated.aiBrief,
    aiBriefAt: updated.aiBriefAt?.toISOString() ?? null,
    // Advisory only — the card shows these behind an "Apply" chip.
    suggestion: suggestionFrom(parsed),
  });
}
