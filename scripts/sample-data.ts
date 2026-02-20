/**
 * Optional script to create sample data for testing.
 * Run: npx tsx scripts/sample-data.ts
 * Requires database to be migrated and seeded first.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "Admin" } });
  if (!admin) {
    console.error("Run prisma db seed first to create admin user.");
    process.exit(1);
  }

  const roles = await prisma.role.findMany();
  const pmRole = roles.find((r) => r.name === "Project Manager");
  const devRole = roles.find((r) => r.name === "FE Developer");
  if (!pmRole || !devRole) {
    console.error("Roles not found. Run seed first.");
    process.exit(1);
  }

  const jane =
    (await prisma.person.findFirst({ where: { name: "Jane Doe" } })) ??
    (await prisma.person.create({ data: { name: "Jane Doe", email: "jane@example.com" } }));
  const john =
    (await prisma.person.findFirst({ where: { name: "John Smith" } })) ??
    (await prisma.person.create({ data: { name: "John Smith", email: "john@example.com" } }));
  const people = [jane, john];

  const project = await prisma.project.create({
    data: {
      name: "Sample Project",
      clientName: "Sample Client",
      startDate: new Date("2025-02-03"),
      endDate: new Date("2025-03-31"),
      status: "Active",
    },
  });

  await prisma.projectAssignment.createMany({
    data: [
      { projectId: project.id, personId: people[0].id, roleId: pmRole.id },
      { projectId: project.id, personId: people[1].id, roleId: devRole.id },
    ],
  });

  await prisma.projectRoleRate.upsert({
    where: {
      projectId_roleId: { projectId: project.id, roleId: pmRole.id },
    },
    create: { projectId: project.id, roleId: pmRole.id, billRate: 175 },
    update: {},
  });
  await prisma.projectRoleRate.upsert({
    where: {
      projectId_roleId: { projectId: project.id, roleId: devRole.id },
    },
    create: { projectId: project.id, roleId: devRole.id, billRate: 150 },
    update: {},
  });

  const weeks = [
    new Date("2025-02-03"),
    new Date("2025-02-10"),
  ];
  for (const week of weeks) {
    for (const person of people) {
      await prisma.plannedHours.upsert({
        where: {
          projectId_personId_weekStartDate: {
            projectId: project.id,
            personId: person.id,
            weekStartDate: week,
          },
        },
        create: {
          projectId: project.id,
          personId: person.id,
          weekStartDate: week,
          hours: 40,
        },
        update: {},
      });
      await prisma.actualHours.upsert({
        where: {
          projectId_personId_weekStartDate: {
            projectId: project.id,
            personId: person.id,
            weekStartDate: week,
          },
        },
        create: {
          projectId: project.id,
          personId: person.id,
          weekStartDate: week,
          hours: 38,
        },
        update: {},
      });
    }
  }

  await prisma.budgetLine.create({
    data: {
      projectId: project.id,
      type: "SOW",
      label: "Main SOW",
      lowHours: 160,
      highHours: 200,
      lowDollars: 24000,
      highDollars: 30000,
    },
  });

  console.log("Sample data created. Project ID:", project.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
