import { signPayload } from "@/lib/quo/signature";
import { prisma } from "@/lib/prisma";

export const WEBHOOK_SECRET = process.env.QUO_WEBHOOK_SECRET as string;

let counter = 0;

/** A Quo webhook delivery, signed the way Quo signs it. */
export function buildDelivery(opts: {
  eventType: string;
  callId: string;
  direction?: "incoming" | "outgoing";
  status?: string;
  externalNumber?: string;
  workspaceNumber?: string;
  phoneNumberId?: string;
  conversationId?: string;
  userId?: string;
  answeredAt?: string | null;
  completedAt?: string | null;
  createdAt?: string;
  duration?: number | null;
  hasVoicemail?: boolean;
  contactIds?: string[];
  /** Reuse an id to simulate Quo retrying the same event. */
  webhookId?: string;
  timestamp?: number;
}) {
  const webhookId = opts.webhookId ?? `msg_test_${++counter}`;
  const timestamp = String(opts.timestamp ?? Math.floor(Date.now() / 1000));

  const body = {
    id: webhookId,
    type: opts.eventType,
    apiVersion: "2026-03-30",
    createdAt: new Date().toISOString(),
    data: {
      resource: {
        id: opts.callId,
        direction: opts.direction ?? "incoming",
        status: opts.status ?? "ringing",
        duration: opts.duration ?? null,
        hasVoicemail: opts.hasVoicemail ?? false,
        createdAt: opts.createdAt ?? new Date().toISOString(),
        answeredAt: opts.answeredAt ?? null,
        completedAt: opts.completedAt ?? null,
      },
      context: {
        phoneNumberId: opts.phoneNumberId ?? "PNtest0000000000",
        phoneNumberType: "shared",
        conversationId: opts.conversationId ?? "CNtest0000000000",
        userId: opts.userId ?? "UStest0001",
        participants: {
          external: [opts.externalNumber ?? "+14155550123"],
          workspace: [opts.workspaceNumber ?? "+14155550999"],
          resolution: "available",
        },
        contacts: {
          ids: opts.contactIds ?? [],
          lookupStatus: opts.contactIds?.length ? "matched" : "unmatched",
        },
      },
      links: {
        quo: `https://my.quo.com/inbox/PNtest0000000000/c/CNtest0000000000?at=${opts.callId}`,
      },
    },
  };

  const rawBody = JSON.stringify(body);
  const signature = signPayload(WEBHOOK_SECRET, webhookId, timestamp, rawBody);

  return {
    webhookId,
    rawBody,
    request: new Request("https://hub.test/api/integrations/quo/webhooks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "webhook-id": webhookId,
        "webhook-timestamp": timestamp,
        "webhook-signature": `v1,${signature}`,
      },
      body: rawBody,
    }),
  };
}

/** Wipe every table this integration writes to, between tests. */
export async function resetDb() {
  await prisma.alertLog.deleteMany();
  await prisma.callExtraction.deleteMany();
  await prisma.callArtifact.deleteMany();
  await prisma.hqTask.deleteMany();
  await prisma.commsActivity.deleteMany();
  await prisma.webhookEvent.deleteMany();
  await prisma.jobQueue.deleteMany();
  await prisma.quoContactLink.deleteMany();
  await prisma.interaction.deleteMany();
  await prisma.integrationState.deleteMany();
  await prisma.crmRecord.deleteMany();
}
