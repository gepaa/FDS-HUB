import { prisma } from "@/lib/prisma";
import { nextRecordId } from "@/lib/record-id";
import { recordPatch } from "@/lib/validation";
import {
  CLUSTERS,
  LEAD_STAGE_IDS,
  SUPPLIER_STAGE_IDS,
  type RecordType,
} from "@/lib/domain";
import { listSops, readSop } from "@/lib/sops";
import {
  getShopifyCustomers,
  getShopifyOverview,
  shopifyConfigured,
} from "@/lib/shopify";
import type { AgentToolDef, AgentToolResult, AgentToolCall, ToolLogEntry } from "@/lib/agent/types";

/**
 * The agent's hands: every tool works the hub's own data through
 * Prisma with the same discipline as the API routes — writes are
 * attributed to actor "claude" and logged on the record's activity
 * feed. The Blueprint's gate holds mechanically: there is NO tool
 * that sends email, publishes, or touches the outside world. Anything
 * outbound becomes an Approval draft for one-tap human review.
 */

// ---------- helpers ----------

// Keep tool results lean — free-tier models have small per-minute
// token budgets and every result is re-sent on each loop round.
const MAX_RESULT_CHARS = 3500;

function j(value: unknown): string {
  const s = JSON.stringify(value, null, 1);
  return s.length > MAX_RESULT_CHARS
    ? s.slice(0, MAX_RESULT_CHARS) + `\n…truncated (${s.length} chars total)`
    : s;
}

function compactRecord(r: {
  id: string;
  recordId: string | null;
  type: string;
  name: string;
  company: string | null;
  status: string;
  cluster: string;
  rank: string | null;
  priority: string | null;
  email: string | null;
  phone: string | null;
  websiteUrl: string | null;
  nextAction: string | null;
  nextActionDate: Date | null;
  lastContactDate: Date | null;
  contextSummary: string | null;
}) {
  return {
    id: r.id,
    recordId: r.recordId,
    type: r.type,
    name: r.name,
    company: r.company,
    status: r.status,
    cluster: r.cluster,
    rank: r.rank,
    priority: r.priority,
    email: r.email,
    phone: r.phone,
    websiteUrl: r.websiteUrl,
    nextAction: r.nextAction,
    nextActionDate: r.nextActionDate?.toISOString() ?? null,
    lastContactDate: r.lastContactDate?.toISOString() ?? null,
    contextSummary: r.contextSummary,
  };
}

async function logActivity(recordId: string, type: string, body: string) {
  await prisma.interaction.create({
    data: { recordId, type, body, actor: "claude" },
  });
}

// ---------- tool definitions + executors ----------

interface ToolImpl {
  def: AgentToolDef;
  run: (input: Record<string, unknown>) => Promise<{ content: string; summary: string }>;
}

