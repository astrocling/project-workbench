-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "floatAccessLabel" TEXT,
ADD COLUMN     "floatDepartmentName" TEXT,
ADD COLUMN     "floatJobTitle" TEXT,
ADD COLUMN     "floatSchedulingActive" BOOLEAN,
ADD COLUMN     "floatTags" JSONB;
