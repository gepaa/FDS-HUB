-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prompt" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "actor" TEXT NOT NULL DEFAULT 'you',
    "branch" TEXT,
    "workflowRunId" TEXT,
    "runUrl" TEXT,
    "prNumber" INTEGER,
    "prUrl" TEXT,
    "diff" TEXT,
    "filesChanged" INTEGER,
    "additions" INTEGER,
    "deletions" INTEGER,
    "error" TEXT,
    "appliedAt" DATETIME,
    "appliedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "AgentRun_createdAt_idx" ON "AgentRun"("createdAt");

-- CreateIndex
CREATE INDEX "AgentRun_status_idx" ON "AgentRun"("status");
