-- CreateEnum
CREATE TYPE "StatusReportVariation" AS ENUM ('Standard', 'Milestones', 'CDA');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "clientSponsor" TEXT,
ADD COLUMN     "keyStaffName" TEXT,
ADD COLUMN     "otherContact" TEXT;

-- CreateTable
CREATE TABLE "StatusReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportDate" DATE NOT NULL,
    "variation" "StatusReportVariation" NOT NULL DEFAULT 'Standard',
    "completedActivities" TEXT NOT NULL,
    "upcomingActivities" TEXT NOT NULL,
    "risksIssuesDecisions" TEXT NOT NULL,
    "meetingNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatusReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StatusReport_projectId_idx" ON "StatusReport"("projectId");

-- CreateIndex
CREATE INDEX "StatusReport_projectId_reportDate_idx" ON "StatusReport"("projectId", "reportDate");

-- AddForeignKey
ALTER TABLE "StatusReport" ADD CONSTRAINT "StatusReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
