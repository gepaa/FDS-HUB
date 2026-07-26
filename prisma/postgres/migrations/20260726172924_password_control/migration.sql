-- CreateTable
CREATE TABLE "Credential" (
    "id" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "label" TEXT,
    "username" TEXT,
    "secret" TEXT NOT NULL,
    "url" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Other',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CredentialReveal" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'you',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CredentialReveal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Credential_service_idx" ON "Credential"("service");

-- CreateIndex
CREATE INDEX "Credential_category_idx" ON "Credential"("category");

-- CreateIndex
CREATE INDEX "CredentialReveal_credentialId_createdAt_idx" ON "CredentialReveal"("credentialId", "createdAt");

-- AddForeignKey
ALTER TABLE "CredentialReveal" ADD CONSTRAINT "CredentialReveal_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "Credential"("id") ON DELETE CASCADE ON UPDATE CASCADE;
