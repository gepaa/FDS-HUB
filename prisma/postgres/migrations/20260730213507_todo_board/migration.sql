-- To-do board (production / PostgreSQL).
--
-- Additive only: two new tables plus four new nullable/defaulted columns
-- on "HqTask". Nothing is dropped or rebuilt (docs/FDS_HQ_Decisions.md D1).
--
-- APPLYING THIS IN PRODUCTION: the Vercel build deliberately does NOT run
-- 'prisma migrate deploy' (the prod connection string is the pgBouncer
-- transaction pooler, which hangs migrations). Apply this file out of band
-- against the Supabase project, insert the matching "_prisma_migrations"
-- row, and ENABLE ROW LEVEL SECURITY on both new tables to match the
-- deny-all posture of every other table. See docs/todo-board.md.

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "initials" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#8AB4F8',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAttachment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "data" BYTEA,
    "addedBy" TEXT NOT NULL DEFAULT 'you',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAttachment_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "HqTask" ADD COLUMN     "aiBrief" TEXT,
ADD COLUMN     "aiBriefAt" TIMESTAMP(3),
ADD COLUMN     "assigneeId" TEXT,
ADD COLUMN     "pinned" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "TeamMember_sortOrder_idx" ON "TeamMember"("sortOrder");

-- CreateIndex
CREATE INDEX "TaskAttachment_taskId_idx" ON "TaskAttachment"("taskId");

-- CreateIndex
CREATE INDEX "HqTask_assigneeId_idx" ON "HqTask"("assigneeId");

-- AddForeignKey
ALTER TABLE "TaskAttachment" ADD CONSTRAINT "TaskAttachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "HqTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HqTask" ADD CONSTRAINT "HqTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the three seats with the same stable ids used locally, so a task
-- assigned in either database means the same person.
INSERT INTO "TeamMember" ("id", "name", "initials", "color", "sortOrder", "active", "updatedAt")
VALUES
    ('seat_1', 'Ben',    'B',  '#8AB4F8', 1, true, CURRENT_TIMESTAMP),
    ('seat_2', 'Seat 2', 'S2', '#7BD8A6', 2, true, CURRENT_TIMESTAMP),
    ('seat_3', 'Seat 3', 'S3', '#E0A9F0', 3, true, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Existing tasks that said "you" belong to seat 1.
UPDATE "HqTask" SET "assigneeId" = 'seat_1' WHERE "assignee" = 'you';

-- Match the deny-all RLS posture of every other table.
ALTER TABLE "TeamMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaskAttachment" ENABLE ROW LEVEL SECURITY;
