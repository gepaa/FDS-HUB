-- CreateTable
CREATE TABLE "Clutch" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Clutch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Clutch_date_idx" ON "Clutch"("date");
