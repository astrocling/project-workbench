import type { PrismaClient } from "@prisma/client";
import { floatClientFromEnv } from "@/lib/float/client";
import { normalizeProjectNameForLookup } from "@/lib/floatImportUtils";

/**
 * Link a Workbench project to Float `project_id` when the Float project name matches uniquely.
 * Returns the linked id string, or null when ambiguous / unavailable.
 */
export async function linkProjectFloatExternalId(
  prisma: PrismaClient,
  projectId: string,
  floatProjectName: string
): Promise<string | null> {
  const norm = normalizeProjectNameForLookup(floatProjectName);
  if (!norm) return null;

  try {
    const client = floatClientFromEnv();
    const floatProjects = await client.listAllPages<{ project_id: number; name: string }>(
      "/v3/projects"
    );
    const matches = floatProjects.filter(
      (fp) => normalizeProjectNameForLookup(fp.name ?? "") === norm
    );
    if (matches.length !== 1) return null;

    const fid = String(matches[0]!.project_id);
    const taken = await prisma.project.findUnique({
      where: { floatExternalId: fid },
      select: { id: true },
    });
    if (taken && taken.id !== projectId) return null;

    await prisma.project.update({
      where: { id: projectId },
      data: { floatExternalId: fid },
    });
    return fid;
  } catch {
    return null;
  }
}
