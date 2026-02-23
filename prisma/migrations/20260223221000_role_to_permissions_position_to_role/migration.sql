-- CreateEnum
CREATE TYPE "PermissionLevel" AS ENUM ('User', 'Admin');

-- AlterTable: add permissions and backfill from role
ALTER TABLE "User" ADD COLUMN "permissions" "PermissionLevel";
UPDATE "User" SET "permissions" = "role"::text::"PermissionLevel";
ALTER TABLE "User" ALTER COLUMN "permissions" SET NOT NULL;

-- Add new role column (UserPositionRole), copy from positionRole
ALTER TABLE "User" ADD COLUMN "role_new" "UserPositionRole";
UPDATE "User" SET "role_new" = "positionRole";

-- Drop old columns
ALTER TABLE "User" DROP COLUMN "role";
ALTER TABLE "User" DROP COLUMN "positionRole";

-- Rename new role column
ALTER TABLE "User" RENAME COLUMN "role_new" TO "role";

-- Drop old enum
DROP TYPE "UserRole";
