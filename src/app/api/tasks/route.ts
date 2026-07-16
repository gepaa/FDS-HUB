import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";

export const dynamic = "force-dynamic";

const taskInput = z.object({
  title: z.string().trim().min(1).max(300),
  detail: z.string().nullable().optional(),
  status: z
    .enum(["suggested", "queued", "running", "done", "cancelled"])
    .optional(),
  assignee: z.enum(["claude", "you"]).default("claude"),
});

/** GET /api/tasks?status=queued — the task queue. */
export async function GET(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const tasks = await prisma.hqTask.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return Response.json(tasks);
}

/** POST /api/tasks — assign work. The agent may only *suggest* tasks;
 *  a human promotes suggestions into the queue. */
export async function POST(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;

  const body = await request.json().catch(() => null);
  const parsed = taskInput.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  const created = await prisma.hqTask.create({
    data: {
      ...parsed.data,
      origin: actor === "claude" ? "claude" : "you",
      status:
        actor === "claude" ? "suggested" : (parsed.data.status ?? "queued"),
    },
  });
  return Response.json(created, { status: 201 });
}
