import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { toAgentRunDTO } from "@/lib/agent-runs";
import { isConnected, REPO } from "@/lib/github";
import { SelfModifyPanel } from "@/components/self-modify/SelfModifyPanel";

export const metadata: Metadata = { title: "Self-Modify" };
export const dynamic = "force-dynamic";

export default async function SelfModifyPage() {
  const runs = await prisma.agentRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl text-ink">Self-Modify</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted">
          Ask for a change to this app in plain language. A real Claude Code
          run works on its own branch and opens a pull request — you review the
          diff here and decide whether it ships.
        </p>
      </header>

      <SelfModifyPanel
        initialRuns={runs.map(toAgentRunDTO)}
        connected={isConnected()}
        repo={REPO}
      />
    </div>
  );
}
