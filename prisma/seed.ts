import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const CANONICAL_ROLES = [
  "Analytics Engineer",
  "Analytics Strategist",
  "BE Developer",
  "Content Designer",
  "Content Manager",
  "Copywriter",
  "CX Lead",
  "Designer",
  "Director",
  "FE Developer",
  "Group Architect",
  "Lead Developer",
  "Program Manager",
  "Project Manager",
  "QA Engineer",
  "Researcher",
  "Senior BE Developer",
  "Senior FE Developer",
  "Solutions Analyst",
  "Solutions Architect",
  "Solutions Consultant",
  "Solutions Engineer",
  "Systems Admin",
  "Technical Architect",
  "UX Lead",
  "Video Editor",
];

async function main() {
  for (const name of CANONICAL_ROLES) {
    await prisma.role.upsert({
      where: { name },
      create: { name },
      update: {},
    });
  }
  console.log(`Seeded ${CANONICAL_ROLES.length} roles.`);

  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "changeme";
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    create: { email, passwordHash, role: "Admin" },
    update: { passwordHash },
  });
  console.log(`Seeded admin user: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
