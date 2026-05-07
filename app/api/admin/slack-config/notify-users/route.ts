import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const postSchema = z.object({
  userId: z.string(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await prisma.resourcingNotifyUser.findMany({
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          slackUserId: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  try {
    const created = await prisma.resourcingNotifyUser.create({
      data: { userId: parsed.data.userId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            slackUserId: true,
          },
        },
      },
    });
    return NextResponse.json(created);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "User is already on the notify list" }, { status: 409 });
    }
    throw e;
  }
}
