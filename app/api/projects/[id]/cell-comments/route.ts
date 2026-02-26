import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { getProjectId } from "@/lib/slug";
import { z } from "zod";

const patchSchema = z.object({
  personId: z.string(),
  weekStartDate: z.string(),
  gridType: z.enum(["Planned", "Actual"]),
  comment: z.string(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idOrSlug } = await params;
  const id = await getProjectId(idOrSlug);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await prisma.gridCellComment.findMany({
    where: { projectId: id },
  });

  return NextResponse.json(
    rows.map((r) => ({
      projectId: r.projectId,
      personId: r.personId,
      weekStartDate: r.weekStartDate,
      gridType: r.gridType,
      comment: r.comment,
    }))
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin" && permissions !== "User") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: idOrSlug } = await params;
  const id = await getProjectId(idOrSlug);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { personId, weekStartDate, gridType, comment } = parsed.data;
  const weekStart = new Date(weekStartDate);
  const commentTrimmed = comment.trim();

  if (commentTrimmed === "") {
    await prisma.gridCellComment.deleteMany({
      where: {
        projectId: id,
        personId,
        weekStartDate: weekStart,
        gridType,
      },
    });
    return NextResponse.json({ projectId: id, personId, weekStartDate: weekStart, gridType, comment: "" });
  }

  const row = await prisma.gridCellComment.upsert({
    where: {
      projectId_personId_weekStartDate_gridType: {
        projectId: id,
        personId,
        weekStartDate: weekStart,
        gridType,
      },
    },
    create: {
      projectId: id,
      personId,
      weekStartDate: weekStart,
      gridType,
      comment: commentTrimmed,
    },
    update: { comment: commentTrimmed },
  });

  return NextResponse.json({
    projectId: row.projectId,
    personId: row.personId,
    weekStartDate: row.weekStartDate,
    gridType: row.gridType,
    comment: row.comment,
  });
}
