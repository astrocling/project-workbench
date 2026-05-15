import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PermissionLevel, UserPositionRole } from "@prisma/client";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { applyUserPersonLinkInTransaction } from "@/lib/userPersonLink";
import bcrypt from "bcryptjs";
import { z } from "zod";

const POSITION_ROLES = ["ProjectManager", "ProgramManager", "ClientAccountDirector"] as const;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      permissions: true,
      role: true,
      slackUserId: true,
      industryGroupId: true,
      industryGroup: { select: { id: true, name: true, archivedAt: true } },
      createdAt: true,
      person: { select: { id: true } },
    },
    orderBy: { email: "asc" },
  });
  return NextResponse.json(
    users.map(({ person, industryGroup, ...u }) => ({
      ...u,
      personId: person?.id ?? null,
      industryGroup: industryGroup ?? null,
    }))
  );
}

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  permissions: z.enum(["Admin", "User"]),
  role: z.enum(POSITION_ROLES).optional(),
  slackUserId: z.string().nullable().optional(),
  personId: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const wantsSlack = Object.prototype.hasOwnProperty.call(body as object, "slackUserId");
  let slackUserIdForCreate: string | null | undefined;
  if (wantsSlack) {
    slackUserIdForCreate =
      parsed.data.slackUserId == null ? null : String(parsed.data.slackUserId).trim() || null;
  }

  const wantsPerson = Object.prototype.hasOwnProperty.call(body as object, "personId");
  const trimmedPersonId =
    wantsPerson && parsed.data.personId != null && String(parsed.data.personId).trim() !== ""
      ? String(parsed.data.personId).trim()
      : null;

  if (trimmedPersonId) {
    const target = await prisma.person.findUnique({
      where: { id: trimmedPersonId },
      select: { id: true },
    });
    if (!target) {
      return NextResponse.json({ error: "Person not found" }, { status: 400 });
    }
  }

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: parsed.data.email,
        passwordHash,
        firstName: parsed.data.firstName ?? null,
        lastName: parsed.data.lastName ?? null,
        permissions: parsed.data.permissions === "Admin" ? PermissionLevel.Admin : PermissionLevel.User,
        role: parsed.data.role ? (parsed.data.role as UserPositionRole) : null,
        ...(slackUserIdForCreate !== undefined ? { slackUserId: slackUserIdForCreate } : {}),
      },
      select: { id: true },
    });
    if (trimmedPersonId) {
      await applyUserPersonLinkInTransaction(tx, created.id, trimmedPersonId);
    }
    return tx.user.findUnique({
      where: { id: created.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        permissions: true,
        role: true,
        slackUserId: true,
        industryGroupId: true,
        industryGroup: { select: { id: true, name: true, archivedAt: true } },
        createdAt: true,
        person: { select: { id: true } },
      },
    });
  });

  if (!user) {
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }

  const { person, industryGroup, ...rest } = user;
  return NextResponse.json({
    ...rest,
    personId: person?.id ?? null,
    industryGroup: industryGroup ?? null,
  });
}
