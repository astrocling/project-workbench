-- CreateTable
CREATE TABLE "TimelineBar" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimelineBar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineMarker" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimelineMarker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimelineBar_projectId_idx" ON "TimelineBar"("projectId");

-- CreateIndex
CREATE INDEX "TimelineMarker_projectId_idx" ON "TimelineMarker"("projectId");

-- AddForeignKey
ALTER TABLE "TimelineBar" ADD CONSTRAINT "TimelineBar_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineMarker" ADD CONSTRAINT "TimelineMarker_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
