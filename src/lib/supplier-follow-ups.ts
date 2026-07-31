import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const DISCORD_API = "https://discord.com/api/v10";
const CHANNEL_NAME = "follow-ups";
const CHANNEL_STATE_KEY = "discord:follow-ups-channel";
const TERMINAL = ["AUTHORIZED", "DECLINED"];

interface Delivery {
  delivered: boolean;
  channel: "discord" | "none";
  error?: string;
}

async function discordApi<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!env.DISCORD_BOT_TOKEN) throw new Error("Discord bot token is not set");
  const response = await fetch(`${DISCORD_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Discord API ${response.status}${detail ? `: ${detail.slice(0, 180)}` : ""}`,
    );
  }
  return (await response.json()) as T;
}

async function resolveGuildId(): Promise<string> {
  if (env.DISCORD_GUILD_ID) return env.DISCORD_GUILD_ID;

  const knownChannel = env.DISCORD_CHANNEL_IDS?.split(",")
    .map((id) => id.trim())
    .find(Boolean);
  if (knownChannel) {
    const channel = await discordApi<{ guild_id?: string }>(
      `/channels/${knownChannel}`,
    );
    if (channel.guild_id) return channel.guild_id;
  }

  const guilds = await discordApi<Array<{ id: string }>>("/users/@me/guilds");
  if (guilds.length === 1) return guilds[0].id;
  throw new Error(
    guilds.length === 0
      ? "The Discord bot is not installed in a server"
      : "Set DISCORD_GUILD_ID because the bot belongs to multiple servers",
  );
}

async function ensureFollowUpsChannel(): Promise<string> {
  const cached = await prisma.integrationState.findUnique({
    where: { key: CHANNEL_STATE_KEY },
  });
  if (cached) {
    try {
      const value = JSON.parse(cached.value) as { channelId?: string };
      if (value.channelId) return value.channelId;
    } catch {
      // Re-discover below.
    }
  }

  const guildId = await resolveGuildId();
  const channels = await discordApi<
    Array<{ id: string; name: string; type: number }>
  >(`/guilds/${guildId}/channels`);
  let channel = channels.find(
    (item) => item.type === 0 && item.name.toLowerCase() === CHANNEL_NAME,
  );
  if (!channel) {
    channel = await discordApi<{ id: string; name: string; type: number }>(
      `/guilds/${guildId}/channels`,
      {
        method: "POST",
        body: JSON.stringify({
          name: CHANNEL_NAME,
          type: 0,
          topic:
            "Automatic supplier follow-up reminders from the FDS Hub CRM.",
        }),
      },
    );
  }

  await prisma.integrationState.upsert({
    where: { key: CHANNEL_STATE_KEY },
    create: {
      key: CHANNEL_STATE_KEY,
      value: JSON.stringify({ channelId: channel.id, guildId }),
    },
    update: {
      value: JSON.stringify({ channelId: channel.id, guildId }),
    },
  });
  return channel.id;
}

async function resolveMention(
  guildId: string,
  member: { id: string; name: string; discordUserId: string | null },
): Promise<string | null> {
  if (member.discordUserId) return member.discordUserId;
  const matches = await discordApi<
    Array<{
      nick?: string | null;
      user: { id: string; username: string; global_name?: string | null };
    }>
  >(`/guilds/${guildId}/members/search?query=${encodeURIComponent(member.name)}&limit=20`);
  const target = member.name.trim().toLowerCase();
  const exact = matches.filter((match) =>
    [match.nick, match.user.global_name, match.user.username]
      .filter(Boolean)
      .some((name) => name?.trim().toLowerCase() === target),
  );
  if (exact.length !== 1) return null;
  const discordUserId = exact[0].user.id;
  await prisma.teamMember.update({
    where: { id: member.id },
    data: { discordUserId },
  });
  return discordUserId;
}

