-- CreateEnum
CREATE TYPE "RagStatus" AS ENUM ('Red', 'Amber', 'Green');

-- AlterTable
ALTER TABLE "StatusReport" ADD COLUMN     "ragBudget" "RagStatus",
ADD COLUMN     "ragBudgetExplanation" TEXT,
ADD COLUMN     "ragOverall" "RagStatus",
ADD COLUMN     "ragOverallExplanation" TEXT,
ADD COLUMN     "ragSchedule" "RagStatus",
ADD COLUMN     "ragScheduleExplanation" TEXT,
ADD COLUMN     "ragScope" "RagStatus",
ADD COLUMN     "ragScopeExplanation" TEXT;
