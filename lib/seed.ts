import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

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

export async function runSeed(prisma: PrismaClient): Promise<{ roles: number; adminEmail: string }> {
  for (const name of CANONICAL_ROLES) {
    await prisma.role.upsert({
      where: { name },
      create: { name },
      update: {},
    });
  }

  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "changeme";
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    create: { email, passwordHash, permissions: "Admin" },
    update: { passwordHash },
  });

  return { roles: CANONICAL_ROLES.length, adminEmail: email };
}
