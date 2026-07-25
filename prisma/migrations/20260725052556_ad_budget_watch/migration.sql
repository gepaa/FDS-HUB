-- CreateTable
CREATE TABLE "AdAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'Google Ads',
    "externalId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "balance" REAL NOT NULL DEFAULT 0,
    "dailyBudget" REAL NOT NULL DEFAULT 0,
    "thresholdDays" INTEGER NOT NULL DEFAULT 3,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AdLedgerEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "delta" REAL NOT NULL,
    "balanceAfter" REAL NOT NULL,
    "note" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdLedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AdAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlertLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warn',
    "channel" TEXT NOT NULL DEFAULT 'discord',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlertLog_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AdAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AdAccount_active_idx" ON "AdAccount"("active");

-- CreateIndex
CREATE INDEX "AdLedgerEntry_accountId_occurredAt_idx" ON "AdLedgerEntry"("accountId", "occurredAt");

-- CreateIndex
CREATE INDEX "AlertLog_accountId_kind_createdAt_idx" ON "AlertLog"("accountId", "kind", "createdAt");
