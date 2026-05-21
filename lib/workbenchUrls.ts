const DEFAULT_WORKBENCH_BASE_URL = "https://pw.theclingans.com";

export function getWorkbenchBaseUrl(): string {
  const raw = process.env.WORKBENCH_BASE_URL ?? DEFAULT_WORKBENCH_BASE_URL;
  return raw.replace(/\/$/, "");
}

export function projectTabUrl(slug: string, tab: string): string {
  return `${getWorkbenchBaseUrl()}/projects/${slug}?tab=${tab}`;
}

export function projectResourcingUrl(slug: string): string {
  return projectTabUrl(slug, "resourcing");
}

export function projectStatusReportsUrl(slug: string): string {
  return projectTabUrl(slug, "status-reports");
}
