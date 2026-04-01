import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = await prisma.project.findFirst({
    where: { OR: [{ slug }, { id: slug }] },
    select: { name: true },
  });
  if (!project) return { title: "Edit project" };
  return { title: `Edit: ${project.name}` };
}

export default function EditProjectLayout({ children }: { children: React.ReactNode }) {
  return children;
}
