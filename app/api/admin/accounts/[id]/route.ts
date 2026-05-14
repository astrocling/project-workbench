import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { assertIndustryGroupAssignable } from "@/lib/industryGroupAssign";
import { z } from "zod";

const patchSchema = z.object({
  slackChannelId: z.string().optional().nullable(),
  industryGroupId: z.string().optional().nullable(),
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
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const existing = await prisma.account.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const { slackChannelId, industryGroupId } = parsed.data;
  const data: { slackChannelId?: string | null; industryGroupId?: string | null } = {};
  if (slackChannelId !== undefined) data.slackChannelId = slackChannelId ?? null;
  if (industryGroupId !== undefined) {
    const next = industryGroupId?.trim() || null;
    const check = await assertIndustryGroupAssignable(prisma, next, existing.industryGroupId);
    if (!check.ok) return NextResponse.json({ error: check.message }, { status: 400 });
    data.industryGroupId = next;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const account = await prisma.account.update({
    where: { id },
    data,
    include: {
      _count: { select: { projects: true } },
      industryGroup: { select: { id: true, name: true, archivedAt: true } },
    },
  });
  return NextResponse.json(account);
}
