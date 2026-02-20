import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getAsOfDate } from "@/lib/weekUtils";
import { ProjectDetailTabs } from "./ProjectDetailTabs";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { id } = await params;
  const { tab = "overview" } = await searchParams;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      assignments: { include: { person: true, role: true } },
      projectRoleRates: { include: { role: true } },
      projectKeyRoles: { include: { person: true } },
    },
  });

  if (!project) notFound();

  const lastImport = await prisma.floatImportRun.findFirst({
    orderBy: { completedAt: "desc" },
  });

  const canEdit = (session.user as { role?: string })?.role === "Admin" || (session.user as { role?: string })?.role === "Editor";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <div>
          <Link href="/projects" className="text-blue-600 hover:underline text-sm">
            ← Projects
          </Link>
          <h1 className="text-xl font-semibold mt-1">{project.name}</h1>
          <p className="text-sm text-black">{project.clientName} · {project.status}</p>
        </div>
        <div className="flex gap-4 items-center">
          <span className="text-sm text-black">
            As-of: {getAsOfDate().toISOString().slice(0, 10)}
          </span>
          {canEdit && (
            <Link
              href={`/projects/${id}/edit`}
              className="text-blue-600 hover:underline text-sm"
            >
              Edit
            </Link>
          )}
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto">
        <ProjectDetailTabs
          projectId={id}
          tab={tab}
          canEdit={!!canEdit}
          floatLastUpdated={lastImport?.completedAt ?? null}
        />
      </main>
    </div>
  );
}
