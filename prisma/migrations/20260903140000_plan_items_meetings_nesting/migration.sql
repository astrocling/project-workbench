-- AlterEnum
ALTER TYPE "PlanItemType" ADD VALUE 'meeting';

-- AlterTable
ALTER TABLE "PlanItem" ADD COLUMN "parentItemId" TEXT,
ADD COLUMN "meetingStatus" "PlanMeetingStatus",
ADD COLUMN "scheduledTime" TEXT;

-- CreateIndex
CREATE INDEX "PlanItem_parentItemId_idx" ON "PlanItem"("parentItemId");

-- AddForeignKey
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_parentItemId_fkey" FOREIGN KEY ("parentItemId") REFERENCES "PlanItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropTable
DROP TABLE "PlanMeeting";
