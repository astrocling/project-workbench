-- AlterTable
ALTER TABLE "TimelineMarker" ADD COLUMN     "rowIndex" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "shape" TEXT NOT NULL DEFAULT 'Diamond';
