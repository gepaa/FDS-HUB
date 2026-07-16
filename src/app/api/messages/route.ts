import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";

export const dynamic = "force-dynamic";

const messageInput = z.object({
  kind: z.enum(["brief", "ping", "log", "chat"]).default("chat"),
  title: z.string().nullable().optional(),
  body: z.string().trim().min(1).max(20000),
});

/** GET /api/messages?kind=brief — the agent-message feed. */
export async function GET(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");
  const messages = await prisma.agentMessage.findMany({
    where: kind ? { kind } : undefined,
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  return Response.json(messages);
}

/** POST /api/messages — the agent posts briefs/pings/logs; Pablo posts
 *  chat replies the PM reads on its next run. */
export async function POST(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;

  const body = await request.json().catch(() => null);
  const parsed = messageInput.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  const created = await prisma.agentMessage.create({
    data: {
      ...parsed.data,
      role: actor === "claude" ? "claude" : "you",
      // Humans post chat; agent kinds pass through as declared.
      kind: actor === "claude" ? parsed.data.kind : "chat",
    },
  });
  return Response.json(created, { status: 201 });
}
