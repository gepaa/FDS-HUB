import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";
import { env } from "@/lib/env";
import {
  quoStatus,
  syncedPhoneNumberIds,
  QUO_API_VERSION,
} from "@/lib/quo/config";
import { quoClient } from "@/lib/quo/client";
import { QuoApiError } from "@/lib/quo/errors";
import { SUBSCRIBED_EVENTS } from "@/lib/quo/events";
import { drainJobs } from "@/lib/quo/jobs";
import { reconcileRecentCalls, backfillCalls } from "@/lib/quo/reconcile";
import { queueStats } from "@/lib/quo/queue";
import {
  getMetrics,
  recentErrors,
  getState,
  setState,
  STATE_KEYS,
} from "@/lib/quo/observability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/integrations/quo — the integration's health, for the admin
 * settings page.
 *
 * Never returns a secret. The API key and webhook secret are reported
 * only as "configured" booleans; there is no code path here that can
 * echo their values.
 */
export async function GET(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;

  const status = quoStatus();

  // Every read below touches the integration's own tables. On a
  // deployment where the migration has not been applied yet they do not
  // exist, and this page is precisely where someone would go to find
  // out why — so it must render and say so, not 500.
  let stats;
  try {
    stats = await Promise.all([
      getMetrics(),
      recentErrors(8),
      queueStats(),
      getState<{ at?: string; eventType?: string }>(STATE_KEYS.lastWebhook),
      getState<{ at?: string; imported?: number }>(STATE_KEYS.lastReconcile),
      getState<{ at?: string; imported?: number }>(STATE_KEYS.lastBackfill),
    ] as const);
  } catch {
    return Response.json({
      enabled: status.enabled,
      apiVersion: QUO_API_VERSION,
      apiKeyConfigured: Boolean(env.QUO_API_KEY),
      webhookSecretConfigured: Boolean(env.QUO_WEBHOOK_SECRET),
      extractionEnabled: status.canExtract,
      missing: [...status.missing, "DATABASE_MIGRATION"],
      migrationApplied: false,
      phoneNumberIds: syncedPhoneNumberIds(),
      subscribedEvents: SUBSCRIBED_EVENTS,
      recordingStorageMode: env.QUO_RECORDING_STORAGE_MODE,
      metrics: {},
      queue: {},
      errors: { events: [], jobs: [] },
      lastWebhookAt: null,
      lastReconcileAt: null,
      lastBackfillAt: null,
    });
  }

  const [metrics, errors, queue, lastWebhook, lastReconcile, lastBackfill] =
    stats;

  return Response.json({
    enabled: status.enabled,
    apiVersion: QUO_API_VERSION,
    migrationApplied: true,
    // Presence only — never the value.
    apiKeyConfigured: Boolean(env.QUO_API_KEY),
    webhookSecretConfigured: Boolean(env.QUO_WEBHOOK_SECRET),
    extractionEnabled: status.canExtract,
    missing: status.missing,
    phoneNumberIds: syncedPhoneNumberIds(),
    subscribedEvents: SUBSCRIBED_EVENTS,
    recordingStorageMode: env.QUO_RECORDING_STORAGE_MODE,
    metrics,
    queue,
    errors,
    lastWebhookAt: lastWebhook?.value?.at ?? null,
    lastReconcileAt: lastReconcile?.value?.at ?? null,
    lastBackfillAt: lastBackfill?.value?.at ?? null,
  });
}

const actionInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("test_connection") }),
  z.object({ action: z.literal("refresh_phone_numbers") }),
  z.object({ action: z.literal("refresh_users") }),
  z.object({ action: z.literal("list_webhooks") }),
  z.object({
    action: z.literal("register_webhook"),
    url: z.string().url(),
    label: z.string().max(80).optional(),
  }),
  z.object({ action: z.literal("drain_jobs") }),
  z.object({
    action: z.literal("reconcile"),
    sinceHours: z.number().int().min(1).max(168).optional(),
    dryRun: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("backfill"),
    startDate: z.string(),
    endDate: z.string(),
    phoneNumberId: z.string().optional(),
    dryRun: z.boolean().default(true),
    maxCalls: z.number().int().min(1).max(500).optional(),
  }),
  z.object({ action: z.literal("retry_job"), jobId: z.string() }),
]);

