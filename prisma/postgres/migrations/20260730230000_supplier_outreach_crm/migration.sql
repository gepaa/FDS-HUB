-- Supplier outreach CRM (production / PostgreSQL).
--
-- Additive only: nullable/defaulted columns on "Supplier" and "TeamMember".
-- Nothing is dropped or rebuilt. Apply out of band against Supabase because
-- the production pgBouncer URL is not suitable for migrations.

ALTER TABLE "Supplier" ADD COLUMN     "dealerApplicationSigned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "followUpReminderSentFor" TIMESTAMP(3),
ADD COLUMN     "initialEmailSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supplierContacts" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "supplierOwnerId" TEXT;

ALTER TABLE "TeamMember" ADD COLUMN "discordUserId" TEXT;

CREATE INDEX "Supplier_supplierOwnerId_idx" ON "Supplier"("supplierOwnerId");

ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_supplierOwnerId_fkey"
FOREIGN KEY ("supplierOwnerId") REFERENCES "TeamMember"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "TeamMember"
SET "name" = 'Ben', "initials" = 'B'
WHERE "id" = 'seat_1';

UPDATE "TeamMember"
SET "name" = 'Bennett', "initials" = 'BE'
WHERE "id" = 'seat_2';

UPDATE "TeamMember"
SET "name" = 'Pablo', "initials" = 'P'
WHERE "id" = 'seat_3';

UPDATE "Supplier"
SET "supplierOwnerId" = 'seat_1'
WHERE "type" = 'supplier' AND "supplierOwnerId" IS NULL;
