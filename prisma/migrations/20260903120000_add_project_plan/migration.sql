-- CreateEnum
CREATE TYPE "PlanItemType" AS ENUM ('task', 'milestone', 'sign_off', 'hard_deadline', 'waiting_on_client');

-- CreateEnum
CREATE TYPE "PlanMeetingStatus" AS ENUM ('assumed', 'scheduled');

-- CreateTable
CREATE TABLE "ProjectPlan" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kickoffDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "assumptions" TEXT[],
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanPhase" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanItem" (
    "id" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "type" "PlanItemType" NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanMeeting" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "PlanMeetingStatus" NOT NULL,
    "windowStart" DATE NOT NULL,
    "windowEnd" DATE NOT NULL,
    "scheduledDate" DATE,
    "scheduledTime" TEXT,
    "relatedPhaseId" TEXT,
    "relatedItemId" TEXT,
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectPlan_projectId_key" ON "ProjectPlan"("projectId");

-- CreateIndex
CREATE INDEX "ProjectPlan_projectId_idx" ON "ProjectPlan"("projectId");

-- CreateIndex
CREATE INDEX "PlanPhase_planId_idx" ON "PlanPhase"("planId");

-- CreateIndex
CREATE INDEX "PlanItem_phaseId_idx" ON "PlanItem"("phaseId");

-- CreateIndex
CREATE INDEX "PlanMeeting_planId_idx" ON "PlanMeeting"("planId");

-- AddForeignKey
ALTER TABLE "ProjectPlan" ADD CONSTRAINT "ProjectPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPlan" ADD CONSTRAINT "ProjectPlan_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanPhase" ADD CONSTRAINT "PlanPhase_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ProjectPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "PlanPhase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanMeeting" ADD CONSTRAINT "PlanMeeting_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ProjectPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
