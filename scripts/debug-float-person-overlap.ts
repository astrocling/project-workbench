/**
 * Compare FloatScheduledHours personIds vs ProjectAssignment for a project.
 * Usage: npx tsx scripts/debug-float-person-overlap.ts <projectIdOrSlug>
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import {
  resolveFloatImportTargetProjectIds,
  type MergedFloatEntry,
} from "../lib/floatImportApply";

async function resolveProjectId(idOrSlug: string): Promise<string | null> {
  const project = await prisma.project.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true },
  });
  return project?.id ?? null;
}

async function main() {
  const idOrSlug = process.argv[2];
  if (!idOrSlug) {
    console.error("Usage: npx tsx scripts/debug-float-person-overlap.ts <projectIdOrSlug>");
    process.exit(1);
  }

  const id = await resolveProjectId(idOrSlug);
  if (!id) {
    console.error("Project not found:", idOrSlug);
    process.exit(1);
  }

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true, floatExternalId: true, endDate: true },
  });
  if (!project) process.exit(1);

  const asOf = new Date();
  const assignments = await prisma.projectAssignment.findMany({
    where: { projectId: id },
    select: { personId: true, person: { select: { name: true } } },
  });
  const futureFloat = await prisma.floatScheduledHours.findMany({
    where: { projectId: id, weekStartDate: { gt: asOf } },
    select: { personId: true, person: { select: { name: true } }, hours: true, weekStartDate: true },
  });

  const assignIds = new Set(assignments.map((a) => a.personId));
  const floatPersonIds = new Set(futureFloat.map((r) => r.personId));
  const visibleFuture = futureFloat.filter((r) => assignIds.has(r.personId));
  const hiddenFuture = futureFloat.filter((r) => !assignIds.has(r.personId));

  const allProjects = await prisma.project.findMany({
    select: { id: true, name: true, floatExternalId: true },
  });
  const projectsByName = new Map(
    allProjects.map((p) => [p.name.toLowerCase(), p.id] as const)
  );
  const entryWithFloatId: MergedFloatEntry = {
    projectName: project.name,
    personName: "Sample",
    roleName: "",
    weekMap: new Map([["2026-06-15", 1]]),
    floatProjectId: 10381784,
  };
  const syncTargets = resolveFloatImportTargetProjectIds(
    entryWithFloatId,
    projectsByName,
    allProjects
  );

  const duplicates = await prisma.project.findMany({
    where: { name: { equals: project.name, mode: "insensitive" } },
    select: { id: true, slug: true, floatExternalId: true },
  });

  const latestRun = await prisma.floatImportRun.findFirst({
    orderBy: { completedAt: "desc" },
    select: { id: true, completedAt: true },
  });

  console.log("Project:", project);
  console.log("Duplicates:", duplicates);
  console.log("Sync targets (floatProjectId=10381784):", syncTargets);
  console.log("Assignments:", assignments.map((a) => a.person.name));
  console.log("Future float rows:", futureFloat.length);
  console.log("Visible in UI (assigned):", visibleFuture.length);
  console.log("Hidden (float person not assigned):", [
    ...new Set(hiddenFuture.map((r) => r.person.name)),
  ]);
  console.log("Assigned but no future float:", assignments
    .filter((a) => !floatPersonIds.has(a.personId))
    .map((a) => a.person.name));
  console.log("Latest FloatImportRun:", latestRun);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
