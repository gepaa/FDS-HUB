"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export interface HealthEntry {
  id: string;
  name: string;
  connected: boolean;
  description: string;
  requiredEnv: string[];
  setupUrl?: string;
  /**
   * True when `connected` came from actually exercising the service
   * this request, false when it only reflects credential presence.
   * The distinction is shown to the operator verbatim — a green pill
   * that only means "a key is set" would be a lie.
   */
  verified: boolean;
}

/**
 * Tier 3: every integration collapsed to one pill. Click a pill to
 * expand what it needs and how to connect it — no paragraphs on the
 * dashboard itself.
 */
export function HealthStrip({ entries }: { entries: HealthEntry[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const connected = entries.filter((e) => e.connected).length;
  const open = entries.find((e) => e.id === openId) ?? null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium tracking-wider text-muted uppercase">
          Health
        </span>
        <span className="num text-[11px] font-medium text-muted">
          {connected}/{entries.length}
        </span>
        <span aria-hidden className="h-3 w-px bg-[var(--hairline)]" />

        {entries.map((e) => {
          const isOpen = openId === e.id;
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => setOpenId(isOpen ? null : e.id)}
              aria-expanded={isOpen}
              className={cn(
                "press surface-muted inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                e.connected ? "text-ink" : "text-muted",
                isOpen && "ring-1 ring-[var(--hairline-strong)]",
              )}
            >
              <span
                aria-hidden
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{
                  background: e.connected ? "var(--green)" : "var(--muted)",
                  animation:
                    e.connected && e.verified
                      ? "status-pulse 2.4s ease-in-out infinite"
                      : undefined,
                }}
              />
              {e.name}
              <span className="sr-only">
                {e.connected
                  ? e.verified
                    ? " — connected, verified this request"
                    : " — credentials present, not verified"
                  : " — not connected"}
              </span>
              <ChevronDown
                size={11}
                aria-hidden
                className={cn(
                  "transition-transform",
                  isOpen && "rotate-180",
                )}
              />
            </button>
          );
        })}
      </div>

      {open ? (
        <div className="fade-rise surface-muted rounded-control px-3.5 py-3 text-xs">
          <p className="font-semibold text-ink">
            {open.name}
            {" · "}
            <span
              style={{
                color: open.connected ? "var(--green)" : "var(--muted)",
              }}
            >
              {open.connected
                ? open.verified
                  ? "Connected (verified just now)"
                  : "Credentials present (not verified)"
                : "Not connected"}
            </span>
          </p>
          <p className="mt-1 text-muted">{open.description}</p>
          {!open.connected ? (
            <p className="mt-1.5 text-muted">
              Needs{" "}
              <code className="num text-ink">
                {open.requiredEnv.join(", ")}
              </code>{" "}
              in the environment.
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Link
              href="/integrations"
              className="font-medium text-accent-bright hover:underline"
            >
              Open integrations
            </Link>
            {open.setupUrl ? (
              <a
                href={open.setupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-accent-bright hover:underline"
              >
                Get credentials
                <ExternalLink size={11} aria-hidden />
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
