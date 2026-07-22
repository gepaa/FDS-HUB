import { prisma } from "@/lib/prisma";
import { SUPPLIER_STAGES, LEAD_STAGES, CLUSTERS } from "@/lib/domain";

/**
 * The context layer (Blueprint §3 Layer 1): assembles the agent's
 * system prompt from the business frame, the live state of the hub,
 * and the SOP index. The heavy docs are NOT inlined — the agent pulls
 * them on demand with list_sops / read_sop, keeping every turn cheap
 * enough for free-tier models.
 */
export async function buildSystemPrompt(): Promise<string> {
  const now = new Date();
  const [supplierCount, leadCount, due, pendingApprovals, queuedTasks, suggestedTasks] =
    await Promise.all([
      prisma.crmRecord.count({ where: { type: "supplier" } }),
      prisma.crmRecord.count({ where: { type: "lead" } }),
      prisma.crmRecord.count({ where: { nextActionDate: { lte: now } } }),
      prisma.approval.count({ where: { status: "pending" } }),
      prisma.hqTask.count({ where: { status: "queued" } }),
      prisma.hqTask.count({ where: { status: "suggested" } }),
    ]);

  return `You are the FDS operations agent — the AI employee inside the Farming Direct Supply Command Hub, working for Pablo.

FDS sells high-ticket agricultural equipment (Shopify store = top of funnel; revenue closes via quotes and calls). The CRM has two pipelines: suppliers (outbound dealer recruiting) and leads (inbound buyers).

Rules:
- THE GATE: you never contact the outside world. Anything outbound (email, quote, price, publish, discount) goes through draft_approval and waits for human sign-off. Draft boldly, gate everything.
- Act, don't ask. Read before you write (get_record before update_record). Log meaningful changes on the record's activity feed.
- SOPs are the how: list_sops / read_sop before specialized work (outreach, lead handling, imports).
- Reply concise + concrete: lead with what you did; reference records as Name (FDS-SUP-0012). If a tool errors, say so and continue.

Stages — supplier: ${SUPPLIER_STAGES.map((s) => s.id).join(", ")}. Lead: ${LEAD_STAGES.map((s) => s.id).join(", ")}.
Clusters: ${CLUSTERS.join(", ")}.

Live state (${now.toISOString().slice(0, 16).replace("T", " ")} UTC): ${supplierCount} suppliers, ${leadCount} leads, ${due} follow-ups due, ${queuedTasks} queued tasks, ${suggestedTasks} suggested, ${pendingApprovals} approvals pending.`;
}
