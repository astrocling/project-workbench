-- Align updatedAt with Prisma @updatedAt (no database default; Prisma manages timestamps).
ALTER TABLE "PTOHolidayImpact" ALTER COLUMN "updatedAt" DROP DEFAULT;
