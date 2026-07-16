-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "HealthCheck" (
    "id" SERIAL NOT NULL,
    "note" TEXT NOT NULL DEFAULT 'ok',
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "recordId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'supplier',
    "name" TEXT NOT NULL,
    "company" TEXT,
    "niche" TEXT,
    "cluster" TEXT NOT NULL DEFAULT 'Other',
    "bestSeller" TEXT,
    "rank" TEXT,
    "websiteUrl" TEXT,
    "dealerAppUrl" TEXT,
    "mainContact" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'NOT_CONTACTED',
    "owner" TEXT NOT NULL DEFAULT 'unassigned',
    "priority" TEXT,
    "contextSummary" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "linkedThread" TEXT,
    "linkedShopifyId" TEXT,
    "mapPolicy" TEXT,
    "dropship" BOOLEAN,
    "freightModel" TEXT,
    "leadTime" TEXT,
    "warranty" TEXT,
    "productCategories" TEXT NOT NULL DEFAULT '[]',
    "dealerProgram" TEXT,
    "mediaPermission" TEXT,
    "authorizationStatus" TEXT,
    "productInterest" TEXT,
    "intent" TEXT,
    "quoteAmount" DOUBLE PRECISION,
    "lastContactDate" TIMESTAMP(3),
    "nextAction" TEXT,
    "nextActionDate" TIMESTAMP(3),
    "notes" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interaction" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'you',

    CONSTRAINT "Interaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "recordId" TEXT,
    "draftSubject" TEXT,
    "draftBody" TEXT NOT NULL,
    "reasoning" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decisionNote" TEXT,
    "snoozedUntil" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL DEFAULT 'claude',
    "decidedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HqTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "assignee" TEXT NOT NULL DEFAULT 'claude',
    "origin" TEXT NOT NULL DEFAULT 'you',
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "HqTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMessage" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'claude',
    "kind" TEXT NOT NULL DEFAULT 'log',
    "title" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_recordId_key" ON "Supplier"("recordId");

-- CreateIndex
CREATE INDEX "Supplier_stage_idx" ON "Supplier"("stage");

-- CreateIndex
CREATE INDEX "Supplier_cluster_idx" ON "Supplier"("cluster");

-- CreateIndex
CREATE INDEX "Supplier_nextActionDate_idx" ON "Supplier"("nextActionDate");

-- CreateIndex
CREATE INDEX "Supplier_type_idx" ON "Supplier"("type");

-- CreateIndex
CREATE INDEX "Supplier_owner_idx" ON "Supplier"("owner");

-- CreateIndex
CREATE INDEX "Interaction_supplierId_date_idx" ON "Interaction"("supplierId", "date");

-- CreateIndex
CREATE INDEX "Approval_status_createdAt_idx" ON "Approval"("status", "createdAt");

-- CreateIndex
CREATE INDEX "HqTask_status_createdAt_idx" ON "HqTask"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AgentMessage_kind_createdAt_idx" ON "AgentMessage"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "AgentMessage_createdAt_idx" ON "AgentMessage"("createdAt");

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

