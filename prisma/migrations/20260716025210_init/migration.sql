-- CreateTable
CREATE TABLE "HealthCheck" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "note" TEXT NOT NULL DEFAULT 'ok',
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
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
    "mapPolicy" TEXT,
    "dropship" BOOLEAN,
    "freightModel" TEXT,
    "leadTime" TEXT,
    "warranty" TEXT,
    "lastContactDate" DATETIME,
    "nextAction" TEXT,
    "nextActionDate" DATETIME,
    "notes" TEXT,
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Interaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    CONSTRAINT "Interaction_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Supplier_stage_idx" ON "Supplier"("stage");

-- CreateIndex
CREATE INDEX "Supplier_cluster_idx" ON "Supplier"("cluster");

-- CreateIndex
CREATE INDEX "Supplier_nextActionDate_idx" ON "Supplier"("nextActionDate");

-- CreateIndex
CREATE INDEX "Interaction_supplierId_date_idx" ON "Interaction"("supplierId", "date");
