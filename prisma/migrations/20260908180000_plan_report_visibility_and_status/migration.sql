-- CreateEnum
CREATE TYPE "PlanItemStatus" AS ENUM ('not_started', 'in_progress', 'complete');

-- AlterTable
ALTER TABLE "PlanPhase" ADD COLUMN "showOnReports" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PlanPhase" ADD COLUMN "reportLabel" TEXT;

-- AlterTable
ALTER TABLE "PlanItem" ADD COLUMN "showOnReports" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlanItem" ADD COLUMN "reportLabel" TEXT;
ALTER TABLE "PlanItem" ADD COLUMN "status" "PlanItemStatus" NOT NULL DEFAULT 'not_started';
ALTER TABLE "PlanItem" ADD COLUMN "completedAt" TIMESTAMP(3);

-- Backfill: key dates and scheduled meetings appear on status-report schedules by default
UPDATE "PlanItem"
SET "showOnReports" = true
WHERE type IN ('milestone', 'sign_off', 'hard_deadline')
   OR (type = 'meeting' AND "meetingStatus" = 'scheduled');
