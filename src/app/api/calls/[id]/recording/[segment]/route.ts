import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";
import { logIntegration } from "@/lib/quo/observability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/calls/[id]/recording/[segment] — the audio proxy.
 *
 * WHY A PROXY. Quo hands us a storage URL for each recording with no
 * documented expiry and no documented access control. Putting that URL
 * into an <audio src> would publish it: anyone who views source, shares
 * a screenshot of devtools, or inherits the browser history gets a
 * permanent link to a customer's recorded conversation, outside the
 * CRM's permissions entirely.
 *
 * So the browser only ever sees our own URL. This route checks the
 * caller, then streams the bytes. When per-user roles land (the parked
 * Stage 7 work), the single check below is the one place that needs to
 * learn about them — everything else already routes through here.
 *
 * Range requests are forwarded so seeking in a long call works.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; segment: string }> },
) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;

  const { id, segment } = await params;
  const segmentIndex = Number(segment);
  if (!Number.isInteger(segmentIndex) || segmentIndex < 0) {
    return Response.json({ error: "Bad segment" }, { status: 400 });
  }

  // Look the artifact up by BOTH ids. Accepting a bare artifact id would
  // let anyone iterate recordings that belong to other calls.
  const artifact = await prisma.callArtifact.findUnique({
    where: {
      activityId_kind_segmentIndex: {
        activityId: id,
        kind: "recording",
        segmentIndex,
      },
    },
  });

  if (!artifact) return Response.json({ error: "Not found" }, { status: 404 });

  if (artifact.status === "deleted") {
    return Response.json(
      { error: "This recording was deleted at the provider" },
      { status: 410 },
    );
  }

  if (!artifact.providerUrl) {
    return Response.json(
      { error: "Recording is not available yet" },
      { status: 409 },
    );
  }

  const range = request.headers.get("range");

  let upstream: Response;
  try {
    upstream = await fetch(artifact.providerUrl, {
      headers: range ? { Range: range } : undefined,
      cache: "no-store",
    });
  } catch {
    logIntegration({
      stage: "quo.recording.proxy",
      outcome: "failure",
      errorCode: "upstream_unreachable",
      activityId: id,
    });
    return Response.json({ error: "Recording unavailable" }, { status: 502 });
  }

  if (!upstream.ok && upstream.status !== 206) {
    // A provider URL that has expired is the expected failure here.
    logIntegration({
      stage: "quo.recording.proxy",
      outcome: "failure",
      errorCode: `upstream_${upstream.status}`,
      activityId: id,
    });
    return Response.json(
      { error: "Recording unavailable from provider" },
      { status: 502 },
    );
  }

  const headers = new Headers();
  headers.set(
    "Content-Type",
    upstream.headers.get("content-type") ?? artifact.mimeType ?? "audio/mpeg",
  );
  for (const h of ["content-length", "content-range", "accept-ranges"]) {
    const value = upstream.headers.get(h);
    if (value) headers.set(h, value);
  }
  // Never cached by a shared cache: this is customer audio behind a
  // permission check, and the check has to run every time.
  headers.set("Cache-Control", "private, no-store");
  headers.set("Content-Disposition", "inline");

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
