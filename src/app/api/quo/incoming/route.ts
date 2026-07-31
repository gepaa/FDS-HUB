import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";
import { drainJobs } from "@/lib/quo/jobs";
import { env } from "@/lib/env";
import { displayPhone } from "@/lib/quo/phone";
import { quoStatus } from "@/lib/quo/config";
import { needsFollowUp } from "@/lib/domain";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** A call still ringing is only interesting for a short window. */
const RINGING_WINDOW_MS = 2 * 60 * 1000;

/**
 * Opportunistic queue draining.
 *
 * The webhook drains its own work immediately, and cron is the safety
 * net for anything that failed and is waiting on a backoff. But this
 * project runs on Vercel's Hobby plan, where cron may only fire ONCE
 * PER DAY — so a transcript that failed its first fetch would otherwise
 * sit unretried until tomorrow.
 *
 * This endpoint is already polled every few seconds by every open CRM
 * tab, which makes it a natural heartbeat: while anybody is working,
 * the queue keeps moving. When nobody is, nothing is urgent anyway and
 * the daily cron covers it.
 *
 * Throttled per instance so a room full of open tabs doesn't turn into
 * a drain storm.
 */
const DRAIN_EVERY_MS = 30_000;
let lastDrainAt = 0;

/**
 * GET /api/quo/incoming — what is ringing right now.
 *
 * Deliberately a poll rather than a new realtime transport. The hub has
 * no pub/sub today (its only SSE is the chat response stream, which is
 * a one-shot body, not a channel), and adding a websocket layer for one
 * notification would be a bigger change than the feature. The shell
 * already polls on an interval for its counts, so this fits the grain
 * of the app.
 *
 * What it returns is the minimum needed to decide how to answer the
 * phone: who is calling, where they are in the pipeline, and anything
 * we owe them. No transcript content — a notification is not the place
 * for a customer's recorded conversation.
 */
export async function GET(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;

  if (!quoStatus().enabled) return Response.json({ calls: [] });

  const since = new Date(Date.now() - RINGING_WINDOW_MS);

  const ringing = await prisma.commsActivity.findMany({
    where: {
      direction: "incoming",
      status: { in: ["ringing", "in-progress"] },
      completedAt: null,
      startedAt: { gte: since },
    },
    orderBy: { startedAt: "desc" },
    take: 5,
    include: {
      record: {
        select: {
          id: true,
          type: true,
          name: true,
          company: true,
          status: true,
          owner: true,
          productInterest: true,
          nextAction: true,
          nextActionDate: true,
          lastContactDate: true,
          needsEnrichment: true,
          supplierOwner: {
            select: { name: true },
          },
        },
      },
    },
  });

  const calls = await Promise.all(
    ringing.map(async (activity) => {
      const record = activity.record;

      // One line of context from the previous call — the last summary
      // is what a salesperson actually wants before picking up.
      let lastCallNote: string | null = null;
      if (record) {
        const previous = await prisma.commsActivity.findFirst({
          where: {
            recordId: record.id,
            id: { not: activity.id },
            status: "completed",
          },
          orderBy: { completedAt: "desc" },
          include: { extraction: { select: { crmNote: true } } },
        });
        const note = previous?.extraction?.crmNote ?? null;
        lastCallNote = note ? note.split("\n")[0].slice(0, 160) : null;
      }

      const overdue = record
        ? needsFollowUp({
            nextActionDate: record.nextActionDate,
            status: record.status,
          })
        : false;

      return {
        activityId: activity.id,
        startedAt: activity.startedAt?.toISOString() ?? null,
        phone: displayPhone(activity.externalNumber, env.QUO_DEFAULT_REGION),
        providerLink: activity.providerLink,
        known: Boolean(record) && !record?.needsEnrichment,
        record: record
          ? {
              id: record.id,
              type: record.type,
              name: record.name,
              company: record.company,
              stage: record.status,
              owner: record.supplierOwner?.name ?? record.owner,
              productInterest: record.productInterest,
              needsEnrichment: record.needsEnrichment,
            }
          : null,
        lastContactDate: record?.lastContactDate?.toISOString() ?? null,
        nextAction: record?.nextAction ?? null,
        nextActionDate: record?.nextActionDate?.toISOString() ?? null,
        overdue,
        lastCallNote,
      };
    }),
  );

  // Piggyback the queue on the poll, after the response is sent so the
  // alert is never delayed by background work.
  if (Date.now() - lastDrainAt > DRAIN_EVERY_MS) {
    lastDrainAt = Date.now();
    after(async () => {
      try {
        await drainJobs(5);
      } catch {
        // A failed drain is already recorded on the job row itself;
        // the alert poll must not surface it.
      }
    });
  }

  return Response.json({ calls });
}
