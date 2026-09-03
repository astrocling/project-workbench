-- CreateEnum
CREATE TYPE "PlanReportDefault" AS ENUM ('timeline', 'plan');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "planEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "planReportDefault" "PlanReportDefault" NOT NULL DEFAULT 'timeline';
