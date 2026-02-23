-- CreateEnum
CREATE TYPE "UserPositionRole" AS ENUM ('ProjectManager', 'ProgramManager', 'ClientAccountDirector');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "positionRole" "UserPositionRole";