const TOOLS: ToolImpl[] = [
  {
    def: {
      name: "search_records",
      description:
        "Search CRM records (suppliers + leads) by text/type/status/cluster/rank/priority. Compact rows; get_record for detail.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Free-text match on name, company, niche, email, notes" },
          type: { type: "string", enum: ["supplier", "lead"] },
          status: { type: "string", description: `Stage id, e.g. ${[...SUPPLIER_STAGE_IDS.slice(0, 3), "…"].join(", ")}` },
          cluster: { type: "string", enum: [...CLUSTERS] },
          rank: { type: "string", enum: ["Gold", "Silver", "Bronze"] },
          priority: { type: "string", enum: ["hot", "warm", "cold"] },
          dueOnly: { type: "boolean", description: "Only records whose nextActionDate is today or overdue" },
          limit: { type: "number", description: "Max results, default 20, max 50" },
        },
      },
    },
    async run(input) {
      const limit = Math.min(Number(input.limit) || 10, 25);
      const q = typeof input.query === "string" ? input.query.trim() : "";
      const where: Record<string, unknown> = {};
      if (input.type) where.type = input.type;
      if (input.status) where.status = input.status;
      if (input.cluster) where.cluster = input.cluster;
      if (input.rank) where.rank = input.rank;
      if (input.priority) where.priority = input.priority;
      if (input.dueOnly) where.nextActionDate = { lte: new Date() };
      if (q) {
        where.OR = ["name", "company", "niche", "email", "notes", "contextSummary"].map(
          (f) => ({ [f]: { contains: q } }),
        );
      }
      const rows = await prisma.crmRecord.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: limit,
      });
      const total = await prisma.crmRecord.count({ where });
      return {
        content: j({ total, showing: rows.length, records: rows.map(compactRecord) }),
        summary: `${total} match${total === 1 ? "" : "es"}${q ? ` for "${q}"` : ""}`,
      };
    },
  },
  {
    def: {
      name: "get_record",
      description:
        "One CRM record in full + recent activity. Accepts cuid, human id (FDS-SUP-0012), or exact name.",
      inputSchema: {
        type: "object",
        properties: { idOrName: { type: "string" } },
        required: ["idOrName"],
      },
    },
    async run(input) {
      const key = String(input.idOrName ?? "").trim();
      const record = await prisma.crmRecord.findFirst({
        where: { OR: [{ id: key }, { recordId: key }, { name: key }] },
        include: { interactions: { orderBy: { date: "desc" }, take: 8 } },
      });
      if (!record) return { content: `No record found for "${key}".`, summary: "not found" };
      const { interactions, ...fields } = record;
      return {
        content: j({
          ...fields,
          interactions: interactions.map((i) => ({
            date: i.date.toISOString(),
            type: i.type,
            actor: i.actor,
            body: i.body,
          })),
        }),
        summary: `${record.name} (${record.status})`,
      };
    },
  },
  {
    def: {
      name: "create_record",
      description:
        "Create a CRM record (supplier or lead); human id auto-allocated, creation logged.",
      inputSchema: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["supplier", "lead"] },
          name: { type: "string" },
          company: { type: "string" },
          niche: { type: "string" },
          cluster: { type: "string", enum: [...CLUSTERS] },
          status: { type: "string", description: "Stage id valid for the type; defaults to SOURCED / NEW" },
          rank: { type: "string", enum: ["Gold", "Silver", "Bronze"] },
          priority: { type: "string", enum: ["hot", "warm", "cold"] },
          email: { type: "string" },
          phone: { type: "string" },
          websiteUrl: { type: "string" },
          mainContact: { type: "string" },
          productInterest: { type: "string" },
          nextAction: { type: "string" },
          nextActionDate: { type: "string", description: "ISO date" },
          notes: { type: "string" },
          source: { type: "string" },
        },
        required: ["type", "name"],
      },
    },
    async run(input) {
      const type = (input.type === "lead" ? "lead" : "supplier") as RecordType;
      const ladder = type === "lead" ? LEAD_STAGE_IDS : SUPPLIER_STAGE_IDS;
      const status =
        typeof input.status === "string" && ladder.includes(input.status as never)
          ? (input.status as string)
          : type === "lead"
            ? "NEW"
            : "SOURCED";
      const recordId = await nextRecordId(type);
      const str = (k: string) =>
        typeof input[k] === "string" && (input[k] as string).trim()
          ? (input[k] as string).trim()
          : null;
      const record = await prisma.crmRecord.create({
        data: {
          type,
          recordId,
          name: String(input.name).trim(),
          status,
          owner: "claude",
          company: str("company"),
          niche: str("niche"),
          cluster:
            typeof input.cluster === "string" && (CLUSTERS as readonly string[]).includes(input.cluster)
              ? (input.cluster as string)
              : "Other",
          rank: str("rank"),
          priority: str("priority"),
          email: str("email"),
          phone: str("phone"),
          websiteUrl: str("websiteUrl"),
          mainContact: str("mainContact"),
          productInterest: str("productInterest"),
          nextAction: str("nextAction"),
          nextActionDate: input.nextActionDate ? new Date(String(input.nextActionDate)) : null,
          notes: str("notes"),
          source: str("source") ?? "agent-chat",
        },
      });
      await logActivity(record.id, "system", `Record created by the agent (${recordId}).`);
      return {
        content: j(compactRecord(record)),
        summary: `created ${recordId} · ${record.name}`,
      };
    },
  },
  {
    def: {
      name: "update_record",
      description:
        "Update record fields (status/priority/nextAction/contextSummary/contact/notes…). Status must fit the type's ladder; changes are logged.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "cuid id or human id (FDS-SUP-0012)" },
          fields: {
            type: "object",
            description:
              "Partial record fields to set, e.g. {\"status\":\"CONTACTED\",\"nextAction\":\"Follow up Thu\",\"priority\":\"hot\"}",
          },
        },
        required: ["id", "fields"],
      },
    },
    async run(input) {
      const key = String(input.id ?? "").trim();
      const existing = await prisma.crmRecord.findFirst({
        where: { OR: [{ id: key }, { recordId: key }] },
      });
      if (!existing) return { content: `No record "${key}".`, summary: "not found" };
      const parsed = recordPatch.safeParse(input.fields ?? {});
      if (!parsed.success) {
        return {
          content: `Invalid fields: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
          summary: "invalid fields",
        };
      }
      const data = Object.fromEntries(
        Object.entries(parsed.data).filter(([, v]) => v !== undefined),
      );
      if (typeof data.status === "string") {
        const ladder =
          existing.type === "lead" ? LEAD_STAGE_IDS : SUPPLIER_STAGE_IDS;
        if (!(ladder as readonly string[]).includes(data.status)) {
          return {
            content: `"${data.status}" is not a valid ${existing.type} stage. Valid: ${ladder.join(", ")}`,
            summary: "invalid stage",
          };
        }
      }
      if (Array.isArray(data.tags)) data.tags = JSON.stringify(data.tags) as never;
      if (Array.isArray(data.productCategories))
        data.productCategories = JSON.stringify(data.productCategories) as never;
      const updated = await prisma.crmRecord.update({
        where: { id: existing.id },
        data,
      });
      const changed = Object.keys(data).join(", ");
      await logActivity(
        existing.id,
        typeof data.status === "string" && data.status !== existing.status ? "status" : "system",
        typeof data.status === "string" && data.status !== existing.status
          ? `Status ${existing.status} → ${data.status} (agent). Also set: ${changed}`
          : `Agent updated: ${changed}`,
      );
      return {
        content: j(compactRecord(updated)),
        summary: `${existing.name}: set ${changed}`,
      };
    },
  },
  {
    def: {
      name: "log_interaction",
      description: "Append to a record's activity log (call/email/note…).",
      inputSchema: {
        type: "object",
        properties: {
          recordId: { type: "string", description: "cuid or human id" },
          type: { type: "string", enum: ["email", "call", "form", "note", "status", "system"] },
          body: { type: "string" },
        },
        required: ["recordId", "type", "body"],
      },
    },
    async run(input) {
      const key = String(input.recordId ?? "").trim();
      const record = await prisma.crmRecord.findFirst({
        where: { OR: [{ id: key }, { recordId: key }] },
      });
      if (!record) return { content: `No record "${key}".`, summary: "not found" };
      await prisma.interaction.create({
        data: {
          recordId: record.id,
          type: String(input.type),
          body: String(input.body).slice(0, 4000),
          actor: "claude",
        },
      });
      return { content: "Logged.", summary: `note on ${record.name}` };
    },
  },
  {
    def: {
      name: "list_tasks",
      description: "List HQ tasks. Statuses: suggested, queued, running, done, cancelled.",
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["suggested", "queued", "running", "done", "cancelled"] },
          limit: { type: "number" },
        },
      },
    },
    async run(input) {
      const tasks = await prisma.hqTask.findMany({
        where: input.status ? { status: String(input.status) } : undefined,
        orderBy: { createdAt: "desc" },
        take: Math.min(Number(input.limit) || 25, 50),
      });
      return {
        content: j(
          tasks.map((t) => ({
            id: t.id,
            title: t.title,
            detail: t.detail,
            status: t.status,
            assignee: t.assignee,
            origin: t.origin,
            result: t.result,
            createdAt: t.createdAt.toISOString(),
          })),
        ),
        summary: `${tasks.length} task${tasks.length === 1 ? "" : "s"}`,
      };
    },
  },
  {
    def: {
      name: "create_task",
      description:
        "Add an HQ task: 'queued' when the user asked for it, 'suggested' when you're proposing work.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          status: { type: "string", enum: ["queued", "suggested"] },
          assignee: { type: "string", enum: ["claude", "you"] },
        },
        required: ["title"],
      },
    },
    async run(input) {
      const task = await prisma.hqTask.create({
        data: {
          title: String(input.title).slice(0, 300),
          detail: typeof input.detail === "string" ? input.detail : null,
          status: input.status === "suggested" ? "suggested" : "queued",
          assignee: input.assignee === "you" ? "you" : "claude",
          origin: "claude",
        },
      });
      return {
        content: j({ id: task.id, title: task.title, status: task.status }),
        summary: `${task.status}: ${task.title}`,
      };
    },
  },
  {
    def: {
      name: "update_task",
      description:
        "Update a task: queued→running→done (+result note) or edit title/detail. You can't cancel user-queued tasks.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          status: { type: "string", enum: ["queued", "running", "done"] },
          result: { type: "string", description: "Outcome note shown on the task card" },
          title: { type: "string" },
          detail: { type: "string" },
        },
        required: ["id"],
      },
    },
    async run(input) {
      const existing = await prisma.hqTask.findUnique({ where: { id: String(input.id) } });
      if (!existing) return { content: `No task "${input.id}".`, summary: "not found" };
      const data: Record<string, unknown> = {};
      if (typeof input.title === "string") data.title = input.title.slice(0, 300);
      if (typeof input.detail === "string") data.detail = input.detail;
      if (typeof input.result === "string") data.result = input.result;
      if (typeof input.status === "string") {
        const ok =
          (existing.status === "suggested" && input.status === "queued") ||
          (existing.status === "queued" && input.status === "running") ||
          (existing.status === "running" && input.status === "done") ||
          (existing.status === "queued" && input.status === "done");
        if (!ok) {
          return {
            content: `Not allowed: ${existing.status} → ${input.status}.`,
            summary: "blocked transition",
          };
        }
        data.status = input.status;
        if (input.status === "done") data.completedAt = new Date();
      }
      const t = await prisma.hqTask.update({ where: { id: existing.id }, data });
      return {
        content: j({ id: t.id, title: t.title, status: t.status, result: t.result }),
        summary: `${t.title} → ${t.status}`,
      };
    },
  },
  {
    def: {
      name: "list_approvals",
      description:
        "List Approvals-gate items (drafted outbound actions awaiting sign-off).",
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending", "approved", "rejected", "snoozed", "executed"] },
        },
      },
    },
    async run(input) {
      const rows = await prisma.approval.findMany({
        where: { status: String(input.status ?? "pending") },
        orderBy: { createdAt: "desc" },
        take: 25,
        include: { record: { select: { name: true, recordId: true } } },
      });
      return {
        content: j(
          rows.map((a) => ({
            id: a.id,
            kind: a.kind,
            title: a.title,
            record: a.record ? `${a.record.name} (${a.record.recordId})` : null,
            draftSubject: a.draftSubject,
            draftBody: a.draftBody.slice(0, 500),
            reasoning: a.reasoning,
            status: a.status,
            decisionNote: a.decisionNote,
          })),
        ),
        summary: `${rows.length} ${String(input.status ?? "pending")}`,
      };
    },
  },
  {
    def: {
      name: "draft_approval",
      description:
        "THE GATE: queue any outbound/irreversible action (email, quote, publish, discount) as a draft for human approval. Nothing sends without it.",
      inputSchema: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["outbound_email", "publish_product", "price_quote", "discount", "other"],
          },
          title: { type: "string", description: "Short card title, e.g. 'First contact → Baumalight'" },
          recordId: { type: "string", description: "Related CRM record (cuid or human id), if any" },
          draftSubject: { type: "string" },
          draftBody: { type: "string", description: "The full draft (email body, quote text, …)" },
          reasoning: { type: "string", description: "Why this action, why now — shown on the approval card" },
        },
        required: ["kind", "title", "draftBody", "reasoning"],
      },
    },
    async run(input) {
      let recordCuid: string | null = null;
      if (input.recordId) {
        const rec = await prisma.crmRecord.findFirst({
          where: { OR: [{ id: String(input.recordId) }, { recordId: String(input.recordId) }] },
        });
        recordCuid = rec?.id ?? null;
      }
      const approval = await prisma.approval.create({
        data: {
          kind: String(input.kind),
          title: String(input.title).slice(0, 300),
          recordId: recordCuid,
          draftSubject: typeof input.draftSubject === "string" ? input.draftSubject : null,
          draftBody: String(input.draftBody),
          reasoning: String(input.reasoning),
          createdBy: "claude",
        },
      });
      if (recordCuid) {
        await logActivity(
          recordCuid,
          "system",
          `Agent queued "${approval.title}" for approval (${approval.kind}).`,
        );
      }
      return {
        content: j({ id: approval.id, title: approval.title, status: approval.status }),
        summary: `queued for approval: ${approval.title}`,
      };
    },
  },
  {
    def: {
      name: "pipeline_stats",
      description:
        "Live HQ snapshot: counts by stage, due follow-ups, tasks, approvals, recent activity.",
      inputSchema: { type: "object", properties: {} },
    },
    async run() {
      const [byStatus, tasks, approvals, due, recent] = await Promise.all([
        prisma.crmRecord.groupBy({ by: ["type", "status"], _count: { _all: true } }),
        prisma.hqTask.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.approval.count({ where: { status: "pending" } }),
        prisma.crmRecord.count({ where: { nextActionDate: { lte: new Date() } } }),
        prisma.interaction.findMany({
          orderBy: { date: "desc" },
          take: 5,
          include: { record: { select: { name: true } } },
        }),
      ]);
      return {
        content: j({
          records: byStatus.map((r) => ({ type: r.type, status: r.status, count: r._count._all })),
          tasks: tasks.map((t) => ({ status: t.status, count: t._count._all })),
          pendingApprovals: approvals,
          dueFollowUps: due,
          recentActivity: recent.map((i) => ({
            date: i.date.toISOString(),
            record: i.record.name,
            type: i.type,
            actor: i.actor,
            body: i.body.slice(0, 100),
          })),
        }),
        summary: `${due} due follow-ups · ${approvals} pending approvals`,
      };
    },
  },
  {
    def: {
      name: "list_sops",
      description:
        "List SOPs + core context docs; open one with read_sop before specialized work.",
      inputSchema: { type: "object", properties: {} },
    },
    async run() {
      const entries = listSops().map((s) => ({
        slug: s.slug,
        title: s.title,
        group: s.group,
        status: s.status,
        excerpt: s.excerpt,
      }));
      return { content: j(entries), summary: `${entries.length} docs` };
    },
  },
  {
    def: {
      name: "read_sop",
      description: "Read one SOP or context doc in full by slug (from list_sops).",
      inputSchema: {
        type: "object",
        properties: { slug: { type: "string" } },
        required: ["slug"],
      },
    },
    async run(input) {
      const doc = readSop(String(input.slug ?? ""));
      if (!doc) return { content: `No doc "${input.slug}".`, summary: "not found" };
      const body =
        doc.markdown.length > 7000
          ? doc.markdown.slice(0, 7000) + "\n…truncated"
          : doc.markdown;
      return { content: body, summary: doc.title };
    },
  },
  {
    def: {
      name: "shopify_customers",
      description:
        "Latest Shopify store customers (name/email/phone/location/orders/spend). Use with search_records + create_record to sync buyers into the CRM as leads.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "number", description: "Max 50, default 25" } },
      },
    },
    async run(input) {
      if (!shopifyConfigured()) {
        return {
          content:
            "Shopify is not connected (missing SHOPIFY_* env vars) — see Integrations.",
          summary: "Shopify not connected",
        };
      }
      const customers = await getShopifyCustomers(Number(input.limit) || 25);
      return {
        content: j(customers),
        summary: `${customers.length} customers`,
      };
    },
  },
  {
    def: {
      name: "shopify_overview",
      description:
        "Store snapshot: product/customer counts, vendors, recent orders.",
      inputSchema: { type: "object", properties: {} },
    },
    async run() {
      if (!shopifyConfigured()) {
        return {
          content:
            "Shopify is not connected (missing SHOPIFY_* env vars) — see Integrations.",
          summary: "Shopify not connected",
        };
      }
      const o = await getShopifyOverview();
      return {
        content: j({
          shop: o.shop,
          products: o.productsCount,
          customers: o.customersCount,
          vendors: o.vendors.slice(0, 40),
          recentOrders: o.recentOrders?.slice(0, 8) ?? null,
        }),
        summary: o.shop ? `${o.shop.name}: ${o.productsCount ?? "?"} products` : "partial data",
      };
    },
  },
  {
    def: {
      name: "post_agent_message",
      description:
        "Post a brief/ping/log to the HQ feed (durable summaries shown on the dashboard).",
      inputSchema: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["brief", "ping", "log"] },
          title: { type: "string" },
          body: { type: "string" },
        },
        required: ["kind", "body"],
      },
    },
    async run(input) {
      await prisma.agentMessage.create({
        data: {
          role: "claude",
          kind: String(input.kind),
          title: typeof input.title === "string" ? input.title : null,
          body: String(input.body).slice(0, 20000),
        },
      });
      return { content: "Posted.", summary: `${input.kind} posted` };
    },
  },
];

export const AGENT_TOOL_DEFS: AgentToolDef[] = TOOLS.map((t) => t.def);

/** Execute one tool call; never throws — errors come back as results. */
export async function executeToolCall(
  call: AgentToolCall,
): Promise<{ result: AgentToolResult; log: ToolLogEntry }> {
  const impl = TOOLS.find((t) => t.def.name === call.name);
  if (!impl) {
    return {
      result: { id: call.id, name: call.name, content: `Unknown tool "${call.name}".`, isError: true },
      log: { tool: call.name, summary: "unknown tool", isError: true },
    };
  }
  try {
    const { content, summary } = await impl.run(call.input ?? {});
    return {
      result: { id: call.id, name: call.name, content },
      log: { tool: call.name, summary },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "tool failed";
    return {
      result: { id: call.id, name: call.name, content: `Error: ${message}`, isError: true },
      log: { tool: call.name, summary: message.slice(0, 120), isError: true },
    };
  }
}
