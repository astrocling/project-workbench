-- AlterTable (temporary default so NOT NULL works; backfill script overwrites with name-based slugs)
ALTER TABLE "Project" ADD COLUMN "slug" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");
