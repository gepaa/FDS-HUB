-- To-do board: three human seats, attachments, and an AI brief per task.
--
-- HAND-REWRITTEN (Decisions D1, additive-only). Prisma's generated
-- version rebuilt "HqTask" — new table, copy rows, DROP TABLE, rename —
-- because the new "assigneeId" column carries a foreign key. SQLite
-- accepts a REFERENCES clause on ADD COLUMN as long as the column is
-- nullable, so the rebuild is unnecessary and the DROP is a live-data
-- hazard. Columns are added in place instead; every existing task row
-- survives untouched with assigneeId NULL.

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "initials" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#8AB4F8',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TaskAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "data" BLOB,
    "addedBy" TEXT NOT NULL DEFAULT 'you',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskAttachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "HqTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AlterTable (in place — no rebuild, no DROP)
ALTER TABLE "HqTask" ADD COLUMN "assigneeId" TEXT REFERENCES "TeamMember" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HqTask" ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "HqTask" ADD COLUMN "aiBrief" TEXT;
ALTER TABLE "HqTask" ADD COLUMN "aiBriefAt" DATETIME;

-- CreateIndex
CREATE INDEX "TeamMember_sortOrder_idx" ON "TeamMember"("sortOrder");

-- CreateIndex
CREATE INDEX "TaskAttachment_taskId_idx" ON "TaskAttachment"("taskId");

-- CreateIndex
CREATE INDEX "HqTask_assigneeId_idx" ON "HqTask"("assigneeId");

-- Seed the three seats with stable ids, so local and production agree
-- and a task assigned locally means the same person in production.
-- Seats 2 and 3 are placeholders: rename them in the UI.
INSERT INTO "TeamMember" ("id", "name", "initials", "color", "sortOrder", "active", "updatedAt")
VALUES
    ('seat_1', 'Ben',    'B',  '#8AB4F8', 1, true, CURRENT_TIMESTAMP),
    ('seat_2', 'Seat 2', 'S2', '#7BD8A6', 2, true, CURRENT_TIMESTAMP),
    ('seat_3', 'Seat 3', 'S3', '#E0A9F0', 3, true, CURRENT_TIMESTAMP);

-- Existing tasks that said "you" belong to seat 1.
UPDATE "HqTask" SET "assigneeId" = 'seat_1' WHERE "assignee" = 'you';
