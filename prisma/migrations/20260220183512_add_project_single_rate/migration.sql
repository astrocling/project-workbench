-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "singleBillRate" DECIMAL(10,2),
ADD COLUMN     "useSingleRate" BOOLEAN NOT NULL DEFAULT false;
