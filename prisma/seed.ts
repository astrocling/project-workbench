import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { normalizeDatabaseUrl } from "../lib/connection-string";
import { runSeed } from "../lib/seed";

const raw = process.env.DATABASE_URL;
if (!raw) throw new Error("DATABASE_URL is not set");
const connectionString = normalizeDatabaseUrl(raw);
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

runSeed(prisma)
  .then(({ roles, adminEmail }) => {
    console.log(`Seeded ${roles} roles.`);
    console.log(`Seeded admin user: ${adminEmail}`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
