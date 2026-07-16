"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/kit/Button";
import { Input } from "@/components/kit/Field";
import { useToast } from "@/components/kit/Toast";
import { cn } from "@/lib/utils";

export interface MessageDTO {
  id: string;
  role: string;
  kind: string;
  title: string | null;
  body: string;
  createdAt: string;
}

const KIND_LABELS: Record<string, string> = {
  brief: "Morning brief",
  ping: "Ping",
  log: "Run log",
  chat: "",
};

/** The thin chat surface: the agent's briefs/pings/logs + your replies.
 *  The PM reads new replies at the start of its next run. */
export function ChatFeed({ initial }: { initial: MessageDTO[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [initial.length]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "failed");
      setText("");
      router.refresh();
    } catch (e) {
      toast({
        title: "Couldn't send",
        description: e instanceof Error ? e.message : undefined,
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="surface flex h-[min(70vh,640px)] flex-col rounded-panel p-4">
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {initial.length === 0 ? (
          <p className="m-auto max-w-sm text-center text-sm text-muted">
            No messages yet. The PM posts its morning brief, pings, and run
            logs here after each cycle — and reads anything you write before
            planning its next one.
          </p>
        ) : null}
        {initial.map((m) => {
          const mine = m.role === "you";
          return (
            <div
              key={m.id}
              className={cn(
                "max-w-[82%] rounded-2xl px-4 py-2.5 text-sm",
                mine
                  ? "self-end rounded-br-md bg-[var(--accent)] text-white"
                  : "surface-muted self-start rounded-bl-md text-ink",
              )}
            >
              <p
                className={cn(
                  "mb-1 text-[10px] font-bold tracking-wide uppercase",
                  mine ? "text-white/70" : "text-accent-bright",
                )}
              >
                {mine ? "You" : "Claude · PM"}
                {!mine && KIND_LABELS[m.kind]
                  ? ` · ${KIND_LABELS[m.kind]}`
                  : ""}
              </p>
              {m.title ? (
                <p className="mb-1 font-semibold">{m.title}</p>
              ) : null}
              <p className="whitespace-pre-wrap">{m.body}</p>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-hairline pt-3">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void send();
          }}
          placeholder="Leave a note for the PM's next run…"
          aria-label="Message the PM"
        />
        <Button variant="primary" size="sm" disabled={busy} onClick={send}>
          <Send size={14} aria-hidden />
          Send
        </Button>
      </div>
    </div>
  );
}
