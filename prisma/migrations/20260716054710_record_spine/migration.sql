-- Record spine migration — HAND-EDITED to be additive-only.
--
-- Prisma's generated SQLite migration used the "RedefineTables" rebuild
-- pattern (CREATE new → INSERT SELECT → DROP TABLE "Supplier"). Per the
-- migration policy in docs/FDS_HQ_Decisions.md (D1: the 100-supplier
-- dataset must never pass through a DROP), it was replaced with pure
-- ADD COLUMN + CREATE INDEX statements. Verified equivalent to the
-- schema via `prisma migrate diff` after applying.

-- CrmRecord spine additions (physical table: "Supplier")
ALTER TABLE "Supplier" ADD COLUMN "recordId" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'supplier';
ALTER TABLE "Supplier" ADD COLUMN "company" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "owner" TEXT NOT NULL DEFAULT 'unassigned';
ALTER TABLE "Supplier" ADD COLUMN "priority" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "contextSummary" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "tags" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Supplier" ADD COLUMN "linkedThread" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "linkedShopifyId" TEXT;

-- Supplier-only fields (CRM Data Model §4, MVP subset)
ALTER TABLE "Supplier" ADD COLUMN "productCategories" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Supplier" ADD COLUMN "dealerProgram" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "mediaPermission" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "authorizationStatus" TEXT;

-- Lead-only fields (CRM Data Model §5, MVP subset)
ALTER TABLE "Supplier" ADD COLUMN "productInterest" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "intent" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "quoteAmount" REAL;

-- Indexes
CREATE UNIQUE INDEX "Supplier_recordId_key" ON "Supplier"("recordId");
CREATE INDEX "Supplier_type_idx" ON "Supplier"("type");
CREATE INDEX "Supplier_owner_idx" ON "Supplier"("owner");

-- Interaction: who logged it (you | claude | system)
ALTER TABLE "Interaction" ADD COLUMN "actor" TEXT NOT NULL DEFAULT 'you';
