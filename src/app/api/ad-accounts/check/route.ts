import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";
import { checkAndAlert } from "@/lib/ad-budget-alerts";
import { notify, notifyChannelReady } from "@/lib/notify";

export const dynamic = "force-dynamic";

const checkInput = z.object({
  // "test" sends a single sample push so you can confirm the phone
  // pipe works; otherwise run the real sweep now.
  test: z.boolean().optional(),
});

/**
 * POST /api/ad-accounts/check — run the low-balance sweep on demand
 * (the "Check now" button), or send a test push (`{ test: true }`).
 */
export async function POST(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;

  const body = await request.json().catch(() => ({}));
  const parsed = checkInput.safeParse(body ?? {});
  const test = parsed.success ? parsed.data.test : false;

  if (test) {
    const ready = notifyChannelReady();
    const result = await notify({
      title: "FDS Budget Watch — test alert",
      body: "If you're seeing this on your phone, low-balance reminders are wired up. 🎯",
      severity: "info",
      url: "/ad-budget",
    });
    await prisma.alertLog.create({
      data: {
        kind: "test",
        severity: "warn",
        channel: result.channel,
        title: "Test alert",
        body: "Manual test push from the Ad Budget page.",
        delivered: result.delivered,
      },
    });
    return Response.json({
      ok: true,
      test: true,
      channelReady: ready,
      delivered: result.delivered,
      channel: result.channel,
      error: result.error,
    });
  }

  const result = await checkAndAlert();
  return Response.json({ ok: true, ...result });
}
