import { prisma } from "@/lib/prisma";
import { resolveActor } from "@/lib/agent-auth";
import {
  MAX_ATTACHMENT_BYTES,
  humanSize,
  labelForLink,
  normalizeLink,
  safeFilename,
} from "@/lib/tasks/attachments";

export const dynamic = "force-dynamic";

const MAX_PER_TASK = 20;

/**
 * POST /api/tasks/[id]/attachments — pin a doc or a link to a to-do.
 *
 * Two content types, because the two things people do are different:
 *   application/json     { url, label? }  → a link
 *   multipart/form-data  file, label?     → a file, stored in the row
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = resolveActor(request);
  if (actor instanceof Response) return actor;
  const { id } = await params;

  const task = await prisma.hqTask.findUnique({ where: { id } });
  if (!task) return Response.json({ error: "Not found" }, { status: 404 });

  const count = await prisma.taskAttachment.count({ where: { taskId: id } });
  if (count >= MAX_PER_TASK) {
    return Response.json(
      { error: `A task can hold ${MAX_PER_TASK} attachments.` },
      { status: 400 },
    );
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!form || !(file instanceof File) || file.size === 0) {
      return Response.json({ error: "No file in the upload." }, { status: 400 });
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return Response.json(
        {
          error: `That file is ${humanSize(file.size)}. The limit is ${humanSize(
            MAX_ATTACHMENT_BYTES,
          )} — put it in Drive and attach the link instead.`,
        },
        { status: 413 },
      );
    }
    const rawLabel = form.get("label");
    const label =
      typeof rawLabel === "string" && rawLabel.trim()
        ? rawLabel.trim().slice(0, 120)
        : safeFilename(file.name);
    const bytes = Buffer.from(await file.arrayBuffer());

    const created = await prisma.taskAttachment.create({
      data: {
        taskId: id,
        kind: "file",
        label,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: bytes.byteLength,
        data: bytes,
        addedBy: actor,
      },
      select: {
        id: true,
        kind: true,
        label: true,
        url: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
      },
    });
    return Response.json(created, { status: 201 });
  }

  const body = (await request.json().catch(() => null)) as {
    url?: unknown;
    label?: unknown;
  } | null;
  const url = typeof body?.url === "string" ? normalizeLink(body.url) : null;
  if (!url) {
    return Response.json(
      { error: "That doesn't look like an http(s) link." },
      { status: 400 },
    );
  }
  const label =
    typeof body?.label === "string" && body.label.trim()
      ? body.label.trim().slice(0, 120)
      : labelForLink(url);

  const created = await prisma.taskAttachment.create({
    data: { taskId: id, kind: "link", label, url, addedBy: actor },
    select: {
      id: true,
      kind: true,
      label: true,
      url: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
  });
  return Response.json(created, { status: 201 });
}
