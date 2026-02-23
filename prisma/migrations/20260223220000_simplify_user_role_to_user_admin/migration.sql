-- Simplify UserRole to User and Admin only (Editor, Viewer -> User)
-- PostgreSQL cannot drop enum values directly; rename old type, create new, migrate, drop old.

ALTER TYPE "UserRole" RENAME TO "UserRole_old";

CREATE TYPE "UserRole" AS ENUM ('User', 'Admin');

ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole" USING (
  CASE WHEN role::text = 'Admin' THEN 'Admin'::"UserRole" ELSE 'User'::"UserRole" END
);

DROP TYPE "UserRole_old";
