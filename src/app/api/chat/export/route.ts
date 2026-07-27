import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/chat/export — every stored conversation, for debugging.
 *
 * The data was always there (ChatSession + ChatMessage); this just makes
 * it reachable without opening a SQL client. Includes the tool log and
 * the model behind each assistant turn, which is the part you actually
 * need when working out why a reply went wrong.
 *
 * ?session=<id> limits it to one conversation.
 */
export async function GET(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session");

  const sessions = await prisma.chatSession.findMany({
    where: sessionId ? { id: sessionId } : undefined,
    orderBy: { updatedAt: "desc" },
    take: sessionId ? 1 : 100,
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  return Response.json({
    exportedAt: new Date().toISOString(),
    sessionCount: sessions.length,
    messageCount: sessions.reduce((n, s) => n + s.messages.length, 0),
    sessions: sessions.map((s) => ({
      id: s.id,
      title: s.title,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      messages: s.messages.map((m) => ({
        role: m.role,
        content: m.content,
        // Which model produced the turn, and every tool it called —
        // the two things that explain a bad answer.
        model: m.model,
        tools: safeJson(m.toolLog),
        at: m.createdAt.toISOString(),
      })),
    })),
  });
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
