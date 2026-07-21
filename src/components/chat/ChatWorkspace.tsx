"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  Loader2,
  MessageSquarePlus,
  Send,
  Sparkles,
  Trash2,
  Wrench,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/kit/Button";
import { useToast } from "@/components/kit/Toast";
import { cn, shortDate } from "@/lib/utils";

export interface ChatSessionDTO {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

interface ToolLogEntry {
  tool: string;
  summary: string;
  isError?: boolean;
}

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolLog: ToolLogEntry[];
  model?: string | null;
  pending?: boolean;
}

interface LiveTool {
  id: string;
  name: string;
  summary?: string;
  isError?: boolean;
  done: boolean;
}

const TOOL_LABELS: Record<string, string> = {
  search_records: "Searching the CRM",
  get_record: "Reading a record",
  create_record: "Creating a record",
  update_record: "Updating a record",
  log_interaction: "Logging activity",
  list_tasks: "Checking the task queue",
  create_task: "Adding a task",
  update_task: "Updating a task",
  list_approvals: "Checking approvals",
  draft_approval: "Drafting for approval",
  pipeline_stats: "Reading pipeline stats",
  list_sops: "Scanning the SOP library",
  read_sop: "Reading an SOP",
  post_agent_message: "Posting to the feed",
};

const SUGGESTIONS = [
  "What needs my attention today?",
  "Who are our hottest supplier prospects right now?",
  "Summarize the pipeline and what moved this week",
  "Pick 3 qualified suppliers and draft first-contact emails for my approval",
];

/** Escape raw HTML so model output can't inject markup, then render markdown. */
function mdToHtml(src: string): string {
  const escaped = src.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return marked.parse(escaped, { gfm: true, breaks: true, async: false }) as string;
}

function Markdown({ text }: { text: string }) {
  const html = useMemo(() => mdToHtml(text), [text]);
  return (
    <div
      className="prose-doc max-w-none text-[14px] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function ToolChip({ name, summary, isError, done }: Omit<LiveTool, "id">) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        isError
          ? "border-[var(--red-soft)] bg-[var(--red-soft)] text-danger"
          : "border-hairline bg-[var(--panel-soft)] text-muted",
      )}
      title={summary}
    >
      {!done ? (
        <Loader2 size={11} className="shrink-0 animate-spin text-accent-bright" aria-hidden />
      ) : isError ? (
        <XCircle size={11} className="shrink-0" aria-hidden />
      ) : (
        <CheckCircle2 size={11} className="shrink-0 text-green" aria-hidden />
      )}
      <span className="truncate">
        {TOOL_LABELS[name] ?? name}
        {done && summary ? ` — ${summary}` : ""}
      </span>
    </span>
  );
}

function AssistantAvatar() {
  return (
    <div className="grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--red)] text-white shadow-sm">
      <Sparkles size={13} aria-hidden />
    </div>
  );
}

