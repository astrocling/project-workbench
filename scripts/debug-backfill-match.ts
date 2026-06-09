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
  resolveFloatImportTargetProjectIds,
  type MergedFloatEntry,
} from "../lib/floatImportApply";
import { normalizeProjectNameForLookup } from "../lib/floatImportUtils";
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

  const duplicates = await prisma.project.findMany({
    where: { name: { equals: project.name, mode: "insensitive" } },
    select: { id: true, name: true, slug: true, floatExternalId: true },
  });
  if (duplicates.length > 1) {
    console.log("\nDuplicate Workbench names:", duplicates);
  }

  const allProjects = await prisma.project.findMany({
    select: { id: true, name: true, floatExternalId: true },
  });
  const projectsForResolution = allProjects.map((p) => ({
    id: p.id,
    name: p.name,
    floatExternalId: p.floatExternalId,
  }));
  const projectsByName = new Map(
    allProjects.map((p) => [p.name.toLowerCase(), p.id] as const)
  );
  const sampleEntry: MergedFloatEntry = {
    projectName: project.name,
    personName: "Sample",
    roleName: "",
    weekMap: new Map([["2026-06-15", 1]]),
    floatProjectId: project.floatExternalId
      ? Number(project.floatExternalId)
      : undefined,
  };
  console.log("\nNormalized name:", normalizeProjectNameForLookup(project.name));
  console.log(
    "Sync target project ids:",
    resolveFloatImportTargetProjectIds(sampleEntry, projectsByName, projectsForResolution)
  );

  const floatHourCount = await prisma.floatScheduledHours.count({
    where: { projectId: project.id },
  });
  const futureFloatHourCount = await prisma.floatScheduledHours.count({
    where: { projectId: project.id, weekStartDate: { gt: new Date() } },
  });
  const assignmentCount = await prisma.projectAssignment.count({
    where: { projectId: project.id },
  });
  console.log("\nDB state:", { floatHourCount, futureFloatHourCount, assignmentCount });

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
