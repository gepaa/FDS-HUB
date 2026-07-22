import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import type {
  AgentToolCall,
  AgentTurn,
  ModelProvider,
  ModelTurnResult,
} from "@/lib/agent/types";

/**
 * Model providers for the HQ brain.
 *
 * Two wire dialects cover everything:
 *  - OpenAI-compatible chat completions (Groq, Google AI Studio,
 *    OpenRouter, any custom endpoint) — the free lane.
 *  - Anthropic Messages API via the official SDK — the paid lane,
 *    active when AI_PROVIDER=anthropic or only ANTHROPIC_API_KEY set.
 */

const OPENAI_COMPAT_PRESETS: Record<
  string,
  { baseUrl: string; defaultModel: string }
> = {
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.5-flash",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
  },
};

export interface ResolvedProviderConfig {
  provider: "groq" | "gemini" | "openrouter" | "anthropic" | "custom";
  model: string;
}

/** Which backend is configured, or null → the chat shows setup help. */
export function resolveProviderConfig(): ResolvedProviderConfig | null {
  const p =
    env.AI_PROVIDER ??
    (env.ANTHROPIC_API_KEY ? "anthropic" : env.AI_API_KEY ? "groq" : null);
  if (!p) return null;
  if (p === "anthropic") {
    if (!(env.AI_API_KEY || env.ANTHROPIC_API_KEY)) return null;
    return { provider: p, model: env.AI_MODEL ?? "claude-opus-4-8" };
  }
  if (!env.AI_API_KEY) return null;
  if (p === "custom") {
    if (!env.AI_BASE_URL || !env.AI_MODEL) return null;
    return { provider: p, model: env.AI_MODEL };
  }
  return { provider: p, model: env.AI_MODEL ?? OPENAI_COMPAT_PRESETS[p].defaultModel };
}

export function getProvider(): ModelProvider | null {
  const cfg = resolveProviderConfig();
  if (!cfg) return null;
  if (cfg.provider === "anthropic") return anthropicProvider(cfg.model);
  const baseUrl =
    cfg.provider === "custom"
      ? env.AI_BASE_URL!.replace(/\/$/, "")
      : OPENAI_COMPAT_PRESETS[cfg.provider].baseUrl;
  return openAiCompatProvider(cfg.provider, baseUrl, cfg.model, env.AI_API_KEY!);
}

// ---------------- OpenAI-compatible (the free lane) ----------------

type OaiMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: {
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }[];
    }
  | { role: "tool"; tool_call_id: string; content: string };

function toOaiMessages(system: string, turns: AgentTurn[]): OaiMessage[] {
  const out: OaiMessage[] = [{ role: "system", content: system }];
  for (const t of turns) {
    switch (t.kind) {
      case "user":
        out.push({ role: "user", content: t.content });
        break;
      case "assistant":
        out.push({ role: "assistant", content: t.content });
        break;
      case "assistant_tool_calls":
        out.push({
          role: "assistant",
          content: t.content || null,
          tool_calls: t.calls.map((c) => ({
            id: c.id,
            type: "function",
            function: { name: c.name, arguments: JSON.stringify(c.input) },
          })),
        });
        break;
      case "tool_results":
        for (const r of t.results) {
          out.push({ role: "tool", tool_call_id: r.id, content: r.content });
        }
        break;
    }
  }
  return out;
}

function openAiCompatProvider(
  providerId: string,
  baseUrl: string,
  model: string,
  apiKey: string,
): ModelProvider {
  return {
    label: `${providerId}/${model}`,
    async streamTurn({ system, turns, tools, onTextDelta, signal }) {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          stream: true,
          messages: toOaiMessages(system, turns),
          tools: tools.map((t) => ({
            type: "function",
            function: {
              name: t.name,
              description: t.description,
              parameters: t.inputSchema,
            },
          })),
        }),
      });
      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => "");
        throw new Error(
          `${providerId} request failed (${res.status}): ${detail.slice(0, 400)}`,
        );
      }

      let text = "";
      // Accumulate streamed tool calls by index.
      const pending = new Map<number, { id: string; name: string; args: string }>();

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const data = line.trim();
          if (!data.startsWith("data:")) continue;
          const payload = data.slice(5).trim();
          if (payload === "[DONE]") continue;
          let json: {
            choices?: {
              delta?: {
                content?: string | null;
                tool_calls?: {
                  index?: number;
                  id?: string;
                  function?: { name?: string; arguments?: string };
                }[];
              };
            }[];
            error?: { message?: string };
          };
          try {
            json = JSON.parse(payload);
          } catch {
            continue;
          }
          if (json.error?.message) throw new Error(json.error.message);
          const delta = json.choices?.[0]?.delta;
          if (!delta) continue;
          if (delta.content) {
            text += delta.content;
            onTextDelta(delta.content);
          }
          for (const tc of delta.tool_calls ?? []) {
            const idx = tc.index ?? 0;
            const cur =
              pending.get(idx) ?? { id: "", name: "", args: "" };
            if (tc.id) cur.id = tc.id;
            if (tc.function?.name) cur.name += tc.function.name;
            if (tc.function?.arguments) cur.args += tc.function.arguments;
            pending.set(idx, cur);
          }
        }
      }

      const toolCalls: AgentToolCall[] = [...pending.entries()]
        .sort(([a], [b]) => a - b)
        .map(([idx, c]) => {
          let input: Record<string, unknown> = {};
          try {
            input = c.args ? JSON.parse(c.args) : {};
          } catch {
            input = { __malformed_arguments: c.args };
          }
          return { id: c.id || `call_${idx}`, name: c.name, input };
        })
        .filter((c) => c.name);
      return { text, toolCalls } satisfies ModelTurnResult;
    },
  };
}

// ---------------- Anthropic (the paid lane) ----------------

function toAnthropicMessages(turns: AgentTurn[]): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];
  for (const t of turns) {
    switch (t.kind) {
      case "user":
        out.push({ role: "user", content: t.content });
        break;
      case "assistant":
        out.push({ role: "assistant", content: t.content });
        break;
      case "assistant_tool_calls": {
        const blocks: Anthropic.ContentBlockParam[] = [];
        if (t.content) blocks.push({ type: "text", text: t.content });
        for (const c of t.calls) {
          blocks.push({ type: "tool_use", id: c.id, name: c.name, input: c.input });
        }
        out.push({ role: "assistant", content: blocks });
        break;
      }
      case "tool_results":
        out.push({
          role: "user",
          content: t.results.map((r) => ({
            type: "tool_result" as const,
            tool_use_id: r.id,
            content: r.content,
            is_error: r.isError ?? false,
          })),
        });
        break;
    }
  }
  return out;
}

function anthropicProvider(model: string): ModelProvider {
  const client = new Anthropic({
    apiKey: env.AI_API_KEY ?? env.ANTHROPIC_API_KEY,
  });
  return {
    label: `anthropic/${model}`,
    async streamTurn({ system, turns, tools, onTextDelta, signal }) {
      const stream = client.messages.stream(
        {
          model,
          max_tokens: 16000,
          thinking: { type: "adaptive" },
          system,
          messages: toAnthropicMessages(turns),
          tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
          })),
        },
        { signal },
      );
      stream.on("text", (delta) => onTextDelta(delta));
      const message = await stream.finalMessage();
      const text = message.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      const toolCalls: AgentToolCall[] = message.content
        .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
        .map((b) => ({
          id: b.id,
          name: b.name,
          input: b.input as Record<string, unknown>,
        }));
      return { text, toolCalls };
    },
  };
}