async function deliver(
  input: {
    title: string;
    body: string;
    member: { id: string; name: string; discordUserId: string | null };
  },
): Promise<Delivery> {
  try {
    if (env.DISCORD_BOT_TOKEN) {
      const channelId = await ensureFollowUpsChannel();
      const state = await prisma.integrationState.findUnique({
        where: { key: CHANNEL_STATE_KEY },
      });
      const guildId = state
        ? ((JSON.parse(state.value) as { guildId?: string }).guildId ??
          (await resolveGuildId()))
        : await resolveGuildId();
      const discordUserId = await resolveMention(guildId, input.member);
      const mention = discordUserId ? `<@${discordUserId}> ` : "";
      await discordApi(`/channels/${channelId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content: `${mention}🔔 **${input.title}**\n${input.body}`,
          allowed_mentions: discordUserId
            ? { parse: [], users: [discordUserId] }
            : { parse: [] },
        }),
      });
      return { delivered: true, channel: "discord" };
    }

    if (env.DISCORD_FOLLOWUPS_WEBHOOK_URL) {
      const discordUserId = input.member.discordUserId;
      const mention = discordUserId ? `<@${discordUserId}> ` : "";
      const response = await fetch(env.DISCORD_FOLLOWUPS_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `${mention}🔔 **${input.title}**\n${input.body}`,
          allowed_mentions: discordUserId
            ? { parse: [], users: [discordUserId] }
            : { parse: [] },
        }),
      });
      if (!response.ok) throw new Error(`Discord webhook ${response.status}`);
      return { delivered: true, channel: "discord" };
    }

    return {
      delivered: false,
      channel: "none",
      error: "No Discord bot or follow-ups webhook is configured",
    };
  } catch (error) {
    return {
      delivered: false,
      channel: "discord",
      error: error instanceof Error ? error.message : "Discord delivery failed",
    };
  }
}

function hubRecordUrl(recordId: string): string {
  const host =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL ??
    "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}/supplier-outreach/${encodeURIComponent(recordId)}`;
}

export async function checkSupplierFollowUps(now = new Date()) {
  const records = await prisma.crmRecord.findMany({
    where: {
      type: "supplier",
      status: { notIn: TERMINAL },
      nextActionDate: { lte: now },
      supplierOwnerId: { not: null },
    },
    include: { supplierOwner: true },
    orderBy: { nextActionDate: "asc" },
  });

  const outcomes: Array<{
    recordId: string;
    supplier: string;
    owner: string;
    delivered: boolean;
    reason?: string;
  }> = [];

  for (const record of records) {
    const due = record.nextActionDate;
    const member = record.supplierOwner;
    if (!due || !member) continue;
    if (
      record.followUpReminderSentFor?.getTime() === due.getTime()
    ) {
      outcomes.push({
        recordId: record.id,
        supplier: record.name,
        owner: member.name,
        delivered: false,
        reason: "already reminded for this date",
      });
      continue;
    }

    const contact = record.mainContact
      ? `Contact: ${record.mainContact}${record.phone ? ` · ${record.phone}` : ""}`
      : record.phone
        ? `Phone: ${record.phone}`
        : null;
    const body = [
      record.nextAction ?? "Follow up with this supplier",
      contact,
      `Due: ${due.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      })}`,
      hubRecordUrl(record.id),
    ]
      .filter(Boolean)
      .join("\n");
    const result = await deliver({
      title: `Supplier follow-up — ${record.name}`,
      body,
      member,
    });

    await prisma.alertLog.create({
      data: {
        kind: "supplier_follow_up",
        severity: "warn",
        channel: result.channel,
        title: `Supplier follow-up — ${record.name}`,
        body,
        delivered: result.delivered,
      },
    });
    if (result.delivered) {
      await prisma.crmRecord.update({
        where: { id: record.id },
        data: { followUpReminderSentFor: due },
      });
    }
    outcomes.push({
      recordId: record.id,
      supplier: record.name,
      owner: member.name,
      delivered: result.delivered,
      reason: result.error,
    });
  }

  return { checked: records.length, outcomes };
}
