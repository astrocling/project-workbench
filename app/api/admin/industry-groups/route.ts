import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const postSchema = z.object({
  name: z.string().min(1).max(200),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const groups = await prisma.industryGroup.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { accounts: true, users: true } },
    },
  });
  return NextResponse.json(groups);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body: unknown = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const name = parsed.data.name.trim();
  try {
    const group = await prisma.industryGroup.create({
      data: { name },
      include: { _count: { select: { accounts: true, users: true } } },
    });
    return NextResponse.json(group);
  } catch {
    return NextResponse.json({ error: "A group with this name already exists" }, { status: 400 });
  }
}
