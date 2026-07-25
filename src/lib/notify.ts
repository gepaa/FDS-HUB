import { env } from "@/lib/env";

/**
 * Phone-reaching notifications.
 *
 * Today's real channel is a Discord webhook: paste one URL into
 * DISCORD_WEBHOOK_URL, install Discord on your phone, and these
 * messages arrive as push notifications you actually see — not just an
 * in-app banner. The seam is deliberately thin so email/SMS can slot in
 * behind the same `notify()` call later.
 */

export type NotifySeverity = "warn" | "critical" | "info";

export interface NotifyInput {
  title: string;
  body: string;
  severity?: NotifySeverity;
  /** Optional link the message points back to (e.g. the hub page). */
  url?: string;
  /**
   * When true, prepend @everyone and allow the ping so the whole channel
   * is notified (used for critical/empty ad-budget alerts). Left off for
   * routine messages so the channel doesn't get muted.
   */
  mentionEveryone?: boolean;
}

export interface NotifyResult {
  delivered: boolean;
  channel: "discord" | "none";
  error?: string;
}

const COLORS: Record<NotifySeverity, number> = {
  info: 0x3b82f6, // blue
  warn: 0xf59e0b, // amber
  critical: 0xef4444, // red
};

/** True when a real push channel is wired. */
export function notifyChannelReady(): boolean {
  return Boolean(env.DISCORD_WEBHOOK_URL);
}

/**
 * Send a notification through the configured channel. Never throws —
 * returns a result the caller can log. When nothing is wired it
 * resolves `{ delivered: false, channel: "none" }` so the rest of the
 * flow (DB alert log, UI) still records that an alert *was raised*.
 */
export async function notify(input: NotifyInput): Promise<NotifyResult> {
  const severity = input.severity ?? "info";
  const webhook = env.DISCORD_WEBHOOK_URL;
  if (!webhook) return { delivered: false, channel: "none" };

  const emoji = severity === "critical" ? "🔴" : severity === "warn" ? "🟠" : "🔵";
  const description = input.url ? `${input.body}\n\n${input.url}` : input.body;

  // @everyone must appear in `content` AND be explicitly allowed, or
  // Discord renders the text but suppresses the actual ping.
  const mention = input.mentionEveryone ? "@everyone " : "";

  const payload = {
    // A plain content line guarantees a legible mobile push preview even
    // where embeds are collapsed.
    content: `${mention}${emoji} **${input.title}**`,
    allowed_mentions: {
      parse: input.mentionEveryone ? ["everyone"] : [],
    },
    embeds: [
      {
        title: input.title,
        description,
        color: COLORS[severity],
      },
    ],
  };

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return {
        delivered: false,
        channel: "discord",
        error: `Discord webhook ${res.status}`,
      };
    }
    return { delivered: true, channel: "discord" };
  } catch (e) {
    return {
      delivered: false,
      channel: "discord",
      error: e instanceof Error ? e.message : "network error",
    };
  }
}
