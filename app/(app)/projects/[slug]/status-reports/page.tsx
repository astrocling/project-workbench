import { redirect } from "next/navigation";

export default async function StatusReportsTabRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/projects/${slug}?tab=status-reports`);
}
