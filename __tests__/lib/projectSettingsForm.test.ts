import { describe, expect, it } from "vitest";
import {
  buildProjectSettingsPayload,
  projectToSettingsFormFields,
  projectToSettingsPayload,
  resolveSettingsAutosave,
  type ProjectSettingsSource,
} from "@/lib/projectSettingsForm";

/**
 * Every settings field populated with a distinct non-default value, so a hydration step that
 * reads the wrong source key or drops a field changes the payload bytes below.
 */
const FULL_PROJECT: ProjectSettingsSource = {
  id: "cprojectid0000000000000001",
  name: "Apollo",
  clientName: "Acme",
  startDate: "2025-01-06T00:00:00.000Z",
  endDate: "2025-06-30T00:00:00.000Z",
  status: "Closed",
  cdaEnabled: true,
  planEnabled: true,
  actualsLowThresholdPercent: 12,
  actualsHighThresholdPercent: 7,
  clientSponsor: "Jane Doe",
  clientSponsor2: "John Roe",
  otherContact: "Ann Poe",
  keyStaffName: "Kay Staff",
  sowLink: "https://example.com/sow",
  estimateLink: "https://example.com/estimate",
  floatLink: "https://example.com/float",
  metricLink: "https://example.com/metric",
  slackChannelId: "C0123456789",
  projectKeyRoles: [
    { type: "PM", personId: "p1", person: { id: "p1", name: "PM One" } },
    { type: "PM", personId: "p2", person: { id: "p2", name: "PM Two" } },
    { type: "PGM", personId: "p3", person: { id: "p3", name: "PGM" } },
    { type: "CAD", personId: "p4", person: { id: "p4", name: "CAD" } },
  ],
  // Not part of the form fields or the payload; the component reads these directly.
  accountId: "caccountid000000000000001",
  account: {
    id: "caccountid000000000000001",
    industryGroup: { id: "cig000000000000000000001", name: "Retail", archivedAt: null },
  },
};

const ADMIN_PAYLOAD_JSON =
  '{"name":"Apollo","clientName":"Acme","startDate":"2025-01-06T00:00:00.000Z",' +
  '"endDate":"2025-06-30T00:00:00.000Z","status":"Closed","cdaEnabled":true,"planEnabled":true,' +
  '"pmPersonIds":["p1","p2"],"pgmPersonId":"p3","cadPersonId":"p4","clientSponsor":"Jane Doe",' +
  '"clientSponsor2":"John Roe","otherContact":"Ann Poe","keyStaffName":"Kay Staff",' +
  '"actualsLowThresholdPercent":12,"actualsHighThresholdPercent":7,' +
  '"sowLink":"https://example.com/sow","estimateLink":"https://example.com/estimate",' +
  '"floatLink":"https://example.com/float","metricLink":"https://example.com/metric",' +
  '"slackChannelId":"C0123456789"}';

const NON_ADMIN_PAYLOAD_JSON = ADMIN_PAYLOAD_JSON.replace('"planEnabled":true,', "");

describe("projectToSettingsFormFields", () => {
  it("maps every settings field a project carries", () => {
    expect(projectToSettingsFormFields(FULL_PROJECT)).toEqual({
      name: "Apollo",
      clientName: "Acme",
      startDate: "2025-01-06",
      endDate: "2025-06-30",
      status: "Closed",
      cdaEnabled: true,
      planEnabled: true,
      actualsLowThresholdPercent: "12",
      actualsHighThresholdPercent: "7",
      pmPersonIds: ["p1", "p2"],
      pgmPersonId: "p3",
      cadPersonId: "p4",
      clientSponsor: "Jane Doe",
      clientSponsor2: "John Roe",
      otherContact: "Ann Poe",
      keyStaffName: "Kay Staff",
      sowLink: "https://example.com/sow",
      estimateLink: "https://example.com/estimate",
      floatLink: "https://example.com/float",
      metricLink: "https://example.com/metric",
      slackChannelId: "C0123456789",
    });
  });

  it("falls back to empty form values for a bare project", () => {
    const fields = projectToSettingsFormFields({});
    expect(fields.status).toBe("Active");
    expect(fields.startDate).toBe("");
    expect(fields.endDate).toBe("");
    expect(fields.planEnabled).toBe(false);
    expect(fields.pmPersonIds).toEqual([]);
    expect(fields.actualsLowThresholdPercent).toBe("");
  });
});

