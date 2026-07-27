import { createHash } from "node:crypto";
import { after } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { QUO_PROVIDER, quoStatus } from "@/lib/quo/config";
import {
  verifyWebhookSignature,
  readSignatureHeaders,
} from "@/lib/quo/signature";
import { parseEnvelope, callIdOf, isCallEvent } from "@/lib/quo/events";
import { enqueue } from "@/lib/quo/queue";
import { drainJobs } from "@/lib/quo/jobs";
import {
  logIntegration,
  recordMetric,
  setState,
  STATE_KEYS,
} from "@/lib/quo/observability";

export const dynamic = "force-dynamic";
// Node runtime: signature verification uses node:crypto.
export const runtime = "nodejs";

/**
 * POST /api/integrations/quo/webhooks — Quo's delivery endpoint.
 *
 * This route is deliberately dull. It verifies, records, acknowledges,
 * and gets out of the way. All real work happens in background jobs,
 * because Quo expects a 2xx within seconds and downloading audio or
 * running a model takes longer than that.
 *
 * IMPORTANT: this path is excluded from the shared team password gate
 * in src/proxy.ts. Quo cannot send Basic credentials, so leaving it
 * behind the gate would 401 every delivery. Its actual authentication
 * is the signature check below — which is stronger than the gate, since
 * it proves the payload came from Quo unmodified.
 *
 * Order of operations matters:
 *   1. read the RAW body (signature covers exact bytes)
 *   2. verify — an unverified body is never parsed or trusted
 *   3. record idempotently
 *   4. respond 2xx
 *   5. process afterwards
 */
export async function POST(request: Request) {
  const status = quoStatus();

  // Rolled back / not configured. Acknowledge so Quo doesn't retry for
  // hours against an endpoint we have deliberately switched off, but
  // record nothing and do nothing.
  if (!status.enabled) {
    return Response.json({ ok: true, ignored: "integration_disabled" });
  }

  // 1. Raw body, before any parsing.
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return Response.json({ error: "Unreadable body" }, { status: 400 });
  }

  // 2. Signature.
  const headers = readSignatureHeaders(request.headers);
  const verification = verifyWebhookSignature({
    secret: env.QUO_WEBHOOK_SECRET,
    ...headers,
    rawBody,
  });

  if (!verification.valid) {
    recordMetric("quo.webhook.invalid_signature");
    logIntegration({
      stage: "quo.webhook.verify",
      outcome: "failure",
      errorCode: verification.reason,
    });
    // 401 on a bad signature, 503 when we simply have no secret yet —
    // the second is our misconfiguration, not a bad request, and Quo
    // should keep retrying while it is fixed.
    const missingSecret = verification.reason === "missing_secret";
    return Response.json(
      { error: missingSecret ? "Webhook not configured" : "Invalid signature" },
      { status: missingSecret ? 503 : 401 },
    );
  }

  // 3. Record, idempotently.
  //
  // Standard Webhooks guarantees `webhook-id` is stable across retries
  // of the same logical event, so it is a real idempotency key rather
  // than a hash we hope is unique. The payload hash is the fallback for
  // any delivery that arrives without one.
  const payloadHash = createHash("sha256").update(rawBody).digest("hex");
  const idempotencyKey = headers.webhookId ?? `hash:${payloadHash}`;

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Body is not JSON" }, { status: 400 });
  }

  const envelope = parseEnvelope(parsedBody);
  const eventType = envelope?.eventType ?? "unknown";
  const resourceId = envelope ? callIdOf(envelope) : null;

  const existing = await prisma.webhookEvent.findUnique({
    where: {
      provider_idempotencyKey: {
        provider: QUO_PROVIDER,
        idempotencyKey,
      },
    },
  });

  if (existing) {
    // A retry of something we already have. Acknowledge and stop — this
    // is what stops duplicate calls, leads and tasks.
    recordMetric("quo.webhook.duplicate");
    logIntegration({
      stage: "quo.webhook.duplicate",
      outcome: "skipped",
      eventType,
      callId: resourceId ?? undefined,
    });
    return Response.json({ ok: true, duplicate: true });
  }

  let eventRow;
  try {
    eventRow = await prisma.webhookEvent.create({
      data: {
        provider: QUO_PROVIDER,
        providerEventId: headers.webhookId,
        eventType,
        resourceId,
        idempotencyKey,
        payloadHash,
        // Stored so a failed event can be replayed by an administrator.
        // Never written to application logs.
        payload: rawBody.slice(0, 100_000),
        signatureValid: true,
        status: "received",
      },
    });
  } catch {
    // Unique violation: two deliveries of the same event raced. The
    // other one won, and that is a success from Quo's point of view.
    recordMetric("quo.webhook.duplicate");
    return Response.json({ ok: true, duplicate: true });
  }

  recordMetric("quo.webhook.received");
  logIntegration({
    stage: "quo.webhook.received",
    outcome: "success",
    eventType,
    callId: resourceId ?? undefined,
  });

  // Only call events matter to this MVP. Message and contact events are
  // stored (so nothing is lost) but not acted on.
  if (isCallEvent(eventType)) {
    await enqueue(
      "quo.process_webhook",
      { webhookEventId: eventRow.id },
      { dedupeKey: `quo.process_webhook:${eventRow.id}` },
    );
  } else {
    await prisma.webhookEvent.update({
      where: { id: eventRow.id },
      data: {
        status: "skipped",
        processedAt: new Date(),
        lastError: "event_type_not_handled",
      },
    });
  }

  // 5. Work happens after the response is sent, so Quo sees a fast 2xx.
  after(async () => {
    try {
      await setState(STATE_KEYS.lastWebhook, {
        at: new Date().toISOString(),
        eventType,
      });
      await drainJobs(10);
    } catch (err) {
      logIntegration({
        stage: "quo.webhook.after",
        outcome: "failure",
        errorCode: err instanceof Error ? err.name : "unknown",
      });
    }
  });

  // 4. Acknowledge.
  return Response.json({ ok: true, eventId: eventRow.id });
}

/**
 * Quo does not require a GET, but having one makes "is my URL right?"
 * answerable from a browser without sending a fake event. It reveals
 * nothing: no secrets, no counts, no customer data.
 */
export async function GET() {
  const status = quoStatus();
  return Response.json({
    endpoint: "quo-webhooks",
    enabled: status.enabled,
    ready: status.canReceiveWebhooks,
  });
}
