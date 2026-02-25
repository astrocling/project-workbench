/**
 * Backfill Project.slug for existing rows. Run after add_project_slug migration.
 * Requires DATABASE_URL (e.g. from .env).
 * Usage: npx tsx scripts/backfill-project-slugs.ts
 */
import { prisma } from "../lib/prisma";
import { slugify, ensureUniqueSlug } from "../lib/slug";

async function main() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, slug: true },
  });

  const existingSlugs = new Set<string>();
  for (const p of projects) {
    if (p.slug) existingSlugs.add(p.slug);
  }

  for (const p of projects) {
    if (p.slug) continue;
    const base = slugify(p.name);
    const slug = ensureUniqueSlug(base, existingSlugs);
    existingSlugs.add(slug);
    await prisma.project.update({
      where: { id: p.id },
      data: { slug },
    });
    console.log(`Updated ${p.id}: "${p.name}" -> ${slug}`);
  }

  console.log("Backfill complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
