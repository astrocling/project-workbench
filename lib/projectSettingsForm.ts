/**
 * Pure mapping between a project record (server props or `GET /api/projects/[id]`) and the
 * Project Settings form fields, and from those fields to the `PATCH /api/projects/[id]` payload.
 * One shared mapping lets the client recognize a payload that merely mirrors freshly hydrated
 * server props, instead of auto-saving it back.
 */

export type ProjectSettingsSource = {
  id?: string;
  name?: string;
  clientName?: string;
  startDate?: string;
  endDate?: string | null;
  status?: string;
  cdaEnabled?: boolean;
  planEnabled?: boolean;
  actualsLowThresholdPercent?: number | null;
  actualsHighThresholdPercent?: number | null;
  clientSponsor?: string | null;
  clientSponsor2?: string | null;
  otherContact?: string | null;
  keyStaffName?: string | null;
  sowLink?: string | null;
  estimateLink?: string | null;
  floatLink?: string | null;
  metricLink?: string | null;
  slackChannelId?: string | null;
  projectKeyRoles?: Array<{ type: string; personId: string; person: { id: string; name: string } }>;
  accountId?: string | null;
  account?: {
    id?: string;
    industryGroup?: { id: string; name: string; archivedAt?: string | Date | null } | null;
  } | null;
  clientIndustryGroup?: { id: string; name: string; archivedAt: string | null } | null;
};

export type ProjectSettingsFormFields = {
  name: string;
  clientName: string;
  /** YYYY-MM-DD, as held by the date inputs */
  startDate: string;
  /** YYYY-MM-DD, empty when unset */
  endDate: string;
  status: "Active" | "Closed";
  cdaEnabled: boolean;
  planEnabled: boolean;
  actualsLowThresholdPercent: string;
  actualsHighThresholdPercent: string;
  pmPersonIds: string[];
  pgmPersonId: string;
  cadPersonId: string;
  clientSponsor: string;
  clientSponsor2: string;
  otherContact: string;
  keyStaffName: string;
  sowLink: string;
  estimateLink: string;
  floatLink: string;
  metricLink: string;
  slackChannelId: string;
};

export type ProjectSettingsPayload = {
  name: string;
  clientName: string;
  startDate: string;
  endDate: string | null;
  status: "Active" | "Closed";
  cdaEnabled: boolean;
  planEnabled?: boolean;
  pmPersonIds: string[];
  pgmPersonId: string | null;
  cadPersonId: string | null;
  clientSponsor: string | null;
  clientSponsor2: string | null;
  otherContact: string | null;
  keyStaffName: string | null;
  actualsLowThresholdPercent: number | null;
  actualsHighThresholdPercent: number | null;
  sowLink: string | null;
  estimateLink: string | null;
  floatLink: string | null;
  metricLink: string | null;
  slackChannelId: string | null;
};

function toDateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function toPercent(value: string): number | null {
  if (value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

export function projectToSettingsFormFields(p: ProjectSettingsSource): ProjectSettingsFormFields {
  const keyRoles = p.projectKeyRoles ?? [];
  return {
    name: p.name ?? "",
    clientName: p.clientName ?? "",
    startDate: toDateInputValue(p.startDate),
    endDate: toDateInputValue(p.endDate),
    status: (p.status as "Active" | "Closed") ?? "Active",
    cdaEnabled: p.cdaEnabled ?? false,
    planEnabled: p.planEnabled ?? false,
    actualsLowThresholdPercent:
      p.actualsLowThresholdPercent != null ? String(p.actualsLowThresholdPercent) : "",
    actualsHighThresholdPercent:
      p.actualsHighThresholdPercent != null ? String(p.actualsHighThresholdPercent) : "",
    pmPersonIds: keyRoles.filter((kr) => kr.type === "PM").map((kr) => kr.personId),
    pgmPersonId: keyRoles.find((kr) => kr.type === "PGM")?.personId ?? "",
    cadPersonId: keyRoles.find((kr) => kr.type === "CAD")?.personId ?? "",
    clientSponsor: p.clientSponsor ?? "",
    clientSponsor2: p.clientSponsor2 ?? "",
    otherContact: p.otherContact ?? "",
    keyStaffName: p.keyStaffName ?? "",
    sowLink: p.sowLink ?? "",
    estimateLink: p.estimateLink ?? "",
    floatLink: p.floatLink ?? "",
    metricLink: p.metricLink ?? "",
    slackChannelId: p.slackChannelId ?? "",
  };
}

export function buildProjectSettingsPayload(
  fields: ProjectSettingsFormFields,
  { isAdmin }: { isAdmin: boolean }
): ProjectSettingsPayload {
  return {
    name: fields.name,
    clientName: fields.clientName,
    startDate: new Date(fields.startDate).toISOString(),
    endDate: fields.endDate ? new Date(fields.endDate).toISOString() : null,
    status: fields.status,
    cdaEnabled: fields.cdaEnabled,
    ...(isAdmin ? { planEnabled: fields.planEnabled } : {}),
    pmPersonIds: fields.pmPersonIds.filter(Boolean),
    pgmPersonId: fields.pgmPersonId || null,
    cadPersonId: fields.cadPersonId || null,
    clientSponsor: fields.clientSponsor.trim() || null,
    clientSponsor2: fields.clientSponsor2.trim() || null,
    otherContact: fields.otherContact.trim() || null,
    keyStaffName: fields.keyStaffName.trim() || null,
    actualsLowThresholdPercent: toPercent(fields.actualsLowThresholdPercent),
    actualsHighThresholdPercent: toPercent(fields.actualsHighThresholdPercent),
    sowLink: fields.sowLink.trim() || null,
    estimateLink: fields.estimateLink.trim() || null,
    floatLink: fields.floatLink.trim() || null,
    metricLink: fields.metricLink.trim() || null,
    slackChannelId: fields.slackChannelId.trim() || null,
  };
}

export type SettingsAutosaveAction = "idle" | "adopt-server-baseline" | "save";

/**
 * Decides what the settings autosave effect should do with the current form payload.
 * `adopt-server-baseline` means the payload only reflects values just hydrated from server
 * props, so it becomes the new baseline without being written back.
 */
export function resolveSettingsAutosaveAction({
  payload,
  lastSavedPayload,
  serverHydrationBaseline,
}: {
  payload: string;
  lastSavedPayload: string | null;
  serverHydrationBaseline: string | null;
}): SettingsAutosaveAction {
  if (payload === lastSavedPayload) return "idle";
  if (payload === serverHydrationBaseline) return "adopt-server-baseline";
  return "save";
}
