import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { EditProjectDataProvider } from "./EditProjectDataContext";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { name: true },
  });
  if (!project) return { title: "Edit project" };
  return { title: `Edit: ${project.name}` };
}

export default async function EditProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await prisma.project.findFirst({
    where: { OR: [{ slug }, { id: slug }] },
    include: {
      projectKeyRoles: { include: { person: true } },
    },
  });

  const initialProject = project
    ? {
        id: project.id,
        name: project.name,
        clientName: project.clientName,
        startDate: project.startDate.toISOString(),
        endDate: project.endDate?.toISOString() ?? null,
        status: project.status,
        cdaEnabled: project.cdaEnabled ?? false,
        actualsLowThresholdPercent: project.actualsLowThresholdPercent ?? null,
        actualsHighThresholdPercent: project.actualsHighThresholdPercent ?? null,
        clientSponsor: project.clientSponsor ?? null,
        clientSponsor2: project.clientSponsor2 ?? null,
        otherContact: project.otherContact ?? null,
        keyStaffName: project.keyStaffName ?? null,
        sowLink: project.sowLink ?? null,
        estimateLink: project.estimateLink ?? null,
        floatLink: project.floatLink ?? null,
        metricLink: project.metricLink ?? null,
        projectKeyRoles: project.projectKeyRoles.map((kr) => ({
          type: kr.type,
          personId: kr.personId,
          person: { id: kr.person.id, name: kr.person.name },
        })),
      }
    : null;

  return (
    <EditProjectDataProvider initialProject={initialProject} initialEligiblePeople={null}>
      {children}
    </EditProjectDataProvider>
  );
}
