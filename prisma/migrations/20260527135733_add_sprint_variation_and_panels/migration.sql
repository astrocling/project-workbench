-- AlterEnum
ALTER TYPE "StatusReportVariation" ADD VALUE 'Sprint';

-- AlterTable
ALTER TABLE "StatusReport" ADD COLUMN     "panels" JSONB;
