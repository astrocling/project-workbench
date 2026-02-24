import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const people = await prisma.person.findMany({
    orderBy: { name: "asc" },
  });
  const lastImport = await prisma.floatImportRun.findFirst({
    orderBy: { completedAt: "desc" },
  });
  const newPersonNames = (lastImport?.newPersonNames as string[]) ?? [];
  return NextResponse.json({ people, newPersonNames });
}

const addSchema = z.object({
  name: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const name = parsed.data.name.trim();
  let person = await prisma.person.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (!person) {
    person = await prisma.person.create({
      data: { name },
    });
  }
  return NextResponse.json(person);
}

const patchSchema = z.object({
  personId: z.string().min(1),
  active: z.boolean(),
});

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const person = await prisma.person.update({
    where: { id: parsed.data.personId },
    data: { active: parsed.data.active },
  });
  return NextResponse.json(person);
}
