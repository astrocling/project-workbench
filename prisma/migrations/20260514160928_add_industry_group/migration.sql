-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "industryGroupId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "industryGroupId" TEXT;

-- CreateTable
CREATE TABLE "IndustryGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndustryGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IndustryGroup_name_key" ON "IndustryGroup"("name");

-- CreateIndex
CREATE INDEX "Account_industryGroupId_idx" ON "Account"("industryGroupId");

-- CreateIndex
CREATE INDEX "User_industryGroupId_idx" ON "User"("industryGroupId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_industryGroupId_fkey" FOREIGN KEY ("industryGroupId") REFERENCES "IndustryGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_industryGroupId_fkey" FOREIGN KEY ("industryGroupId") REFERENCES "IndustryGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
