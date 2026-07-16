-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "recordId" TEXT,
    "draftSubject" TEXT,
    "draftBody" TEXT NOT NULL,
    "reasoning" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decisionNote" TEXT,
    "snoozedUntil" DATETIME,
    "createdBy" TEXT NOT NULL DEFAULT 'claude',
    "decidedAt" DATETIME,
    "executedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Approval_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HqTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "assignee" TEXT NOT NULL DEFAULT 'claude',
    "origin" TEXT NOT NULL DEFAULT 'you',
    "result" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "AgentMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL DEFAULT 'claude',
    "kind" TEXT NOT NULL DEFAULT 'log',
    "title" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Approval_status_createdAt_idx" ON "Approval"("status", "createdAt");

-- CreateIndex
CREATE INDEX "HqTask_status_createdAt_idx" ON "HqTask"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AgentMessage_kind_createdAt_idx" ON "AgentMessage"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "AgentMessage_createdAt_idx" ON "AgentMessage"("createdAt");
