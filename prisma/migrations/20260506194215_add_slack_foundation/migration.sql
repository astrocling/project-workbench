-- CreateEnum
CREATE TYPE "ResourcingRequestStatus" AS ENUM ('OPEN', 'FILLED', 'VARIANCE_FLAGGED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "accountId" TEXT,
ADD COLUMN     "slackChannelId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "slackUserId" TEXT;

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "floatClientId" INTEGER,
    "slackChannelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "resourcingChannelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourcingRequest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "note" TEXT,
    "requestedPeople" JSONB NOT NULL,
    "slackMessageTs" TEXT,
    "slackChannelId" TEXT,
    "status" "ResourcingRequestStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,

    CONSTRAINT "ResourcingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_name_key" ON "Account"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Account_floatClientId_key" ON "Account"("floatClientId");

-- CreateIndex
CREATE INDEX "ResourcingRequest_projectId_idx" ON "ResourcingRequest"("projectId");

-- CreateIndex
CREATE INDEX "ResourcingRequest_requestedById_idx" ON "ResourcingRequest"("requestedById");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourcingRequest" ADD CONSTRAINT "ResourcingRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourcingRequest" ADD CONSTRAINT "ResourcingRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourcingRequest" ADD CONSTRAINT "ResourcingRequest_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill Account from distinct Project.clientName; attach projects by client name match
INSERT INTO "Account" (id, name, "floatClientId", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  "clientName",
  NULL,
  NOW(),
  NOW()
FROM "Project"
WHERE "clientName" IS NOT NULL AND "clientName" != ''
GROUP BY "clientName"
ON CONFLICT (name) DO NOTHING;

UPDATE "Project" p
SET "accountId" = a.id
FROM "Account" a
WHERE p."clientName" = a.name
  AND p."accountId" IS NULL;
