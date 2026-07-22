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
    // Scout has the highest free-tier TPM on Groq (30k vs 12k for
    // llama-3.3-70b) — the binding constraint for a tool-loop agent.
    defaultModel: "meta-llama/llama-4-scout-17b-16e-instruct",
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    // Rolling alias — Google hot-swaps it to the newest Flash release
    // (currently gemini-3.5-flash), so model retirements can't 404 us.
    defaultModel: "gemini-flash-latest",
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
        extra_content?: unknown;
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
            // Gemini 3 requires its thought_signature echoed back on
            // every replayed function call; other providers ignore it.
            ...(c.meta ? { extra_content: c.meta } : {}),
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Parse Groq/OpenAI-style "try again in 12.34s" out of a 429 body. */
function retryAfterSeconds(detail: string): number | null {
  const m = detail.match(/try again in ([\d.]+)\s*s/i);
  return m ? Math.ceil(parseFloat(m[1])) : null;
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
      const body = JSON.stringify({
        model,
        stream: true,
        messages: toOaiMessages(system, turns),
        tools: tools.length
          ? tools.map((t) => ({
              type: "function",
              function: {
                name: t.name,
                description: t.description,
                parameters: t.inputSchema,
              },
            }))
          : undefined,
      });

      // Failures happen before any token streams, so retrying here is
      // invisible to the user: free-tier 429s wait out the window the
      // provider names; flaky tool-call generation gets one more shot.
      let res: Response | null = null;
      let waited = 0;
      for (let attempt = 0; ; attempt++) {
        res = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body,
        });
        if (res.ok && res.body) break;

        const detail = await res.text().catch(() => "");
        if (res.status === 429 && attempt < 3) {
          const wait = retryAfterSeconds(detail) ?? 8;
          if (waited + wait <= 35) {
            waited += wait;
            await sleep((wait + 0.5) * 1000);
            continue;
          }
          throw new Error(
            `The free ${providerId} tier hit its per-minute token limit and needs ~${wait}s to cool down. Wait a moment and re-send — or upgrade the key / switch AI_PROVIDER for more headroom.`,
          );
        }
        if (res.status === 429) {
          throw new Error(
            `The free ${providerId} tier is rate-limited right now. Give it a minute and try again.`,
          );
        }
        if (res.status === 404 && /NOT_FOUND|no longer available|not found/i.test(detail)) {
          throw new Error(
            `${providerId} says the model "${model}" doesn't exist (retired or renamed). Set AI_MODEL to a current model — or unset it to use the built-in default — then redeploy.`,
          );
        }
        if (
          res.status === 400 &&
          /failed_generation|tool_use_failed|tool call/i.test(detail) &&
          attempt < 1
        ) {
          continue; // model fumbled the tool call — one clean retry
        }
        if (res.status === 400 && /failed_generation|tool_use_failed/i.test(detail)) {
          throw new Error(
            "The model failed to produce a valid tool call twice in a row. Re-send the message (smaller asks help) — or set AI_MODEL to a stronger tool-calling model.",
          );
        }
        throw new Error(
          `${providerId} request failed (${res.status}): ${detail.slice(0, 300)}`,
        );
      }

      let text = "";
      // Accumulate streamed tool calls. Keyed by the chunk `index`
      // when the provider sends one; Gemini sometimes omits it, so a
      // chunk carrying a fresh `id` also starts a new call — otherwise
      // parallel calls would concatenate into one garbled call.
      const pending: { id: string; name: string; args: string; meta?: unknown }[] = [];
      const byIndex = new Map<number, number>();

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
                  extra_content?: unknown;
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
            let pos: number;
            if (tc.index !== undefined) {
              if (!byIndex.has(tc.index)) {
                byIndex.set(tc.index, pending.length);
                pending.push({ id: "", name: "", args: "" });
              }
              pos = byIndex.get(tc.index)!;
            } else if (tc.id || pending.length === 0) {
              // No index: a fresh id (or first chunk) opens a new call.
              pending.push({ id: "", name: "", args: "" });
              pos = pending.length - 1;
            } else {
              pos = pending.length - 1;
            }
            const cur = pending[pos];
            if (tc.id) cur.id = tc.id;
            if (tc.function?.name) cur.name += tc.function.name;
            if (tc.function?.arguments) cur.args += tc.function.arguments;
            if (tc.extra_content !== undefined) cur.meta = tc.extra_content;
          }
        }
      }

      const toolCalls: AgentToolCall[] = pending
        .map((c, idx) => {
          let input: Record<string, unknown> = {};
          try {
            input = c.args ? JSON.parse(c.args) : {};
          } catch {
            input = { __malformed_arguments: c.args };
          }
          return {
            id: c.id || `call_${idx}`,
            // Gemini namespaces tool names as "default_api:foo".
            name: c.name.replace(/^default_api[.:]/, ""),
            input,
            meta: c.meta,
          };
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
