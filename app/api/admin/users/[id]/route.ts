import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PermissionLevel, UserPositionRole } from "@prisma/client";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const POSITION_ROLES = ["ProjectManager", "ProgramManager", "ClientAccountDirector"] as const;

const updateSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  permissions: z.enum(["Admin", "User"]).optional(),
  role: z.enum(POSITION_ROLES).optional().nullable(),
  password: z.string().min(6).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const currentUserId = (session.user as { id?: string }).id;
  const isSelf = currentUserId && id === currentUserId;

  if (parsed.data.permissions !== undefined) {
    const newLevel = parsed.data.permissions === "Admin" ? PermissionLevel.Admin : PermissionLevel.User;
    if (isSelf && newLevel === PermissionLevel.User) {
      return NextResponse.json(
        { error: "Cannot demote yourself. Ask another admin to change your role." },
        { status: 400 }
      );
    }
    if (newLevel === PermissionLevel.User && existing.permissions === PermissionLevel.Admin) {
      const otherAdmins = await prisma.user.count({
        where: { permissions: PermissionLevel.Admin, id: { not: id } },
      });
      if (otherAdmins === 0) {
        return NextResponse.json(
          { error: "Cannot remove the last admin. Promote another user to Admin first." },
          { status: 400 }
        );
      }
    }
  }

  const data: {
    firstName?: string | null;
    lastName?: string | null;
    permissions?: PermissionLevel;
    role?: UserPositionRole | null;
    passwordHash?: string;
  } = {};

  if (parsed.data.firstName !== undefined) data.firstName = parsed.data.firstName || null;
  if (parsed.data.lastName !== undefined) data.lastName = parsed.data.lastName || null;
  if (parsed.data.permissions !== undefined) {
    data.permissions = parsed.data.permissions === "Admin" ? PermissionLevel.Admin : PermissionLevel.User;
  }
  if (Object.prototype.hasOwnProperty.call(parsed.data, "role")) {
    data.role = parsed.data.role ?? null;
  }
  if (parsed.data.password?.trim()) {
    data.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id },
    data,
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
