-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "floatLink" TEXT,
ADD COLUMN     "metricLink" TEXT,
ALTER COLUMN "slug" DROP DEFAULT;
