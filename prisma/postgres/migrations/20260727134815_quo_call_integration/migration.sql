-- Quo call integration (production / PostgreSQL).
--
-- Additive only: new tables plus new nullable columns on "Supplier" and
-- "HqTask". Nothing is dropped or rebuilt (docs/FDS_HQ_Decisions.md D1).
--
-- APPLYING THIS IN PRODUCTION: the Vercel build deliberately does NOT run
-- 'prisma migrate deploy' (the prod connection string is the pgBouncer
-- transaction pooler, which hangs migrations). Apply this file out of band
-- against the Supabase project and insert the matching "_prisma_migrations"
-- row. See docs/quo-crm-integration.md -> Deployment.

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "needsEnrichment" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phoneE164" TEXT;

-- AlterTable
ALTER TABLE "HqTask" ADD COLUMN     "activityId" TEXT,
ADD COLUMN     "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "humanConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priority" TEXT,
ADD COLUMN     "recordId" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'human';

-- CreateTable
CREATE TABLE "CommsActivity" (
    "id" TEXT NOT NULL,
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
    "startedAt" TIMESTAMP(3),
    "answeredAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationSec" INTEGER,
    "missed" BOOLEAN NOT NULL DEFAULT false,
    "voicemail" BOOLEAN NOT NULL DEFAULT false,
    "aiHandled" TEXT,
    "forwardedFrom" TEXT,
    "forwardedTo" TEXT,
    "providerLink" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "raw" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommsActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallArtifact" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "segmentIndex" INTEGER NOT NULL DEFAULT 0,
    "providerArtifactId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "durationSec" INTEGER,
    "mimeType" TEXT,
    "providerUrl" TEXT,
    "storageKey" TEXT,
    "startedAt" TIMESTAMP(3),
    "text" TEXT,
    "dialogue" TEXT,
    "bullets" TEXT,
    "nextSteps" TEXT,
    "fetchedAt" TIMESTAMP(3),
    "error" TEXT,
    "retentionDeleteAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallExtraction" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "model" TEXT,
    "data" TEXT NOT NULL DEFAULT '{}',
    "crmNote" TEXT,
    "crmNoteEditedAt" TIMESTAMP(3),
    "crmNoteEditedBy" TEXT,
    "intentScore" INTEGER,
    "needsHumanReview" BOOLEAN NOT NULL DEFAULT false,
    "humanConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
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
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobQueue" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "dedupeKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoContactLink" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "quoContactId" TEXT,
    "externalId" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoContactLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationState" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationState_pkey" PRIMARY KEY ("key")
);

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

-- CreateIndex
CREATE INDEX "Supplier_phoneE164_idx" ON "Supplier"("phoneE164");

-- CreateIndex
CREATE INDEX "HqTask_recordId_idx" ON "HqTask"("recordId");

-- CreateIndex
CREATE INDEX "HqTask_activityId_idx" ON "HqTask"("activityId");

-- CreateIndex
CREATE INDEX "HqTask_dueDate_idx" ON "HqTask"("dueDate");

-- AddForeignKey
ALTER TABLE "HqTask" ADD CONSTRAINT "HqTask_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HqTask" ADD CONSTRAINT "HqTask_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CommsActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommsActivity" ADD CONSTRAINT "CommsActivity_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallArtifact" ADD CONSTRAINT "CallArtifact_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CommsActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallExtraction" ADD CONSTRAINT "CallExtraction_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CommsActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoContactLink" ADD CONSTRAINT "QuoContactLink_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row level security -----------------------------------------------------
-- Every other table here has RLS enabled with no permissive policy
-- (deny-all; the app connects as the owner and bypasses it). New tables
-- must match that posture or they are reachable via the Supabase
-- anon/service endpoints.
ALTER TABLE "CommsActivity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CallArtifact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CallExtraction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebhookEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobQueue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuoContactLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IntegrationState" ENABLE ROW LEVEL SECURITY;
