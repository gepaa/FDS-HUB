import { getProvider } from "@/lib/agent/provider";
import { AGENT_TOOL_DEFS, executeToolCall } from "@/lib/agent/tools";
import { buildSystemPrompt } from "@/lib/agent/context";
import type { AgentEvent, AgentTurn, ToolLogEntry } from "@/lib/agent/types";

const MAX_TOOL_ROUNDS = 8;
// Free-tier TPM budgets are the binding constraint: cap how much old
// conversation is replayed into every model turn.
const MAX_HISTORY_TURNS = 12;
const MAX_TURN_CHARS = 1500;

export interface AgentRunResult {
  content: string;
  toolLog: ToolLogEntry[];
  model: string;
}

/**
 * The agent loop: model turn → execute requested tools → feed results
 * back → repeat until the model answers in plain text (or the round
 * cap trips). Emits streaming events for the UI along the way.
 */
export async function runAgent(opts: {
  history: { role: string; content: string }[]; // prior user/assistant turns
  userMessage: string;
  emit: (e: AgentEvent) => void;
  signal?: AbortSignal;
}): Promise<AgentRunResult> {
  const provider = getProvider();
  if (!provider) {
    throw new Error(
      "No AI provider configured. Set AI_PROVIDER + AI_API_KEY (free: Groq or Google AI Studio) — see Settings → Integrations.",
    );
  }

  const system = await buildSystemPrompt();
  const clip = (s: string) =>
    s.length > MAX_TURN_CHARS ? s.slice(0, MAX_TURN_CHARS) + " …" : s;
  const turns: AgentTurn[] = [
    ...opts.history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-MAX_HISTORY_TURNS)
      .map((m) =>
        m.role === "user"
          ? ({ kind: "user", content: clip(m.content) } as const)
          : ({ kind: "assistant", content: clip(m.content) } as const),
      ),
    { kind: "user", content: opts.userMessage },
  ];

  const toolLog: ToolLogEntry[] = [];
  let finalText = "";

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const { text, toolCalls } = await provider.streamTurn({
      system,
      turns,
      tools: AGENT_TOOL_DEFS,
      onTextDelta: (delta) => opts.emit({ type: "text", delta }),
      signal: opts.signal,
    });
    if (text) finalText = finalText ? `${finalText}\n\n${text}` : text;

    if (toolCalls.length === 0) break;
    if (round === MAX_TOOL_ROUNDS) {
      const note = "\n\n_(Stopped: tool-round limit reached — ask me to continue.)_";
      finalText += note;
      opts.emit({ type: "text", delta: note });
      break;
    }

    turns.push({ kind: "assistant_tool_calls", content: text, calls: toolCalls });
    const results = [];
    for (const call of toolCalls) {
      opts.emit({ type: "tool_start", id: call.id, name: call.name, input: call.input });
      const { result, log } = await executeToolCall(call);
      toolLog.push(log);
      opts.emit({
        type: "tool_done",
        id: call.id,
        name: call.name,
        summary: log.summary,
        isError: log.isError ?? false,
      });
      results.push(result);
    }
    turns.push({ kind: "tool_results", results });
  }

  return { content: finalText.trim(), toolLog, model: provider.label };
}
