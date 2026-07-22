import { getProvider } from "@/lib/agent/provider";

/**
 * One-shot, tool-free model call for lightweight assist features
 * (cockpit question suggestions, call summaries). Returns null when
 * no provider is configured — callers fall back to playbook content.
 */
export async function completeText(
  system: string,
  user: string,
): Promise<string | null> {
  const provider = getProvider();
  if (!provider) return null;
  const { text } = await provider.streamTurn({
    system,
    turns: [{ kind: "user", content: user }],
    tools: [],
    onTextDelta: () => {},
  });
  return text.trim() || null;
}

/** Pull the first JSON object/array out of a model reply. */
export function extractJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  const match = raw.match(/[[{][\s\S]*[\]}]/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}
