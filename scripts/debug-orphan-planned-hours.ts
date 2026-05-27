import "dotenv/config";
import { prisma } from "../lib/prisma";
import { getPreviousWeekRange } from "../lib/missingActuals";

async function main() {
  const { start } = getPreviousWeekRange();
  const week = new Date(start + "T00:00:00.000Z");

  type Row = { project_name: string; person_name: string; hours: number };

  const orphans = await prisma.$queryRaw<Row[]>`
    SELECT p.name as project_name, pe.name as person_name, ph.hours::float as hours
    FROM "PlannedHours" ph
    JOIN "Project" p ON p.id = ph."projectId"
    JOIN "Person" pe ON pe.id = ph."personId"
    LEFT JOIN "ProjectAssignment" pa ON pa."projectId" = ph."projectId" AND pa."personId" = ph."personId"
    WHERE ph."weekStartDate" = ${week}
      AND ph.hours > 0
      AND p.status = 'Active'
      AND pa."projectId" IS NULL
    ORDER BY p.name, pe.name
  `;

  console.log(`Orphan planned hours (${start}, no assignment): ${orphans.length}`);
  for (const r of orphans) {
    console.log(`  ${r.project_name} — ${r.person_name} (${r.hours}h)`);
  }

  const plannedNoFloat = await prisma.$queryRaw<Row[]>`
    SELECT p.name as project_name, pe.name as person_name, ph.hours::float as hours
    FROM "PlannedHours" ph
    JOIN "Project" p ON p.id = ph."projectId"
    JOIN "Person" pe ON pe.id = ph."personId"
    JOIN "ProjectAssignment" pa ON pa."projectId" = ph."projectId" AND pa."personId" = ph."personId"
    LEFT JOIN "FloatScheduledHours" fh
      ON fh."projectId" = ph."projectId"
      AND fh."personId" = ph."personId"
      AND fh."weekStartDate" = ph."weekStartDate"
    WHERE ph."weekStartDate" = ${week}
      AND ph.hours > 0
      AND p.status = 'Active'
      AND fh."projectId" IS NULL
    ORDER BY p.name, pe.name
  `;

  console.log(`\nAssigned but no Float row for week: ${plannedNoFloat.length}`);
  for (const r of plannedNoFloat) {
    console.log(`  ${r.project_name} — ${r.person_name} (${r.hours}h)`);
  }
}

main()
  .catch(console.error)
  .finally(async () => prisma.$disconnect());
