-- CreateTable
CREATE TABLE "CommsActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL DEFAULT 'quo',
    "providerActivityId" TEXT NOT NULL,
    "recordId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'call',
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "providerPhoneNumberId" TEXT,
    "providerConversationId" TEXT,
    "providerUserId" TEXT,
    "answeredByUserId" TEXT,
    "externalNumber" TEXT,
    "externalNumberE164" TEXT,
    "startedAt" DATETIME,
    "answeredAt" DATETIME,
    "completedAt" DATETIME,
    "durationSec" INTEGER,
    "missed" BOOLEAN NOT NULL DEFAULT false,
    "voicemail" BOOLEAN NOT NULL DEFAULT false,
    "aiHandled" TEXT,
    "forwardedFrom" TEXT,
    "forwardedTo" TEXT,
    "providerLink" TEXT,
    "reviewedAt" DATETIME,
    "reviewedBy" TEXT,
    "raw" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CommsActivity_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CallArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "segmentIndex" INTEGER NOT NULL DEFAULT 0,
    "providerArtifactId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "durationSec" INTEGER,
    "mimeType" TEXT,
    "providerUrl" TEXT,
    "storageKey" TEXT,
    "startedAt" DATETIME,
    "text" TEXT,
    "dialogue" TEXT,
    "bullets" TEXT,
    "nextSteps" TEXT,
    "fetchedAt" DATETIME,
    "error" TEXT,
    "retentionDeleteAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CallArtifact_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CommsActivity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CallExtraction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "model" TEXT,
    "data" TEXT NOT NULL DEFAULT '{}',
    "crmNote" TEXT,
    "crmNoteEditedAt" DATETIME,
    "crmNoteEditedBy" TEXT,
    "intentScore" INTEGER,
    "needsHumanReview" BOOLEAN NOT NULL DEFAULT false,
    "humanConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CallExtraction_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CommsActivity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL DEFAULT 'quo',
    "providerEventId" TEXT,
    "eventType" TEXT NOT NULL,
    "resourceId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "signatureValid" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'received',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    "lastError" TEXT
);

-- CreateTable
CREATE TABLE "JobQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "dedupeKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "runAfter" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "QuoContactLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recordId" TEXT NOT NULL,
    "quoContactId" TEXT,
    "externalId" TEXT NOT NULL,
    "lastSyncedAt" DATETIME,
    "lastSyncStatus" TEXT,
    "lastSyncError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuoContactLink_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IntegrationState" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" DATETIME NOT NULL
);

-- AlterTable  (HAND-REWRITTEN — additive only)
--
-- Prisma generated a RedefineTables block here that DROPped and recreated
-- both "Supplier" and "HqTask". docs/FDS_HQ_Decisions.md (D1) forbids that:
-- "Supplier" is the physical table holding the real FDS record set. The
-- change is purely additive, so it is expressed as ADD COLUMN, which SQLite
-- performs in place without touching a single existing row.
ALTER TABLE "Supplier" ADD COLUMN "phoneE164" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "needsEnrichment" BOOLEAN NOT NULL DEFAULT false;

-- SQLite cannot ADD CONSTRAINT to an existing table, but it does accept a
-- REFERENCES clause on ADD COLUMN as long as the new column defaults to NULL.
ALTER TABLE "HqTask" ADD COLUMN "recordId" TEXT REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HqTask" ADD COLUMN "activityId" TEXT REFERENCES "CommsActivity" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HqTask" ADD COLUMN "dueDate" DATETIME;
ALTER TABLE "HqTask" ADD COLUMN "priority" TEXT;
ALTER TABLE "HqTask" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'human';
ALTER TABLE "HqTask" ADD COLUMN "aiGenerated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "HqTask" ADD COLUMN "humanConfirmed" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Supplier_phoneE164_idx" ON "Supplier"("phoneE164");
CREATE INDEX "HqTask_recordId_idx" ON "HqTask"("recordId");
CREATE INDEX "HqTask_activityId_idx" ON "HqTask"("activityId");
CREATE INDEX "HqTask_dueDate_idx" ON "HqTask"("dueDate");


-- CreateIndex
CREATE INDEX "CommsActivity_recordId_startedAt_idx" ON "CommsActivity"("recordId", "startedAt");

-- CreateIndex
CREATE INDEX "CommsActivity_externalNumberE164_idx" ON "CommsActivity"("externalNumberE164");

-- CreateIndex
CREATE INDEX "CommsActivity_completedAt_idx" ON "CommsActivity"("completedAt");

-- CreateIndex
CREATE INDEX "CommsActivity_status_idx" ON "CommsActivity"("status");

-- CreateIndex
CREATE INDEX "CommsActivity_missed_completedAt_idx" ON "CommsActivity"("missed", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommsActivity_provider_providerActivityId_key" ON "CommsActivity"("provider", "providerActivityId");

-- CreateIndex
CREATE INDEX "CallArtifact_activityId_kind_idx" ON "CallArtifact"("activityId", "kind");

-- CreateIndex
CREATE INDEX "CallArtifact_providerArtifactId_idx" ON "CallArtifact"("providerArtifactId");

-- CreateIndex
CREATE INDEX "CallArtifact_retentionDeleteAt_idx" ON "CallArtifact"("retentionDeleteAt");

-- CreateIndex
CREATE UNIQUE INDEX "CallArtifact_activityId_kind_segmentIndex_key" ON "CallArtifact"("activityId", "kind", "segmentIndex");

-- CreateIndex
CREATE UNIQUE INDEX "CallExtraction_activityId_key" ON "CallExtraction"("activityId");

-- CreateIndex
CREATE INDEX "CallExtraction_status_idx" ON "CallExtraction"("status");

-- CreateIndex
CREATE INDEX "WebhookEvent_status_receivedAt_idx" ON "WebhookEvent"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_eventType_receivedAt_idx" ON "WebhookEvent"("eventType", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_idempotencyKey_key" ON "WebhookEvent"("provider", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "JobQueue_dedupeKey_key" ON "JobQueue"("dedupeKey");

-- CreateIndex
CREATE INDEX "JobQueue_status_runAfter_idx" ON "JobQueue"("status", "runAfter");

-- CreateIndex
CREATE INDEX "JobQueue_kind_status_idx" ON "JobQueue"("kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "QuoContactLink_recordId_key" ON "QuoContactLink"("recordId");

-- CreateIndex
CREATE INDEX "QuoContactLink_quoContactId_idx" ON "QuoContactLink"("quoContactId");

-- CreateIndex
CREATE INDEX "QuoContactLink_externalId_idx" ON "QuoContactLink"("externalId");
