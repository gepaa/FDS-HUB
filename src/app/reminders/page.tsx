import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { notifyChannelReady, reminderChannelDedicated } from "@/lib/notify";
import {
  RemindersWorkspace,
  type ReminderDTO,
} from "@/components/reminders/RemindersWorkspace";

export const metadata: Metadata = { title: "Reminders" };
export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  const reminders = await prisma.reminder.findMany({
    orderBy: [{ dueAt: "asc" }],
    take: 500,
    include: { events: { orderBy: { createdAt: "desc" }, take: 10 } },
  });

  const dtos: ReminderDTO[] = reminders.map((r) => ({
    id: r.id,
    title: r.title,
    detail: r.detail,
    dueAt: r.dueAt.toISOString(),
    repeat: r.repeat,
    status: r.status,
    priority: r.priority,
    category: r.category,
    lastFiredAt: r.lastFiredAt?.toISOString() ?? null,
    fireCount: r.fireCount,
    createdBy: r.createdBy,
    events: r.events.map((e) => ({
      id: e.id,
      kind: e.kind,
      channel: e.channel,
      delivered: e.delivered,
      detail: e.detail,
      createdAt: e.createdAt.toISOString(),
    })),
  }));

  return (
    <RemindersWorkspace
      initial={dtos}
      channelReady={notifyChannelReady()}
      dedicatedChannel={reminderChannelDedicated()}
    />
  );
}
