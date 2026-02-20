-- AlterTable
ALTER TABLE "FloatImportRun" ADD COLUMN     "projectAssignments" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "projectNames" JSONB NOT NULL DEFAULT '[]';
