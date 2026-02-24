-- AlterTable
ALTER TABLE "FloatImportRun" ADD COLUMN     "newPersonNames" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;
