-- CreateTable
CREATE TABLE "ActualHoursMonthSplit" (
    "projectId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "weekStartDate" DATE NOT NULL,
    "monthKey" TEXT NOT NULL,
    "hours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActualHoursMonthSplit_pkey" PRIMARY KEY ("projectId","personId","weekStartDate","monthKey")
);

-- CreateIndex
CREATE INDEX "ActualHoursMonthSplit_projectId_idx" ON "ActualHoursMonthSplit"("projectId");

-- AddForeignKey
ALTER TABLE "ActualHoursMonthSplit" ADD CONSTRAINT "ActualHoursMonthSplit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualHoursMonthSplit" ADD CONSTRAINT "ActualHoursMonthSplit_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
