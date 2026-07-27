import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";
import { toCallDetailDTO } from "@/lib/quo/dto";

export const dynamic = "force-dynamic";

/** GET /api/calls/[id] — everything about one call, fetched on expand. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;

  const { id } = await params;
  const activity = await prisma.commsActivity.findUnique({
    where: { id },
    include: { artifacts: true, extraction: true, tasks: true },
  });
  if (!activity) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json(toCallDetailDTO(activity));
}

const patchInput = z.object({
  /** The salesperson's edit of the AI note. Quo's original is untouched. */
  crmNote: z.string().max(10_000).optional(),
  /** Mark the call as looked at, clearing the "unreviewed" indicator. */
  reviewed: z.boolean().optional(),
  /** Accept the AI's read of the call. */
  confirmExtraction: z.boolean().optional(),
});

/**
 * PATCH /api/calls/[id] — human edits.
 *
 * Only ever touches OUR fields. Quo's transcript and summary rows are
 * not writable through this route at all: the provider's original has
 * to stay recoverable, or "the AI changed what I promised" becomes
 * unanswerable.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;

  const { id } = await params;
  const activity = await prisma.commsActivity.findUnique({ where: { id } });
  if (!activity) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = patchInput.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  const { crmNote, reviewed, confirmExtraction } = parsed.data;

  if (reviewed !== undefined) {
    await prisma.commsActivity.update({
      where: { id },
      data: {
        reviewedAt: reviewed ? new Date() : null,
        reviewedBy: reviewed ? actor : null,
      },
    });
  }

  if (crmNote !== undefined || confirmExtraction !== undefined) {
    const existing = await prisma.callExtraction.findUnique({
      where: { activityId: id },
    });
    if (!existing) {
      return Response.json(
        { error: "No AI summary on this call yet" },
        { status: 409 },
      );
    }
    await prisma.callExtraction.update({
      where: { activityId: id },
      data: {
        ...(crmNote !== undefined
          ? {
              crmNote,
              crmNoteEditedAt: new Date(),
              crmNoteEditedBy: actor,
            }
          : {}),
        ...(confirmExtraction !== undefined
          ? { humanConfirmed: confirmExtraction }
          : {}),
      },
    });
  }

  const updated = await prisma.commsActivity.findUnique({
    where: { id },
    include: { artifacts: true, extraction: true, tasks: true },
  });
  return Response.json(toCallDetailDTO(updated!));
}
