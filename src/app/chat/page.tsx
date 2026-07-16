import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ChatFeed, type MessageDTO } from "@/components/chat/ChatFeed";

export const metadata: Metadata = { title: "Chat" };
export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const messages = await prisma.agentMessage.findMany({
    orderBy: { createdAt: "asc" },
    take: 500,
  });

  const dtos: MessageDTO[] = messages.map((m) => ({
    id: m.id,
    role: m.role,
    kind: m.kind,
    title: m.title,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl text-ink">
          Chat
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Updates and asks from the PM agent. Notes you leave here are read at
          the start of its next run. For a live working session, open Claude
          directly — this feed is the async channel.
        </p>
      </header>
      <ChatFeed initial={dtos} />
    </div>
  );
}
