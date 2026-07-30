/**
 * Simulate GET /api/projects/[id]/resourcing float payload (no cache).
 * Usage: npx tsx scripts/debug-resourcing-payload.ts <projectIdOrSlug>
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { formatWeekKey, getWeekStartDate } from "../lib/weekUtils";

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
    console.error("Usage: npx tsx scripts/debug-resourcing-payload.ts <projectIdOrSlug>");
    process.exit(1);
  }

  const id = await resolveProjectId(idOrSlug);
  if (!id) {
    console.error("Project not found:", idOrSlug);
    process.exit(1);
  }

  const meta = await prisma.project.findUnique({
    where: { id },
    select: { startDate: true, endDate: true, name: true, slug: true },
  });
  if (!meta) process.exit(1);

  const projectStartWeek = getWeekStartDate(new Date(meta.startDate));
  const projectEndWeek = getWeekStartDate(new Date(meta.endDate ?? new Date()));
  const fromWeek = formatWeekKey(projectStartWeek);
  const toWeek = formatWeekKey(projectEndWeek);

  const from = new Date(fromWeek + "T00:00:00.000Z");
  const to = new Date(toWeek + "T00:00:00.000Z");

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      assignments: { select: { personId: true } },
    },
  });
  if (!project) process.exit(1);

  const assignmentPersonIds = new Set(project.assignments.map((a) => a.personId));

  const floatRows = await prisma.floatScheduledHours.findMany({
    where: { projectId: id, weekStartDate: { gte: from, lte: to } },
    select: { personId: true, weekStartDate: true, hours: true, person: { select: { name: true } } },
    orderBy: { weekStartDate: "asc" },
  });

  const floatHours = floatRows
    .filter((r) => assignmentPersonIds.has(r.personId))
    .map((r) => ({
      personId: r.personId,
      personName: r.person.name,
      weekStartDate: formatWeekKey(r.weekStartDate),
      hours: Number(r.hours),
    }));

  const byWeek = new Map<string, number>();
  for (const r of floatHours) {
    byWeek.set(r.weekStartDate, (byWeek.get(r.weekStartDate) ?? 0) + r.hours);
  }

  console.log("Project:", meta.name, meta.slug);
  console.log("Range:", fromWeek, "→", toWeek);
  console.log("floatHours rows (after assignment filter):", floatHours.length);
  console.log("\nWeekly totals (what API would return):");
  for (const [k, h] of [...byWeek.entries()].sort()) {
    console.log(`  ${k}  ${h}`);
  }

  const asOf = new Date();
  const futureWeeks = [...byWeek.entries()]
    .filter(([k]) => k > formatWeekKey(asOf).slice(0, 10))
    .sort();
  console.log("\nFuture weeks with data:", futureWeeks.length);
  if (futureWeeks.length === 0) console.log("  (none — this matches empty prod grid)");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
