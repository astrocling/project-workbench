import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PermissionLevel, UserPositionRole } from "@prisma/client";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
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
      createdAt: true,
    },
    orderBy: { email: "asc" },
  });
  return NextResponse.json(users);
}

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  permissions: z.enum(["Admin", "User"]),
  role: z.enum(POSITION_ROLES).optional(),
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
  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      passwordHash,
      firstName: parsed.data.firstName ?? null,
      lastName: parsed.data.lastName ?? null,
      permissions: parsed.data.permissions === "Admin" ? PermissionLevel.Admin : PermissionLevel.User,
      role: parsed.data.role ? (parsed.data.role as UserPositionRole) : null,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      permissions: true,
      role: true,
      createdAt: true,
    },
  });
  return NextResponse.json(user);
}
