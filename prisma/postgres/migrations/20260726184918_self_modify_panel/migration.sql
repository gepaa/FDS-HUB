-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
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
    "appliedAt" TIMESTAMP(3),
    "appliedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentRun_createdAt_idx" ON "AgentRun"("createdAt");

-- CreateIndex
CREATE INDEX "AgentRun_status_idx" ON "AgentRun"("status");
