import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";
import { toCallSummaryDTO } from "@/lib/quo/dto";

export const dynamic = "force-dynamic";

/**
 * GET /api/records/[id]/calls — the call timeline for one lead.
 *
 * Returns availability flags only: no transcript text, no summary text,
 * no audio URLs. Expanding a single call fetches the rest. A lead with
 * a long history therefore costs the same to open as a new one.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;

  const { id } = await params;
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 25) || 25, 100);
  const cursor = url.searchParams.get("cursor");

  const record = await prisma.crmRecord.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!record) return Response.json({ error: "Not found" }, { status: 404 });

  const activities = await prisma.commsActivity.findMany({
    where: { recordId: id },
    orderBy: [{ startedAt: "desc" }, { createdAt: "desc" }],
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: {
      artifacts: {
        // Only the columns the availability flags need — transcript and
        // summary bodies stay on the server.
        select: {
          id: true,
          activityId: true,
          kind: true,
          segmentIndex: true,
          status: true,
          providerUrl: true,
          storageKey: true,
          text: true,
          bullets: true,
          durationSec: true,
          mimeType: true,
          providerArtifactId: true,
          dialogue: true,
          nextSteps: true,
          startedAt: true,
          fetchedAt: true,
          error: true,
          retentionDeleteAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      extraction: true,
    },
  });

  const hasMore = activities.length > limit;
  const page = hasMore ? activities.slice(0, limit) : activities;

  return Response.json({
    calls: page.map(toCallSummaryDTO),
    nextCursor: hasMore ? page[page.length - 1]?.id : null,
  });
}