export function ChatWorkspace({
  initialSessions,
  aiConfigured,
  modelLabel,
}: {
  initialSessions: ChatSessionDTO[];
  aiConfigured: boolean;
  modelLabel: string | null;
}) {
  const { toast } = useToast();
  const [sessions, setSessions] = useState(initialSessions);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [liveTools, setLiveTools] = useState<LiveTool[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length, streamText, liveTools.length]);

  const openSession = useCallback(async (id: string | null) => {
    setActiveId(id);
    setShowSessions(false);
    setStreamText("");
    setLiveTools([]);
    if (!id) {
      setMessages([]);
      return;
    }
    try {
      const res = await fetch(`/api/chat?session=${id}`);
      const rows: {
        id: string;
        role: string;
        content: string;
        toolLog: string;
        model: string | null;
      }[] = await res.json();
      setMessages(
        rows.map((r) => ({
          id: r.id,
          role: r.role === "user" ? "user" : "assistant",
          content: r.content,
          model: r.model,
          toolLog: (() => {
            try {
              return JSON.parse(r.toolLog) as ToolLogEntry[];
            } catch {
              return [];
            }
          })(),
        })),
      );
    } catch {
      toast({ title: "Couldn't load conversation", tone: "error" });
    }
  }, [toast]);

  const removeSession = useCallback(
    async (id: string) => {
      await fetch(`/api/chat?session=${id}`, { method: "DELETE" });
      setSessions((s) => s.filter((x) => x.id !== id));
      if (activeId === id) void openSession(null);
    },
    [activeId, openSession],
  );

  const send = useCallback(
    async (text?: string) => {
      const body = (text ?? input).trim();
      if (!body || busy) return;
      setInput("");
      setBusy(true);
      setStreamText("");
      setLiveTools([]);
      setMessages((m) => [
        ...m,
        { id: `local-${Date.now()}`, role: "user", content: body, toolLog: [] },
      ]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: activeId ?? undefined, message: body }),
        });
        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error ?? `Request failed (${res.status})`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finished = false;

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() ?? "";
          for (const chunk of chunks) {
            const line = chunk.trim();
            if (!line.startsWith("data:")) continue;
            let e: {
              type: string;
              delta?: string;
              id?: string;
              name?: string;
              summary?: string;
              isError?: boolean;
              content?: string;
              toolLog?: ToolLogEntry[];
              model?: string;
              messageId?: string;
              sessionId?: string;
              title?: string;
              message?: string;
            };
            try {
              e = JSON.parse(line.slice(5).trim());
            } catch {
              continue;
            }
            if (e.type === "text" && e.delta) {
              setStreamText((t) => t + e.delta);
            } else if (e.type === "tool_start" && e.id && e.name) {
              setStreamText("");
              setLiveTools((ts) => [
                ...ts,
                { id: e.id!, name: e.name!, done: false },
              ]);
            } else if (e.type === "tool_done" && e.id) {
              setLiveTools((ts) =>
                ts.map((t) =>
                  t.id === e.id
                    ? { ...t, done: true, summary: e.summary, isError: e.isError }
                    : t,
                ),
              );
            } else if (e.type === "done") {
              finished = true;
              setMessages((m) => [
                ...m,
                {
                  id: e.messageId ?? `a-${Date.now()}`,
                  role: "assistant",
                  content: e.content ?? "",
                  toolLog: e.toolLog ?? [],
                  model: e.model,
                },
              ]);
              setStreamText("");
              setLiveTools([]);
              if (e.sessionId) {
                setActiveId(e.sessionId);
                setSessions((s) => {
                  const rest = s.filter((x) => x.id !== e.sessionId);
                  const existing = s.find((x) => x.id === e.sessionId);
                  return [
                    {
                      id: e.sessionId!,
                      title: e.title ?? existing?.title ?? body.slice(0, 60),
                      updatedAt: new Date().toISOString(),
                      messageCount: (existing?.messageCount ?? 0) + 2,
                    },
                    ...rest,
                  ];
                });
              }
            } else if (e.type === "error") {
              throw new Error(e.message ?? "Agent error");
            }
          }
        }
        if (!finished) throw new Error("Stream ended early — try again.");
      } catch (err) {
        setStreamText("");
        setLiveTools([]);
        toast({
          title: "Agent error",
          description: err instanceof Error ? err.message : undefined,
          tone: "error",
        });
      } finally {
        setBusy(false);
        textareaRef.current?.focus();
      }
    },
    [activeId, busy, input, toast],
  );

  if (!aiConfigured) {
    return (
      <div className="surface mx-auto max-w-xl rounded-panel p-8 text-center">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--red)] text-white">
          <Bot size={22} aria-hidden />
        </div>
        <h2 className="font-display text-xl text-ink">Connect a brain</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          The assistant needs a model API key. The free lane takes ~2 minutes:
        </p>
        <ol className="mx-auto mt-4 max-w-md list-decimal space-y-2 pl-6 text-left text-sm text-ink">
          <li>
            Create a free key at{" "}
            <a className="text-accent-bright underline" href="https://console.groq.com/keys" target="_blank" rel="noreferrer">
              console.groq.com/keys
            </a>{" "}
            (recommended) or{" "}
            <a className="text-accent-bright underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
              aistudio.google.com/apikey
            </a>
          </li>
          <li>
            Set <code className="rounded bg-[var(--panel-soft)] px-1">AI_PROVIDER=groq</code> (or{" "}
            <code className="rounded bg-[var(--panel-soft)] px-1">gemini</code>) and{" "}
            <code className="rounded bg-[var(--panel-soft)] px-1">AI_API_KEY=…</code> in your
            environment — locally in <code className="rounded bg-[var(--panel-soft)] px-1">.env</code>,
            in production under Vercel → Settings → Environment Variables
          </li>
          <li>Restart / redeploy, and this page becomes your assistant.</li>
        </ol>
      </div>
    );
  }

  const empty = messages.length === 0 && !busy;

  return (
    <div className="flex h-[calc(100dvh-10.5rem)] min-h-[480px] gap-4 md:h-[calc(100dvh-9rem)]">
      {/* ---- Sessions rail ---- */}
      <aside
        className={cn(
          "surface w-60 shrink-0 flex-col overflow-hidden rounded-panel",
          "hidden lg:flex",
        )}
      >
        <div className="border-b border-hairline p-2.5">
          <Button
            variant="primary"
            size="sm"
            className="w-full"
            onClick={() => void openSession(null)}
          >
            <MessageSquarePlus size={14} aria-hidden />
            New chat
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5">
          {sessions.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted">
              No conversations yet.
            </p>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "group flex cursor-pointer items-center gap-1 rounded-card px-2.5 py-2 text-[13px]",
                  s.id === activeId
                    ? "bg-[var(--rail-active)] text-ink"
                    : "text-muted hover:bg-[var(--panel-soft)] hover:text-ink",
                )}
                onClick={() => void openSession(s.id)}
              >
                <span className="flex-1 truncate">{s.title}</span>
                <span className="num shrink-0 text-[10px] opacity-60">
                  {shortDate(s.updatedAt)}
                </span>
                <button
                  aria-label="Delete conversation"
                  className="hidden shrink-0 rounded p-0.5 text-muted hover:text-danger group-hover:block"
                  onClick={(e) => {
                    e.stopPropagation();
                    void removeSession(s.id);
                  }}
                >
                  <Trash2 size={12} aria-hidden />
                </button>
              </div>
            ))
          )}
        </div>
        {modelLabel ? (
          <div className="border-t border-hairline px-3 py-2 text-[10px] text-muted">
            <span className="mr-1 inline-block size-1.5 rounded-full bg-green align-middle" />
            {modelLabel}
          </div>
        ) : null}
      </aside>

      {/* ---- Conversation ---- */}
      <section className="surface relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-panel">
        {/* Mobile session picker */}
        <div className="flex items-center gap-2 border-b border-hairline px-3 py-2 lg:hidden">
          <Button variant="ghost" size="sm" onClick={() => setShowSessions((v) => !v)}>
            <ChevronDown size={13} aria-hidden />
            {sessions.find((s) => s.id === activeId)?.title ?? "New chat"}
          </Button>
          <span className="flex-1" />
          <Button variant="subtle" size="sm" onClick={() => void openSession(null)}>
            <MessageSquarePlus size={14} aria-hidden />
          </Button>
        </div>
        {showSessions ? (
          <div className="border-b border-hairline p-2 lg:hidden">
            {sessions.map((s) => (
              <button
                key={s.id}
                className="block w-full truncate rounded-card px-2.5 py-2 text-left text-[13px] text-muted hover:bg-[var(--panel-soft)]"
                onClick={() => void openSession(s.id)}
              >
                {s.title}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto px-4 py-5 md:px-8">
          {empty ? (
            <div className="mx-auto flex h-full max-w-lg flex-col items-center justify-center text-center">
              <div className="mb-4 grid size-14 place-items-center rounded-3xl bg-gradient-to-br from-[var(--accent)] to-[var(--red)] text-white shadow-lg">
                <Sparkles size={24} aria-hidden />
              </div>
              <h2 className="font-display text-2xl text-ink">
                What are we working on?
              </h2>
              <p className="mt-2 text-sm text-muted">
                I know the whole business — the CRM, the pipeline, the SOPs —
                and I execute directly: records, tasks, drafts for your
                approval.
              </p>
              <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    className="press surface-muted rounded-card px-3 py-2.5 text-left text-[13px] text-ink hover:border-[var(--hairline-strong)]"
                    onClick={() => void send(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-5">
              {messages.map((m) =>
                m.role === "user" ? (
                  <div
                    key={m.id}
                    className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-[var(--accent)] px-4 py-2.5 text-sm whitespace-pre-wrap text-[var(--accent-fg)] shadow-sm"
                  >
                    {m.content}
                  </div>
                ) : (
                  <div key={m.id} className="flex gap-3 self-start">
                    <AssistantAvatar />
                    <div className="min-w-0 flex-1">
                      {m.toolLog.length > 0 ? (
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {m.toolLog.map((t, i) => (
                            <ToolChip
                              key={i}
                              name={t.tool}
                              summary={t.summary}
                              isError={t.isError}
                              done
                            />
                          ))}
                        </div>
                      ) : null}
                      <Markdown text={m.content} />
                    </div>
                  </div>
                ),
              )}

              {busy ? (
                <div className="flex gap-3 self-start">
                  <AssistantAvatar />
                  <div className="min-w-0 flex-1">
                    {liveTools.length > 0 ? (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {liveTools.map((t) => (
                          <ToolChip key={t.id} {...t} />
                        ))}
                      </div>
                    ) : null}
                    {streamText ? (
                      <Markdown text={streamText} />
                    ) : liveTools.length === 0 ? (
                      <div className="flex items-center gap-2 text-sm text-muted">
                        <Loader2 size={14} className="animate-spin" aria-hidden />
                        Thinking…
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {/* ---- Composer ---- */}
        <div className="border-t border-hairline p-3 md:px-6 md:py-4">
          <div className="surface-muted mx-auto flex max-w-3xl items-end gap-2 rounded-2xl p-2 focus-within:border-[var(--hairline-strong)]">
            <textarea
              ref={textareaRef}
              value={input}
              rows={1}
              placeholder="Ask anything, or tell me what to do…"
              aria-label="Message the assistant"
              className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-ink outline-none placeholder:text-muted"
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <Button
              variant="primary"
              size="sm"
              disabled={busy || !input.trim()}
              aria-label="Send"
              onClick={() => void send()}
            >
              {busy ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <Send size={14} aria-hidden />
              )}
            </Button>
          </div>
          <p className="mx-auto mt-1.5 flex max-w-3xl items-center gap-1 px-2 text-[10px] text-muted">
            <Wrench size={10} aria-hidden />
            Works the live CRM directly — outbound anything still lands in
            Approvals for your one-tap sign-off.
          </p>
        </div>
      </section>
    </div>
  );
}
