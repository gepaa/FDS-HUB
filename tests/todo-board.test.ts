import { describe, expect, it } from "vitest";
import {
  autoSort,
  bucketOf,
  daysUntil,
  reasonFor,
  urgencyOf,
} from "@/lib/tasks/sort";
import {
  labelForLink,
  normalizeLink,
  safeFilename,
} from "@/lib/tasks/attachments";
import { CLAUDE, UNASSIGNED, ownerColumns, ownerKey } from "@/lib/tasks/board";
import { renderBrief, suggestionFrom } from "@/lib/tasks/explain";
import { extractJson } from "@/lib/agent/complete";

/** Fixed clock — the whole point of the sort is that it's deterministic. */
const NOW = new Date("2026-07-30T14:00:00Z");

function task(over: Partial<Parameters<typeof bucketOf>[0]> = {}) {
  return {
    id: Math.random().toString(36).slice(2),
    pinned: false,
    priority: null as string | null,
    dueDate: null as string | null,
    createdAt: "2026-07-01T00:00:00.000Z",
    ...over,
  };
}

/** An ISO date `days` from NOW, at midday so timezone can't flip the day. */
function dueIn(days: number) {
  const d = new Date(NOW);
  d.setDate(d.getDate() + days);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

describe("daysUntil", () => {
  it("counts whole days, not hours", () => {
    // Due later today is still "today", not overdue.
    const earlierToday = new Date(NOW);
    earlierToday.setHours(1, 0, 0, 0);
    expect(daysUntil(earlierToday.toISOString(), NOW)).toBe(0);
    expect(daysUntil(dueIn(1), NOW)).toBe(1);
    expect(daysUntil(dueIn(-2), NOW)).toBe(-2);
  });

  it("is null for missing or unparseable dates", () => {
    expect(daysUntil(null, NOW)).toBeNull();
    expect(daysUntil("not a date", NOW)).toBeNull();
  });
});

describe("autoSort", () => {
  it("ranks pinned, then overdue, then today, then hot", () => {
    const pinned = task({ pinned: true, priority: "cold" });
    const overdue = task({ dueDate: dueIn(-1) });
    const today = task({ dueDate: dueIn(0) });
    const hot = task({ priority: "hot" });
    const soon = task({ dueDate: dueIn(2) });
    const warm = task({ priority: "warm" });
    const plain = task();
    const cold = task({ priority: "cold" });

    const order = autoSort(
      [cold, plain, warm, soon, hot, today, overdue, pinned],
      NOW,
    ).map((t) => t.id);

    expect(order).toEqual([
      pinned.id,
      overdue.id,
      today.id,
      hot.id,
      soon.id,
      warm.id,
      plain.id,
      cold.id,
    ]);
  });

  it("puts a cold task with a date above an undated hot one only when it is due sooner", () => {
    // A dated-but-far cold task must NOT jump a hot task.
    const hot = task({ priority: "hot" });
    const coldNextWeek = task({ priority: "cold", dueDate: dueIn(7) });
    expect(autoSort([coldNextWeek, hot], NOW)[0].id).toBe(hot.id);
  });

  it("breaks ties by due date, then by age — oldest first", () => {
    const older = task({ createdAt: "2026-06-01T00:00:00.000Z" });
    const newer = task({ createdAt: "2026-07-20T00:00:00.000Z" });
    expect(autoSort([newer, older], NOW).map((t) => t.id)).toEqual([
      older.id,
      newer.id,
    ]);

    const soonest = task({ priority: "hot", dueDate: dueIn(1) });
    const later = task({ priority: "hot", dueDate: dueIn(5) });
    // Both are overdue-free and hot; the earlier due date wins.
    expect(autoSort([later, soonest], NOW)[0].id).toBe(soonest.id);
  });

  it("sinks undated tasks below dated ones in the same bucket", () => {
    const dated = task({ priority: "warm", dueDate: dueIn(30) });
    const undated = task({ priority: "warm" });
    expect(autoSort([undated, dated], NOW)[0].id).toBe(dated.id);
  });

  it("does not mutate the input", () => {
    const list = [task({ priority: "cold" }), task({ pinned: true })];
    const before = list.map((t) => t.id);
    autoSort(list, NOW);
    expect(list.map((t) => t.id)).toEqual(before);
  });

  it("is stable across repeated runs with the same clock", () => {
    const list = [
      task({ dueDate: dueIn(-3) }),
      task({ priority: "hot" }),
      task(),
      task({ pinned: true }),
    ];
    expect(autoSort(list, NOW).map((t) => t.id)).toEqual(
      autoSort(list, NOW).map((t) => t.id),
    );
  });
});

describe("urgency and reason", () => {
  it("explains why a card sits where it does", () => {
    expect(reasonFor(task({ pinned: true }), NOW)).toBe("Pinned to the top");
    expect(reasonFor(task({ dueDate: dueIn(-1) }), NOW)).toBe("Overdue by 1 day");
    expect(reasonFor(task({ dueDate: dueIn(-4) }), NOW)).toBe("Overdue by 4 days");
    expect(reasonFor(task({ dueDate: dueIn(0) }), NOW)).toBe("Due today");
    expect(reasonFor(task({ priority: "hot" }), NOW)).toBe("Marked hot");
    expect(reasonFor(task({ dueDate: dueIn(2) }), NOW)).toBe("Due in 2 days");
    expect(reasonFor(task(), NOW)).toBe("No priority or date yet");
  });

  it("flags overdue and today distinctly", () => {
    expect(urgencyOf(task({ dueDate: dueIn(-1) }), NOW)).toBe("overdue");
    expect(urgencyOf(task({ dueDate: dueIn(0) }), NOW)).toBe("today");
    expect(urgencyOf(task({ dueDate: dueIn(10) }), NOW)).toBe("normal");
    expect(urgencyOf(task({ pinned: true }), NOW)).toBe("pinned");
  });
});

describe("ownership mapping", () => {
  it("round-trips through the two stored columns", () => {
    expect(ownerKey({ assignee: "claude", assigneeId: null })).toBe(CLAUDE);
    expect(ownerKey({ assignee: "you", assigneeId: null })).toBe(UNASSIGNED);
    expect(ownerKey({ assignee: "you", assigneeId: "seat_2" })).toBe("seat_2");

    expect(ownerColumns(CLAUDE)).toEqual({ assignee: "claude", assigneeId: null });
    expect(ownerColumns(UNASSIGNED)).toEqual({ assignee: "you", assigneeId: null });
    expect(ownerColumns("seat_3")).toEqual({ assignee: "you", assigneeId: "seat_3" });
  });

  it("keeps a seat-owned task off the agent's plate", () => {
    // The Run button keys off `assignee`; assigning to a person must
    // never leave it reading "claude".
    expect(ownerColumns("seat_1").assignee).toBe("you");
  });
});

describe("attachment links", () => {
  it("accepts http(s) and assumes https for a bare host", () => {
    expect(normalizeLink("https://drive.google.com/x")).toBe(
      "https://drive.google.com/x",
    );
    expect(normalizeLink("drive.google.com/x")).toBe("https://drive.google.com/x");
    expect(normalizeLink("  http://example.com  ")).toBe("http://example.com/");
  });

  it("rejects scripted and non-web schemes", () => {
    expect(normalizeLink("javascript:alert(1)")).toBeNull();
    expect(normalizeLink("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(normalizeLink("file:///C:/Windows/System32")).toBeNull();
    expect(normalizeLink("")).toBeNull();
    expect(normalizeLink("   ")).toBeNull();
  });

  it("labels a link readably when nobody typed a label", () => {
    expect(labelForLink("https://docs.google.com/document/d/abc123")).toBe(
      "docs.google.com/abc123",
    );
    expect(labelForLink("https://example.com")).toBe("example.com");
  });
});

describe("the AI brief", () => {
  const MODEL_REPLY = `Here you go:
{"brief":"Wexford quoted pallets in June and never came back.","steps":["Pull the June thread","Call the yard","Log the outcome"],"priority":"hot","dueInDays":2,"questions":["Which pallet spec was quoted?"]}`;

  it("renders a model reply into a readable brief", () => {
    const parsed = extractJson<Parameters<typeof renderBrief>[0]>(MODEL_REPLY);
    const brief = renderBrief(parsed!);
    expect(brief).toContain("Wexford quoted pallets in June");
    expect(brief).toContain("1. Pull the June thread");
    expect(brief).toContain("3. Log the outcome");
    expect(brief).toContain("Needs confirming:");
    expect(brief).toContain("• Which pallet spec was quoted?");
  });

  it("drops empty sections rather than printing bare headings", () => {
    const brief = renderBrief({ brief: "Just this.", steps: [], questions: [] });
    expect(brief).toBe("Just this.");
    expect(renderBrief({ questions: ["  ", ""] })).toBe("");
  });

  it("survives a reply with junk in the arrays", () => {
    const brief = renderBrief({
      brief: "Ok.",
      steps: ["Do a thing", "", null as unknown as string, 42 as unknown as string],
    });
    expect(brief).toBe("Ok.\n\n1. Do a thing");
  });

  it("turns dueInDays into a date and keeps only known priorities", () => {
    const now = Date.parse("2026-07-30T00:00:00.000Z");
    expect(suggestionFrom({ priority: "hot", dueInDays: 2 }, now)).toEqual({
      priority: "hot",
      dueDate: "2026-08-01T00:00:00.000Z",
    });
    // A model that invents a priority must not reach the board.
    expect(suggestionFrom({ priority: "URGENT!!", dueInDays: null }, now)).toEqual({
      priority: null,
      dueDate: null,
    });
    expect(suggestionFrom(null, now)).toEqual({ priority: null, dueDate: null });
  });

  it("clamps a nonsense due date instead of trusting it", () => {
    const now = Date.parse("2026-07-30T00:00:00.000Z");
    expect(suggestionFrom({ dueInDays: -5 }, now).dueDate).toBe(
      "2026-07-30T00:00:00.000Z",
    );
    expect(suggestionFrom({ dueInDays: 99_999 }, now).dueDate).toBe(
      "2027-07-30T00:00:00.000Z",
    );
    expect(suggestionFrom({ dueInDays: Number.NaN }, now).dueDate).toBeNull();
  });
});

describe("safeFilename", () => {
  it("strips paths, quotes and control characters", () => {
    expect(safeFilename("C:\\Users\\Ben\\quote.pdf")).toBe("quote.pdf");
    expect(safeFilename("../../etc/passwd")).toBe("passwd");
    expect(safeFilename('inv"oice.pdf')).toBe("invoice.pdf");
    expect(safeFilename("bad\r\nContent-Length: 0.pdf")).toBe(
      "badContent-Length: 0.pdf",
    );
  });

  it("keeps ordinary spaces and never returns empty", () => {
    expect(safeFilename("supplier quote v2.pdf")).toBe("supplier quote v2.pdf");
    expect(safeFilename("")).toBe("file");
    expect(safeFilename('"""')).toBe("file");
  });
});
