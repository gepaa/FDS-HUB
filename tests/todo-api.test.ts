import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "./helpers";
import { prisma } from "@/lib/prisma";
import { POST as createTask } from "@/app/api/tasks/route";
import { PATCH as patchTask } from "@/app/api/tasks/[id]/route";
import { POST as addAttachment } from "@/app/api/tasks/[id]/attachments/route";
import {
  DELETE as deleteAttachment,
  GET as downloadAttachment,
} from "@/app/api/tasks/[id]/attachments/[attachmentId]/route";
import { PATCH as patchMember } from "@/app/api/team-members/[id]/route";

/**
 * The to-do board's API, against the real database.
 *
 * The interesting behaviour here is the boundary between a person and
 * the agent. The agent can work a task and report on it; it cannot
 * decide whose plate work lands on, push a card to the top of the
 * board, rename a teammate, or delete anything.
 */

const AGENT = { authorization: "Bearer test-agent-key" };
const json = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://test/api", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
const patch = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://test/api", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
const params = <T extends object>(p: T) => ({ params: Promise.resolve(p) });

async function makeTask(body: object = {}) {
  const res = await createTask(json({ title: "Chase the pallet quote", ...body }));
  return (await res.json()) as { id: string };
}

beforeEach(async () => {
  await resetDb();
});

describe("seats", () => {
  it("exist because the migration seeded them", async () => {
    const seats = await prisma.teamMember.findMany({ orderBy: { sortOrder: "asc" } });
    expect(seats.map((s) => s.id)).toEqual(["seat_1", "seat_2", "seat_3"]);
    expect(seats[0].name).toBe("Ben");
  });

  it("cannot be renamed by the agent", async () => {
    const res = await patchMember(
      patch({ name: "Whoever" }, AGENT),
      params({ id: "seat_1" }),
    );
    expect(res.status).toBe(403);
    expect((await prisma.teamMember.findUnique({ where: { id: "seat_1" } }))?.name)
      .toBe("Ben");
  });

  it("can be renamed by a person", async () => {
    const res = await patchMember(patch({ name: "Marta" }), params({ id: "seat_1" }));
    expect(res.status).toBe(200);
    expect((await prisma.teamMember.findUnique({ where: { id: "seat_1" } }))?.name)
      .toBe("Marta");
    await prisma.teamMember.update({ where: { id: "seat_1" }, data: { name: "Ben" } });
  });
});

describe("assigning a task", () => {
  it("writes both owner columns, so the agent never inherits a person's task", async () => {
    const { id } = await makeTask({ owner: "seat_2" });
    const task = await prisma.hqTask.findUniqueOrThrow({ where: { id } });
    expect(task.assigneeId).toBe("seat_2");
    expect(task.assignee).toBe("you");
  });

  it("clears the seat when a task goes to Claude", async () => {
    const { id } = await makeTask({ owner: "seat_3" });
    await patchTask(patch({ owner: "claude" }), params({ id }));
    const task = await prisma.hqTask.findUniqueOrThrow({ where: { id } });
    expect(task.assignee).toBe("claude");
    expect(task.assigneeId).toBeNull();
  });

  it("rejects a seat that doesn't exist rather than orphaning the task", async () => {
    const res = await createTask(json({ title: "Nope", owner: "seat_99" }));
    expect(res.status).toBe(400);
    expect(await prisma.hqTask.count()).toBe(0);

    const { id } = await makeTask();
    const bad = await patchTask(patch({ owner: "seat_99" }), params({ id }));
    expect(bad.status).toBe(400);
  });
});

describe("agent boundaries", () => {
  it("refuses to let the agent put work on a person's plate", async () => {
    const { id } = await makeTask();
    const res = await patchTask(patch({ owner: "seat_1" }, AGENT), params({ id }));
    expect(res.status).toBe(403);
    expect(
      (await prisma.hqTask.findUniqueOrThrow({ where: { id } })).assigneeId,
    ).toBeNull();
  });

  it("refuses to let the agent pin a card to the top", async () => {
    const { id } = await makeTask();
    const res = await patchTask(patch({ pinned: true }, AGENT), params({ id }));
    expect(res.status).toBe(403);
    expect((await prisma.hqTask.findUniqueOrThrow({ where: { id } })).pinned).toBe(
      false,
    );
  });

  it("still lets the agent report progress on its own work", async () => {
    const { id } = await makeTask({ owner: "claude" });
    const res = await patchTask(
      patch({ status: "running" }, AGENT),
      params({ id }),
    );
    expect(res.status).toBe(200);
  });

  it("refuses to let the agent delete an attachment", async () => {
    const { id } = await makeTask();
    const created = await addAttachment(
      json({ url: "https://drive.example.com/quote" }),
      params({ id }),
    );
    const { id: attachmentId } = (await created.json()) as { id: string };

    const res = await deleteAttachment(
      new Request("http://test/api", { method: "DELETE", headers: AGENT }),
      params({ id, attachmentId }),
    );
    expect(res.status).toBe(403);
    expect(await prisma.taskAttachment.count()).toBe(1);
  });
});

describe("attachments", () => {
  it("normalizes and labels a pasted link", async () => {
    const { id } = await makeTask();
    const res = await addAttachment(
      json({ url: "docs.google.com/document/d/quote-42" }),
      params({ id }),
    );
    expect(res.status).toBe(201);
    const row = await prisma.taskAttachment.findFirstOrThrow({ where: { taskId: id } });
    expect(row.url).toBe("https://docs.google.com/document/d/quote-42");
    expect(row.label).toBe("docs.google.com/quote-42");
    expect(row.kind).toBe("link");
  });

  it("stores an uploaded file and hands it back as a download", async () => {
    const { id } = await makeTask();
    const form = new FormData();
    form.append("file", new File(["48x40 heat-treated"], "quote.txt", {
      type: "text/plain",
    }));
    const created = await addAttachment(
      new Request("http://test/api", { method: "POST", body: form }),
      params({ id }),
    );
    expect(created.status).toBe(201);
    const { id: attachmentId } = (await created.json()) as { id: string };

    const download = await downloadAttachment(
      new Request("http://test/api"),
      params({ id, attachmentId }),
    );
    expect(download.status).toBe(200);
    // Never echoed back as text/html — an uploaded page must not render
    // on this origin.
    expect(download.headers.get("content-type")).toBe("application/octet-stream");
    expect(download.headers.get("content-disposition")).toBe(
      'attachment; filename="quote.txt"',
    );
    expect(await download.text()).toBe("48x40 heat-treated");
  });

  it("refuses a link that isn't http(s)", async () => {
    const { id } = await makeTask();
    for (const url of ["javascript:alert(1)", "data:text/html,<script>", "  "]) {
      const res = await addAttachment(json({ url }), params({ id }));
      expect(res.status).toBe(400);
    }
    expect(await prisma.taskAttachment.count()).toBe(0);
  });

  it("goes away with the task it belongs to", async () => {
    const { id } = await makeTask();
    await addAttachment(json({ url: "https://example.com/a" }), params({ id }));
    await prisma.hqTask.delete({ where: { id } });
    expect(await prisma.taskAttachment.count()).toBe(0);
  });
});
