import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAsOfDate } from "@/lib/weekUtils";

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      projectKeyRoles: { include: { person: true } },
    },
  });

  const lastImport = await prisma.floatImportRun.findFirst({
    orderBy: { completedAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold">Project Workbench</h1>
        <div className="flex gap-4 items-center">
          <span className="text-sm text-black">
            As-of: {getAsOfDate().toISOString().slice(0, 10)}
          </span>
          {(session.user as { role?: string })?.role === "Admin" && (
            <Link
              href="/admin/float-import"
              className="text-sm text-blue-600 hover:underline"
            >
              Admin
            </Link>
          )}
          <Link
            href="/api/auth/signout"
            className="text-sm text-blue-600 hover:underline"
          >
            Sign out
          </Link>
        </div>
      </header>

      <main className="p-6 max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-medium">Projects</h2>
          {(session.user as { role?: string })?.role !== "Viewer" && (
            <Link
              href="/projects/new"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              New Project
            </Link>
          )}
        </div>

        {lastImport && (
          <p className="text-sm text-black mb-4">
            Float last updated: {new Date(lastImport.completedAt).toLocaleString()}
          </p>
        )}

        <div className="bg-white rounded border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium">Client</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">PMs</th>
                <th className="text-left p-3 font-medium">PGM</th>
                <th className="text-left p-3 font-medium">CAD</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => {
                const pms = p.projectKeyRoles.filter((kr) => kr.type === "PM");
                const pgm = p.projectKeyRoles.find((kr) => kr.type === "PGM");
                const cad = p.projectKeyRoles.find((kr) => kr.type === "CAD");
                return (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">
                      <Link
                        href={`/projects/${p.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="p-3">{p.clientName}</td>
                    <td className="p-3">{p.status}</td>
                    <td className="p-3">
                      {pms.map((kr) => kr.person.name).join(", ") || "—"}
                    </td>
                    <td className="p-3">{pgm?.person.name ?? "—"}</td>
                    <td className="p-3">{cad?.person.name ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {projects.length === 0 && (
            <p className="p-8 text-center text-black">No projects yet.</p>
          )}
        </div>
      </main>
    </div>
  );
}
