/**
 * Local diagnostic: compare a Workbench project name against Float import history.
 *
 * Usage:
 *   npx tsx scripts/debug-backfill-match.ts <projectIdOrSlug>
 *
 * Requires DATABASE_URL in .env (use production URL to mirror prod issue).
 */
import { prisma } from "../lib/prisma";
import { linkProjectFloatExternalId } from "../lib/float/linkProjectFloatExternalId";
import {
  backfillFloatScheduledHoursForProjectStreaming,
  loadAvailableFloatProjectNamesWithHoursFromRuns,
  scoreCloseFloatProjectNames,
} from "../lib/backfillFloatFromImports";
import { getProjectId } from "../lib/slug";

async function main() {
  const idOrSlug = process.argv[2];
  if (!idOrSlug) {
    console.error("Usage: npx tsx scripts/debug-backfill-match.ts <projectIdOrSlug>");
    process.exit(1);
  }

  const id = await getProjectId(idOrSlug);
  if (!id) {
    console.error("Project not found:", idOrSlug);
    process.exit(1);
  }

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true, floatExternalId: true },
  });
  if (!project) {
    console.error("Project not found:", id);
    process.exit(1);
  }

  console.log("Project:", project);

  const linkedId = await linkProjectFloatExternalId(prisma, project.id, project.name);
  if (linkedId) {
    console.log("\nLinked floatExternalId:", linkedId);
  } else {
    console.log("\nCould not link floatExternalId (ambiguous name or API unavailable)");
  }

  const availableWithHours = await loadAvailableFloatProjectNamesWithHoursFromRuns(prisma);
  console.log("\nFloat names with stored hours:", availableWithHours.length);

  const scored = scoreCloseFloatProjectNames(project.name, availableWithHours).slice(0, 8);
  console.log("\nTop name matches:");
  for (const row of scored) {
    console.log(`  ${row.score}\t${row.name}`);
  }

  const auto = scored[0]?.name ?? null;
  console.log("\nBest suggestion (never auto-applied):", auto ?? "(none)");

  const dryRun = await backfillFloatScheduledHoursForProjectStreaming(prisma, {
    projectId: project.id,
    projectName: project.name,
  });
  console.log("\nBackfill dry-run (Workbench name):", {
    hadImportData: dryRun.hadImportData,
    upserted: dryRun.upserted,
    diagnostics: dryRun.diagnostics,
  });

  if (auto && !dryRun.hadImportData) {
    const retry = await backfillFloatScheduledHoursForProjectStreaming(prisma, {
      projectId: project.id,
      projectName: auto,
    });
    console.log("\nBackfill dry-run (auto Float name):", {
      floatName: auto,
      hadImportData: retry.hadImportData,
      upserted: retry.upserted,
      diagnostics: retry.diagnostics,
    });
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
