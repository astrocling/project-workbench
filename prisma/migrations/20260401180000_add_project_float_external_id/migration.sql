-- AlterTable
ALTER TABLE "Project" ADD COLUMN "floatExternalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Project_floatExternalId_key" ON "Project"("floatExternalId");
