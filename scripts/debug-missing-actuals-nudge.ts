/**
 * Run missing-actuals nudge selection against the current DATABASE_URL and print results.
 * Also emits debug instrumentation logs from getMissingActualsProjects.
 *
 * Usage:
 *   npx tsx scripts/debug-missing-actuals-nudge.ts
 *   npx tsx scripts/debug-missing-actuals-nudge.ts --project=<projectIdOrSlug>
 *   npx tsx scripts/debug-missing-actuals-nudge.ts --project="Inperium - Apis Development"
 *
 * For names with spaces, quote the value. Do not rely on getProjectId (Next.js cache) in scripts.
 */

import "dotenv/config";

import { getMissingActualsProjects, getPreviousWeekRange } from "../lib/missingActuals";
import { slugify } from "../lib/slug";
import { prisma } from "../lib/prisma";

async function resolveProjectId(filter: string): Promise<string | null> {
  const trimmed = filter.trim();
  if (!trimmed) return null;

  const byIdOrSlug = await prisma.project.findFirst({
    where: { OR: [{ id: trimmed }, { slug: trimmed }] },
    select: { id: true },
  });
  if (byIdOrSlug) return byIdOrSlug.id;

  const byName = await prisma.project.findFirst({
    where: { name: { equals: trimmed, mode: "insensitive" } },
    select: { id: true },
  });
  if (byName) return byName.id;

  const slugCandidate = slugify(trimmed);
  const bySlugified = await prisma.project.findFirst({
    where: { slug: slugCandidate },
    select: { id: true },
  });
  return bySlugified?.id ?? null;
}

async function main() {
  const projectArg = process.argv.find((a) => a.startsWith("--project="));
  const projectFilter = projectArg ? projectArg.slice("--project=".length).trim() : null;

  const { start, end } = getPreviousWeekRange();
  console.log(`Prior UTC week: ${start} – ${end}`);

  let items = await getMissingActualsProjects();

  if (projectFilter) {
    const id = await resolveProjectId(projectFilter);
    if (!id) {
      console.error(`Project not found: ${projectFilter}`);
      console.error('Tip: quote names with spaces, e.g. --project="Inperium - Apis Development"');
      process.exit(1);
    }
    items = items.filter((i) => i.projectId === id);
  }

  if (items.length === 0) {
    console.log("No projects with missing actuals for the prior week.");
    return;
  }

  for (const item of items) {
    console.log(`\n${item.projectName} (${item.projectSlug})`);
    console.log(`  Week: ${item.weekLabel}`);
    console.log(`  Missing: ${item.missingPersonNames.join(", ")}`);
  }

  console.log(`\nTotal projects: ${items.length}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
