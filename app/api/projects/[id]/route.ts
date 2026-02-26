import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { slugify, ensureUniqueSlug } from "@/lib/slug";
import { z } from "zod";

async function resolveProject(idOrSlug: string) {
  const project = await prisma.project.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
    include: {
      assignments: { include: { person: true, role: true } },
      projectRoleRates: { include: { role: true } },
      projectKeyRoles: { include: { person: true } },
    },
  });
  return project;
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  clientName: z.string().min(1).optional(),
  startDate: z.union([z.string(), z.date()]).optional(),
  endDate: z.union([z.string(), z.date()]).optional().nullable(),
  status: z.enum(["Active", "Closed"]).optional(),
  actualsLowThresholdPercent: z.number().min(0).max(100).nullable().optional(),
  actualsHighThresholdPercent: z.number().min(0).max(100).nullable().optional(),
  useSingleRate: z.boolean().optional(),
  singleBillRate: z.number().min(0).nullable().optional(),
  notes: z.string().nullable().optional(),
  sowLink: z.union([z.string(), z.null()]).optional(),
  estimateLink: z.union([z.string(), z.null()]).optional(),
  floatLink: z.union([z.string(), z.null()]).optional(),
  metricLink: z.union([z.string(), z.null()]).optional(),
  pmPersonIds: z.array(z.string()).optional(),
  pgmPersonId: z.string().optional().nullable(),
  cadPersonId: z.string().optional().nullable(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: idOrSlug } = await params;
  const project = await resolveProject(idOrSlug);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(project);
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
  const existing = await resolveProject(idOrSlug);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const id = existing.id;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.name != null) data.name = parsed.data.name;
  if (parsed.data.clientName != null) data.clientName = parsed.data.clientName;
  if (parsed.data.startDate != null) data.startDate = parsed.data.startDate instanceof Date ? parsed.data.startDate : new Date(parsed.data.startDate);
  if (parsed.data.endDate !== undefined) data.endDate = parsed.data.endDate ? (parsed.data.endDate instanceof Date ? parsed.data.endDate : new Date(parsed.data.endDate)) : null;
  if (parsed.data.status != null) data.status = parsed.data.status;
  if (parsed.data.actualsLowThresholdPercent !== undefined) data.actualsLowThresholdPercent = parsed.data.actualsLowThresholdPercent;
  if (parsed.data.actualsHighThresholdPercent !== undefined) data.actualsHighThresholdPercent = parsed.data.actualsHighThresholdPercent;
  if (parsed.data.useSingleRate !== undefined) data.useSingleRate = parsed.data.useSingleRate;
  if (parsed.data.singleBillRate !== undefined) data.singleBillRate = parsed.data.singleBillRate;
  if (parsed.data.useSingleRate === false) data.singleBillRate = null;
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;
  const normLink = (v: string | null | undefined): string | null => {
    if (v == null) return null;
    const raw = String(v).trim();
    if (!raw) return null;
    return raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
  };
  if (Object.prototype.hasOwnProperty.call(body, "sowLink")) {
    data.sowLink = normLink(parsed.data.sowLink ?? (body as { sowLink?: string | null }).sowLink);
  }
  if (Object.prototype.hasOwnProperty.call(body, "estimateLink")) {
    data.estimateLink = normLink(parsed.data.estimateLink ?? (body as { estimateLink?: string | null }).estimateLink);
  }
  if (Object.prototype.hasOwnProperty.call(body, "floatLink")) {
    data.floatLink = normLink(parsed.data.floatLink ?? (body as { floatLink?: string | null }).floatLink);
  }
  if (Object.prototype.hasOwnProperty.call(body, "metricLink")) {
    data.metricLink = normLink(parsed.data.metricLink ?? (body as { metricLink?: string | null }).metricLink);
  }

  // Regenerate slug when name changes
  if (parsed.data.name != null) {
    const existingSlugs = new Set(
      (await prisma.project.findMany({ where: { id: { not: id } }, select: { slug: true } })).map((p) => p.slug).filter(Boolean)
    );
    data.slug = ensureUniqueSlug(slugify(parsed.data.name), existingSlugs);
  }

  // Update project key roles (PM, PGM, CAD) if provided
  if (
    parsed.data.pmPersonIds !== undefined ||
    parsed.data.pgmPersonId !== undefined ||
    parsed.data.cadPersonId !== undefined
  ) {
    await prisma.projectKeyRole.deleteMany({ where: { projectId: id } });
    const pmIds = parsed.data.pmPersonIds ?? [];
    const pgmId = parsed.data.pgmPersonId ?? null;
    const cadId = parsed.data.cadPersonId ?? null;
    const keyRoleInserts: Array<{ projectId: string; personId: string; type: "PM" | "PGM" | "CAD" }> = [];
    for (const personId of pmIds) {
      if (personId) keyRoleInserts.push({ projectId: id, personId, type: "PM" });
    }
    if (pgmId) keyRoleInserts.push({ projectId: id, personId: pgmId, type: "PGM" });
    if (cadId) keyRoleInserts.push({ projectId: id, personId: cadId, type: "CAD" });
    for (const kr of keyRoleInserts) {
      await prisma.projectKeyRole.create({ data: kr });
    }
  }

  const project = await prisma.project.update({
    where: { id },
    data: data as Parameters<typeof prisma.project.update>[0]["data"],
    include: {
      assignments: { include: { person: true, role: true } },
      projectRoleRates: { include: { role: true } },
      projectKeyRoles: { include: { person: true } },
    },
  });
  return NextResponse.json(project);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissions = (session.user as { permissions?: string }).permissions;
  if (permissions !== "Admin") {
    return NextResponse.json({ error: "Forbidden: only super users can delete projects" }, { status: 403 });
  }

  const { id: idOrSlug } = await params;
  const project = await resolveProject(idOrSlug);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.project.delete({ where: { id: project.id } });
  return NextResponse.json({ ok: true });
}
