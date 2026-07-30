import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";
import { safeFilename } from "@/lib/tasks/attachments";

export const dynamic = "force-dynamic";

/**
 * GET /api/tasks/[id]/attachments/[attachmentId] — download a file.
 *
 * Always served as an attachment with a neutral content type. Echoing
 * the uploader's own MIME type back would let an uploaded .html render
 * as a page on this origin, with this session's cookie attached.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  const { id, attachmentId } = await params;

  const file = await prisma.taskAttachment.findFirst({
    where: { id: attachmentId, taskId: id },
  });
  if (!file) return Response.json({ error: "Not found" }, { status: 404 });
  if (file.kind !== "file" || !file.data) {
    return Response.json(
      { error: "That attachment is a link, not a file." },
      { status: 400 },
    );
  }

  const name = safeFilename(file.label);
  const body = new Uint8Array(file.data);
  return new Response(body, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(body.byteLength),
      "Content-Disposition": `attachment; filename="${name}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}

/** DELETE — human only, matching the rest of the API's delete posture. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  if (actor === "claude") {
    return Response.json(
      { error: "Agent may not delete attachments" },
      { status: 403 },
    );
  }
  const { id, attachmentId } = await params;

  const existing = await prisma.taskAttachment.findFirst({
    where: { id: attachmentId, taskId: id },
    select: { id: true },
  });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  await prisma.taskAttachment.delete({ where: { id: existing.id } });
  return Response.json({ ok: true });
}
