import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const email = process.argv[2] ?? "bruce.clingan@jakala.com";

async function main() {
  const user = await prisma.user.update({
    where: { email },
    data: { permissions: "Admin" },
  });
  console.log(`Updated ${user.email} to Super user (Admin).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
