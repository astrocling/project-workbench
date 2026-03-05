-- CreateTable
CREATE TABLE "CdaMilestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "devStartDate" DATE NOT NULL,
    "devEndDate" DATE NOT NULL,
    "uatStartDate" DATE NOT NULL,
    "uatEndDate" DATE NOT NULL,
    "deployDate" DATE NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CdaMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CdaMilestone_projectId_idx" ON "CdaMilestone"("projectId");

-- AddForeignKey
ALTER TABLE "CdaMilestone" ADD CONSTRAINT "CdaMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
