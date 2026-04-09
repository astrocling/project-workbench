-- Repair drift: ensure column exists if an environment skipped or partially applied the prior migration.
ALTER TABLE "ProjectAssignment" ADD COLUMN IF NOT EXISTS "syncRoleFromFloat" BOOLEAN NOT NULL DEFAULT true;
