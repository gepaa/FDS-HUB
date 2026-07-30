# FDS HQ — The To-Do Board

### The shared list: note it down in one line, assign it to one of three seats, hang the docs off it, and let Claude explain what it actually involves.

The board lives at `/tasks` and is built on the existing `HqTask` table —
the same rows the Task Queue always held, the same rows the agent reads
and writes with `list_tasks` / `create_task` / `update_task`. Nothing was
migrated away; the queue grew a person, a date, attachments and a brief.

---

## 1. What it does

**Quick capture.** One text field. Type the thing, press Enter, move on.
No required fields — a task with nothing but a title is valid, and the
board says so ("No priority or date yet") rather than hiding it.

**Three seats.** The human side of the team is three rows in
`TeamMember` (`seat_1`, `seat_2`, `seat_3`), seeded by the migration with
stable ids so a task assigned locally means the same person in
production. Rename them under **Team** on the board — a rename re-labels
every task that seat owns, past and present. Seats are never deleted;
retiring one sets `active: false` so history keeps its owner.

A task can also be owned by **Claude** (the agent runs it with its tools,
the "Run now" button) or by **nobody yet**.

**Attachments.** Links and files, on any card. Links must be `http(s)`.
Files are stored inline in the row, capped at 4 MB — under Vercel's
4.5 MB request limit, so an oversized upload gets a readable message
instead of an opaque platform 413. Anything bigger belongs in Drive with
a link on the card.

**The AI brief.** "Explain with AI" turns a shorthand note into
something a colleague could pick up cold: what it means, 3–6 concrete
steps, and anything the model had to assume, phrased as a question. It
also *suggests* a priority and a due date — those are not applied. They
appear behind an **Apply** button, the same propose-then-accept shape as
every other AI output in the hub.

---

## 2. The order

`src/lib/tasks/sort.ts`. Plain code, not a model call: the order has to
be stable between two refreshes, instant on every render, and each card
has to be able to say *why* it sits where it does.

| Rank | Bucket |
|-----:|--------|
| 0 | Pinned — the one manual override |
| 1 | Overdue |
| 2 | Due today |
| 3 | Hot |
| 4 | Due within 3 days |
| 5 | Warm |
| 6 | No priority set |
| 7 | Cold |

Ties break by due date (soonest first, undated last), then by age,
**oldest first** — so a task nobody picks up rises instead of rotting at
the bottom.

Dates are compared at day granularity: a task due today is due today all
day, not overdue from 00:01.

The sort runs on the server (`src/app/tasks/page.tsx`) and the client
preserves that order. Sorting in both places would mean the server and
the browser each picking an order from their own clock, and the list
flickering into a different shape on hydration.

---

## 3. Ownership, in two columns

`HqTask` carries both:

- `assignee` — `"claude" | "you"`. The agent-facing field. Every route,
  agent tool and test that predates the board reads this.
- `assigneeId` — which seat owns it, or null.

The UI speaks a single `owner` value (`"claude"`, a seat id, or
`"unassigned"`) and `src/lib/tasks/board.ts` converts. Keeping the old
column meant the migration never had to rewrite a live task row.

**What the agent may not do** (`src/app/api/tasks/[id]/route.ts`):
reassign a task, pin one, rename a seat, or delete a task or an
attachment. It can still work its own tasks and report results. The
tests in `tests/todo-api.test.ts` are the record of that boundary.

---

## 4. Deployment

Migration `20260730213507_todo_board`, in both schemas.

The SQLite version is **hand-rewritten**: Prisma's generated migration
rebuilt `HqTask` (new table → copy → `DROP TABLE` → rename) because the
new `assigneeId` column carries a foreign key. SQLite accepts a
`REFERENCES` clause on `ADD COLUMN` when the column is nullable, so the
rebuild is unnecessary and the `DROP` is a live-data hazard (Decisions
D1, additive-only). Columns are added in place instead.

Production is applied **out of band** — the Vercel build deliberately
does not run `prisma migrate deploy`, because the prod connection string
is the pgBouncer transaction pooler and migrations hang on it. Against
the Supabase project (`fds-hub-prod`):

1. Run `prisma/postgres/migrations/20260730213507_todo_board/migration.sql`.
   It ends by enabling RLS on both new tables, matching the deny-all
   posture of every other table.
2. Insert the matching `_prisma_migrations` row with the real sha256 of
   that file.
3. Deploy.

Order matters: the app 500s on `/tasks` until the tables exist, because
the page selects `teamMember` and `attachments`.

Reproduce the production build locally before pushing — a model added to
only one schema passes the local build and fails on Vercel:

```bash
DATABASE_URL=postgresql://… npx prisma generate && npx next build
```
