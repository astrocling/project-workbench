-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "cdaEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CdaMonth" (
    "projectId" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "planned" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "mtdActuals" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CdaMonth_pkey" PRIMARY KEY ("projectId","monthKey")
);

-- CreateIndex
CREATE INDEX "CdaMonth_projectId_idx" ON "CdaMonth"("projectId");

-- AddForeignKey
ALTER TABLE "CdaMonth" ADD CONSTRAINT "CdaMonth_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