describe("project -> form fields -> payload", () => {
  it("produces the Admin payload byte-for-byte", () => {
    const fields = projectToSettingsFormFields(FULL_PROJECT);
    expect(JSON.stringify(buildProjectSettingsPayload(fields, { isAdmin: true }))).toBe(
      ADMIN_PAYLOAD_JSON
    );
  });

  it("produces the non-Admin payload byte-for-byte, without planEnabled", () => {
    const fields = projectToSettingsFormFields(FULL_PROJECT);
    expect(JSON.stringify(buildProjectSettingsPayload(fields, { isAdmin: false }))).toBe(
      NON_ADMIN_PAYLOAD_JSON
    );
  });

  it("matches what the component hydrates in one step", () => {
    expect(JSON.stringify(projectToSettingsPayload(FULL_PROJECT, { isAdmin: true }))).toBe(
      ADMIN_PAYLOAD_JSON
    );
    expect(JSON.stringify(projectToSettingsPayload(FULL_PROJECT, { isAdmin: false }))).toBe(
      NON_ADMIN_PAYLOAD_JSON
    );
  });

  it("keeps hydration and payload in lockstep, so neither side can gain a field alone", () => {
    const fields = projectToSettingsFormFields(FULL_PROJECT);
    expect(Object.keys(buildProjectSettingsPayload(fields, { isAdmin: true })).sort()).toEqual(
      Object.keys(fields).sort()
    );
    expect(Object.keys(buildProjectSettingsPayload(fields, { isAdmin: false })).sort()).toEqual(
      Object.keys(fields)
        .filter((key) => key !== "planEnabled")
        .sort()
    );
  });

  it("normalizes blank, whitespace-only, and out-of-range form values", () => {
    const payload = buildProjectSettingsPayload(
      {
        ...projectToSettingsFormFields(FULL_PROJECT),
        clientSponsor: "   ",
        actualsLowThresholdPercent: "150",
        actualsHighThresholdPercent: "",
        endDate: "",
        pmPersonIds: ["p1", ""],
        slackChannelId: " C9 ",
      },
      { isAdmin: true }
    );
    expect(payload.clientSponsor).toBeNull();
    expect(payload.actualsLowThresholdPercent).toBeNull();
    expect(payload.actualsHighThresholdPercent).toBeNull();
    expect(payload.endDate).toBeNull();
    expect(payload.pmPersonIds).toEqual(["p1"]);
    expect(payload.slackChannelId).toBe("C9");
  });
});

describe("resolveSettingsAutosave", () => {
  it("does nothing when the payload matches the last save", () => {
    expect(
      resolveSettingsAutosave({
        payload: "a",
        lastSavedPayload: "a",
        serverHydrationBaseline: null,
      })
    ).toEqual({ action: "idle", nextServerHydrationBaseline: null });
  });

  it("drops a hydration baseline that the last save already reflects", () => {
    expect(
      resolveSettingsAutosave({
        payload: "a",
        lastSavedPayload: "a",
        serverHydrationBaseline: "a",
      })
    ).toEqual({ action: "idle", nextServerHydrationBaseline: null });
  });

  it("keeps a hydration baseline whose form state has not been applied yet", () => {
    // Invariant: the effect can run between recording a baseline and the hydrated state landing
    // (e.g. a rename changes projectSlug in the same commit). The baseline must survive that pass.
    expect(
      resolveSettingsAutosave({
        payload: "just-saved",
        lastSavedPayload: "just-saved",
        serverHydrationBaseline: "from-server",
      })
    ).toEqual({ action: "idle", nextServerHydrationBaseline: "from-server" });
  });

  it("adopts a hydrated snapshot instead of saving it back", () => {
    expect(
      resolveSettingsAutosave({
        payload: "from-server",
        lastSavedPayload: "just-saved",
        serverHydrationBaseline: "from-server",
      })
    ).toEqual({ action: "adopt-server-baseline", nextServerHydrationBaseline: null });
  });

  it("saves genuine local edits and stops the baseline shadowing later payloads", () => {
    expect(
      resolveSettingsAutosave({
        payload: "edited",
        lastSavedPayload: "just-saved",
        serverHydrationBaseline: "from-server",
      })
    ).toEqual({ action: "save", nextServerHydrationBaseline: null });
  });
});
