-- Supplier outreach CRM.
--
-- Additive only: nullable/defaulted columns on the existing Supplier and
-- TeamMember tables. The 100-supplier table is never rebuilt or dropped.

ALTER TABLE "Supplier" ADD COLUMN "supplierOwnerId" TEXT
  REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Supplier" ADD COLUMN "dealerApplicationSigned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Supplier" ADD COLUMN "initialEmailSent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Supplier" ADD COLUMN "supplierContacts" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Supplier" ADD COLUMN "followUpReminderSentFor" DATETIME;

ALTER TABLE "TeamMember" ADD COLUMN "discordUserId" TEXT;

CREATE INDEX "Supplier_supplierOwnerId_idx" ON "Supplier"("supplierOwnerId");

UPDATE "TeamMember"
SET "name" = 'Ben', "initials" = 'B'
WHERE "id" = 'seat_1';

UPDATE "TeamMember"
SET "name" = 'Bennett', "initials" = 'BE'
WHERE "id" = 'seat_2';

UPDATE "TeamMember"
SET "name" = 'Pablo', "initials" = 'P'
WHERE "id" = 'seat_3';

-- The existing sheet is Ben's supplier bench; future records choose a profile.
UPDATE "Supplier"
SET "supplierOwnerId" = 'seat_1'
WHERE "type" = 'supplier' AND "supplierOwnerId" IS NULL;
