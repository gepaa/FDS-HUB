import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";
import { PRIORITY_IDS, REPEAT_IDS } from "@/lib/reminders";

export const dynamic = "force-dynamic";

/**
 * `dueAt` accepts either a plain date ("2026-08-05", what the
 * <input type="date"> sends) or a full ISO timestamp. A plain date is
 * anchored to UTC midnight so the calendar-day comparisons in
 * lib/reminders behave identically on every machine — see the UTC note
 * there.
 */
const dueAtSchema = z
  .string()
  .trim()
  .min(1, "A due date is required")
  .transform((v, ctx) => {
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00.000Z` : v;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Invalid due date" });
      return z.NEVER;
    }
    return d;
  });

const reminderInput = z.object({
  title: z.string().trim().min(1, "Give the reminder a title").max(200),
  detail: z.string().trim().max(2000).nullable().optional(),
  dueAt: dueAtSchema,
  repeat: z.enum(REPEAT_IDS as [string, ...string[]]).default("none"),
  priority: z.enum(PRIORITY_IDS as [string, ...string[]]).default("normal"),
  category: z.string().trim().max(80).nullable().optional(),
});

/** GET /api/reminders — every reminder with its delivery history. */
export async function GET(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;

  const reminders = await prisma.reminder.findMany({
    orderBy: [{ dueAt: "asc" }],
    take: 500,
    include: { events: { orderBy: { createdAt: "desc" }, take: 10 } },
  });
  return Response.json(reminders);
}

/** POST /api/reminders — create a reminder. */
export async function POST(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;

  const body = await request.json().catch(() => null);
  const parsed = reminderInput.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const created = await prisma.reminder.create({
    data: {
      title: d.title,
      detail: d.detail ?? null,
      dueAt: d.dueAt,
      repeat: d.repeat,
      priority: d.priority,
      category: d.category ?? null,
      createdBy: actor,
    },
    include: { events: true },
  });

  return Response.json(created, { status: 201 });
}
