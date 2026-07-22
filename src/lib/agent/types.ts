/**
 * Shared types for the in-app AI agent (the HQ brain).
 *
 * The agent speaks a small neutral dialect so the same loop and tools
 * work against every backend: free OpenAI-compatible providers
 * (Groq / Gemini / OpenRouter / custom) and Anthropic's Claude.
 */

/** A tool the model may call. Neutral JSON-Schema shape. */
export interface AgentToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>; // JSON Schema object
}

/** One tool invocation requested by the model. */
export interface AgentToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  /** Provider passthrough echoed on replay — e.g. Gemini's
   *  extra_content.google.thought_signature. Never interpreted. */
  meta?: unknown;
}

/** Result of executing one tool call, fed back to the model. */
export interface AgentToolResult {
  id: string;
  name: string;
  content: string;
  isError?: boolean;
}

/**
 * Neutral conversation entries. Plain user/assistant text plus the
 * intra-run tool exchange entries the loop appends while working.
 */
export type AgentTurn =
  | { kind: "user"; content: string }
  | { kind: "assistant"; content: string }
  | { kind: "assistant_tool_calls"; content: string; calls: AgentToolCall[] }
  | { kind: "tool_results"; results: AgentToolResult[] };

/** Events streamed to the UI while the agent works. */
export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool_start"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_done"; id: string; name: string; summary: string; isError: boolean }
  | { type: "done"; content: string; toolLog: ToolLogEntry[]; model: string; messageId?: string; sessionId?: string; title?: string }
  | { type: "error"; message: string };

/** Compact per-message record of tool activity, stored for the UI. */
export interface ToolLogEntry {
  tool: string;
  summary: string;
  isError?: boolean;
}

/** What one model turn produced. */
export interface ModelTurnResult {
  text: string;
  toolCalls: AgentToolCall[];
}

/** A provider adapter: run one streaming model turn. */
export interface ModelProvider {
  /** Human-readable id like "groq/llama-3.3-70b-versatile". */
  label: string;
  streamTurn(opts: {
    system: string;
    turns: AgentTurn[];
    tools: AgentToolDef[];
    onTextDelta: (delta: string) => void;
    signal?: AbortSignal;
  }): Promise<ModelTurnResult>;
}
