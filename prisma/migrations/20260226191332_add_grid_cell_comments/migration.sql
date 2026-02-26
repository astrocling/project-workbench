-- CreateEnum
CREATE TYPE "GridCommentType" AS ENUM ('Planned', 'Actual');

-- CreateTable
CREATE TABLE "GridCellComment" (
    "projectId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "weekStartDate" DATE NOT NULL,
    "gridType" "GridCommentType" NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GridCellComment_pkey" PRIMARY KEY ("projectId","personId","weekStartDate","gridType")
);

-- AddForeignKey
ALTER TABLE "GridCellComment" ADD CONSTRAINT "GridCellComment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GridCellComment" ADD CONSTRAINT "GridCellComment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
