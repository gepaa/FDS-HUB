import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { resolveProviderConfig } from "@/lib/agent/provider";
import {
  ChatWorkspace,
  type ChatSessionDTO,
} from "@/components/chat/ChatWorkspace";

export const metadata: Metadata = { title: "Assistant" };
export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const cfg = resolveProviderConfig();
  const sessions = await prisma.chatSession.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: { _count: { select: { messages: true } } },
  });

  const dtos: ChatSessionDTO[] = sessions.map((s) => ({
    id: s.id,
    title: s.title,
    updatedAt: s.updatedAt.toISOString(),
    messageCount: s._count.messages,
  }));

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink">Assistant</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Your AI employee. It holds the full business context and executes
            inside the hub — CRM updates, tasks, research, drafts for approval.
          </p>
        </div>
      </header>
      <ChatWorkspace
        initialSessions={dtos}
        aiConfigured={cfg !== null}
        modelLabel={cfg ? `${cfg.provider} · ${cfg.model}` : null}
      />
    </div>
  );
}
