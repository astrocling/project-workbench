/**
 * Local diagnostic: compare a Workbench project name against Float import history.
 *
 * Usage:
 *   npx tsx scripts/debug-backfill-match.ts <projectIdOrSlug> [--skip-backfill]
 *
 * Requires DATABASE_URL in .env (use production URL to mirror prod issue).
 */
import "dotenv/config";
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
async function resolveProjectId(idOrSlug: string): Promise<string | null> {
  const project = await prisma.project.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true },
  });
  return project?.id ?? null;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--skip-backfill");
  const skipBackfill = process.argv.includes("--skip-backfill");
  const idOrSlug = args[0];
  if (!idOrSlug) {
    console.error("Usage: npx tsx scripts/debug-backfill-match.ts <projectIdOrSlug>");
    process.exit(1);
  }

  const id = await resolveProjectId(idOrSlug);
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
  const floatApiEntry: MergedFloatEntry = {
    ...sampleEntry,
    floatProjectId: 10381784,
  };
  console.log("\nNormalized name:", normalizeProjectNameForLookup(project.name));
  console.log(
    "Sync target project ids (from project floatExternalId):",
    resolveFloatImportTargetProjectIds(sampleEntry, projectsByName, projectsForResolution)
  );
  console.log(
    "Sync target project ids (floatProjectId=10381784):",
    resolveFloatImportTargetProjectIds(floatApiEntry, projectsByName, projectsForResolution)
  );

  const asOf = new Date();
  const floatHourCount = await prisma.floatScheduledHours.count({
    where: { projectId: project.id },
  });
  const futureFloatHourCount = await prisma.floatScheduledHours.count({
    where: { projectId: project.id, weekStartDate: { gt: asOf } },
  });
  const assignmentCount = await prisma.projectAssignment.count({
    where: { projectId: project.id },
  });
  console.log("\nDB state:", { floatHourCount, futureFloatHourCount, assignmentCount });

  const assignments = await prisma.projectAssignment.findMany({
    where: { projectId: project.id },
    select: { personId: true, person: { select: { name: true } } },
  });
  const futureFloat = await prisma.floatScheduledHours.findMany({
    where: { projectId: project.id, weekStartDate: { gt: asOf } },
    select: { personId: true, person: { select: { name: true } } },
    distinct: ["personId"],
  });
  const assignIds = new Set(assignments.map((a) => a.personId));
  const visibleFuturePeople = futureFloat.filter((r) => assignIds.has(r.personId));
  const hiddenFuturePeople = futureFloat.filter((r) => !assignIds.has(r.personId));
  console.log("\nUI visibility (future float ∩ assignments):", {
    futureFloatPeople: futureFloat.length,
    visibleInUi: visibleFuturePeople.length,
    hiddenNotAssigned: [...new Set(hiddenFuturePeople.map((r) => r.person.name))],
  });

  if (duplicates.length > 1) {
    for (const dup of duplicates) {
      if (dup.id === project.id) continue;
      const dupFuture = await prisma.floatScheduledHours.count({
        where: { projectId: dup.id, weekStartDate: { gt: asOf } },
      });
      console.log(`Duplicate ${dup.slug} futureFloatHourCount:`, dupFuture);
    }
  }

  const latestRun = await prisma.floatImportRun.findFirst({
    orderBy: { completedAt: "desc" },
    select: { completedAt: true },
  });
  console.log("\nLatest FloatImportRun completedAt:", latestRun?.completedAt ?? null);

  if (skipBackfill) {
    console.log("\n(--skip-backfill: skipping Float API link + backfill dry-run)");
    await prisma.$disconnect();
    return;
  }

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
