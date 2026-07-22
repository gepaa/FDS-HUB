-- CreateTable
CREATE TABLE "CallSession" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationSec" INTEGER,
    "outcome" TEXT,
    "notes" TEXT NOT NULL DEFAULT '[]',
    "data" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CallSession_recordId_startedAt_idx" ON "CallSession"("recordId", "startedAt");

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
