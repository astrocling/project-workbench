import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dateString, requireSession, resolveProjectId } from "@/lib/plan/api";
import { getProjectNonWorkingDays } from "@/lib/plan/projectNonWorkingDays";
import { z } from "zod";

const querySchema = z.object({
  from: dateString,
  to: dateString,
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const { id: idOrSlug } = await params;
  const projectResult = await resolveProjectId(idOrSlug);
  if ("error" in projectResult) return projectResult.error;

  const project = await prisma.project.findUnique({
    where: { id: projectResult.id },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = querySchema.safeParse({
    from: req.nextUrl.searchParams.get("from") ?? undefined,
    to: req.nextUrl.searchParams.get("to") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const nonWorking = await getProjectNonWorkingDays(
    prisma,
    projectResult.id,
    parsed.data.from,
    parsed.data.to
  );

  return NextResponse.json({
    nonWorkingDays: [...nonWorking].sort(),
  });
}
