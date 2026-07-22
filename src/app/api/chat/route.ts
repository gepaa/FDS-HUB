import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";
import { runAgent } from "@/lib/agent/loop";
import type { AgentEvent } from "@/lib/agent/types";

export const dynamic = "force-dynamic";
// Give long multi-tool agent runs room on Vercel.
export const maxDuration = 60;

const chatInput = z.object({
  sessionId: z.string().optional(),
  message: z.string().trim().min(1).max(20000),
});

/** GET /api/chat → sessions list; ?session=<id> → that session's messages. */
export async function GET(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session");

  if (sessionId) {
    const messages = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    return Response.json(messages);
  }
  const sessions = await prisma.chatSession.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: { _count: { select: { messages: true } } },
  });
  return Response.json(
    sessions.map((s) => ({
      id: s.id,
      title: s.title,
      updatedAt: s.updatedAt.toISOString(),
      messageCount: s._count.messages,
    })),
  );
}

/** DELETE /api/chat?session=<id> — remove a conversation. */
export async function DELETE(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session");
  if (!sessionId) return Response.json({ error: "session required" }, { status: 400 });
  await prisma.chatSession.delete({ where: { id: sessionId } }).catch(() => null);
  return Response.json({ ok: true });
}

/**
 * POST /api/chat — send a message to the agent; the reply streams back
 * as Server-Sent Events carrying AgentEvent JSON payloads.
 */
export async function POST(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;

  const body = await request.json().catch(() => null);
  const parsed = chatInput.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  const { message } = parsed.data;

  // Resolve or create the session.
  let session =
    parsed.data.sessionId != null
      ? await prisma.chatSession.findUnique({ where: { id: parsed.data.sessionId } })
      : null;
  const isNew = !session;
  if (!session) {
    session = await prisma.chatSession.create({
      data: { title: message.slice(0, 60) + (message.length > 60 ? "…" : "") },
    });
  }
  const sessionId = session.id;

  await prisma.chatMessage.create({
    data: { sessionId, role: "user", content: message },
  });

  const history = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: 13,
    select: { role: true, content: true },
  }).then((rows) => rows.reverse());
  // Drop the message we just stored — runAgent appends it itself.
  history.pop();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: AgentEvent) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        const result = await runAgent({
          history,
          userMessage: message,
          emit: (e) => send(e),
          signal: request.signal,
        });
        const saved = await prisma.chatMessage.create({
          data: {
            sessionId,
            role: "assistant",
            content: result.content || "(no reply)",
            toolLog: JSON.stringify(result.toolLog),
            model: result.model,
          },
        });
        await prisma.chatSession.update({
          where: { id: sessionId },
          data: { updatedAt: new Date() },
        });
        send({
          type: "done",
          content: result.content,
          toolLog: result.toolLog,
          model: result.model,
          messageId: saved.id,
          sessionId,
          title: isNew ? session.title : undefined,
        });
      } catch (e) {
        send({
          type: "error",
          message: e instanceof Error ? e.message : "Agent run failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