/**
 * POST /api/integrations/quo — administrative actions.
 *
 * Every action here is an administrator operation. Until per-user roles
 * exist, "administrator" means whoever holds the team password or the
 * agent token, and the two genuinely dangerous ones (backfill, webhook
 * registration) are additionally constrained: backfill defaults to a
 * dry run and is capped, and registration only ever targets a URL the
 * caller supplies explicitly.
 */
export async function POST(request: Request) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;

  const body = await request.json().catch(() => null);
  const parsed = actionInput.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  const status = quoStatus();
  const input = parsed.data;

  const needsApi = input.action !== "drain_jobs" && input.action !== "retry_job";
  if (needsApi && !status.canCallApi) {
    return Response.json(
      { error: "Quo API is not configured", missing: status.missing },
      { status: 409 },
    );
  }

  try {
    switch (input.action) {
      case "test_connection": {
        // Cheapest authenticated call that proves the key works.
        const numbers = await quoClient.listPhoneNumbers();
        await setState(STATE_KEYS.lastApiCheck, {
          at: new Date().toISOString(),
          ok: true,
        });
        return Response.json({
          ok: true,
          phoneNumberCount: numbers.length,
          numbers: numbers.map((n) => ({
            id: n.id,
            name: n.name,
            number: n.number,
          })),
        });
      }

      case "refresh_phone_numbers": {
        const numbers = await quoClient.listPhoneNumbers();
        return Response.json({ ok: true, numbers });
      }

      case "refresh_users": {
        const users = await quoClient.listUsers();
        return Response.json({
          ok: true,
          users: users.map((u) => ({
            id: u.id,
            name: [u.firstName, u.lastName].filter(Boolean).join(" "),
            email: u.email,
          })),
        });
      }

      case "list_webhooks": {
        const hooks = await quoClient.listWebhooks();
        return Response.json({ ok: true, webhooks: hooks });
      }

      case "register_webhook": {
        const created = await quoClient.createWebhook({
          url: input.url,
          events: [...SUBSCRIBED_EVENTS],
          label: input.label ?? "FDS Operations HQ",
          resourceIds: syncedPhoneNumberIds().length
            ? syncedPhoneNumberIds()
            : undefined,
          status: "enabled",
        });
        // The signing secret is returned exactly once, at creation. It
        // is shown to the administrator so they can put it in the
        // environment — and never stored in the database.
        return Response.json({
          ok: true,
          webhookId: created.id,
          signingSecret: created.key ?? null,
          note: created.key
            ? "Copy this into QUO_WEBHOOK_SECRET now — Quo will not show it again."
            : "Quo did not return a signing secret; rotate the webhook to obtain one.",
        });
      }

      case "drain_jobs": {
        const result = await drainJobs(25);
        return Response.json({ ok: true, ...result });
      }

      case "reconcile": {
        const result = await reconcileRecentCalls({
          sinceHours: input.sinceHours ?? 24,
          dryRun: input.dryRun ?? false,
        });
        return Response.json({ ok: result.ok, result });
      }

      case "backfill": {
        const start = new Date(input.startDate);
        const end = new Date(input.endDate);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          return Response.json({ error: "Invalid dates" }, { status: 400 });
        }
        if (start >= end) {
          return Response.json(
            { error: "startDate must be before endDate" },
            { status: 400 },
          );
        }
        const result = await backfillCalls({
          startDate: start,
          endDate: end,
          phoneNumberId: input.phoneNumberId,
          dryRun: input.dryRun,
          maxCalls: input.maxCalls,
        });
        return Response.json({ ok: result.ok, result });
      }

      case "retry_job": {
        const job = await prisma.jobQueue.findUnique({
          where: { id: input.jobId },
        });
        if (!job) return Response.json({ error: "No such job" }, { status: 404 });
        await prisma.jobQueue.update({
          where: { id: job.id },
          data: {
            status: "queued",
            attempts: 0,
            runAfter: new Date(),
            lastError: null,
            startedAt: null,
          },
        });
        const result = await drainJobs(5);
        return Response.json({ ok: true, ...result });
      }
    }
  } catch (err) {
    if (err instanceof QuoApiError) {
      // Surfaced verbatim to the administrator: "401 — check the key"
      // is far more useful than a generic failure.
      return Response.json(
        { error: err.message, kind: err.kind, status: err.status },
        { status: 502 },
      );
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
