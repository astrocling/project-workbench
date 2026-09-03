import { describe, expect, it } from "vitest";
import {
  buildProjectSettingsPayload,
  projectToSettingsFormFields,
  resolveSettingsAutosaveAction,
  type ProjectSettingsSource,
} from "@/lib/projectSettingsForm";

const serverProject: ProjectSettingsSource = {
  id: "cprojectid0000000000000001",
  name: "Apollo",
  clientName: "Acme",
  startDate: "2025-01-06T00:00:00.000Z",
  endDate: "2025-06-30T00:00:00.000Z",
  status: "Active",
  cdaEnabled: true,
  planEnabled: false,
  actualsLowThresholdPercent: 10,
  actualsHighThresholdPercent: null,
  clientSponsor: "Jane Doe",
  clientSponsor2: null,
  otherContact: null,
  keyStaffName: null,
  sowLink: "https://example.com/sow",
  estimateLink: null,
  floatLink: null,
  metricLink: null,
  slackChannelId: "C0123456789",
  projectKeyRoles: [
    { type: "PM", personId: "p1", person: { id: "p1", name: "PM One" } },
    { type: "PM", personId: "p2", person: { id: "p2", name: "PM Two" } },
    { type: "PGM", personId: "p3", person: { id: "p3", name: "PGM" } },
  ],
};

describe("projectToSettingsFormFields", () => {
  it("maps server values to form field values", () => {
    expect(projectToSettingsFormFields(serverProject)).toEqual({
      name: "Apollo",
      clientName: "Acme",
      startDate: "2025-01-06",
      endDate: "2025-06-30",
      status: "Active",
      cdaEnabled: true,
      planEnabled: false,
      actualsLowThresholdPercent: "10",
      actualsHighThresholdPercent: "",
      pmPersonIds: ["p1", "p2"],
      pgmPersonId: "p3",
      cadPersonId: "",
      clientSponsor: "Jane Doe",
      clientSponsor2: "",
      otherContact: "",
      keyStaffName: "",
      sowLink: "https://example.com/sow",
      estimateLink: "",
      floatLink: "",
      metricLink: "",
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
  });
});

describe("buildProjectSettingsPayload", () => {
  it("round-trips server props to the same payload the form state produces", () => {
    const fields = projectToSettingsFormFields(serverProject);
    const payload = buildProjectSettingsPayload(fields, { isAdmin: true });
    expect(payload.startDate).toBe("2025-01-06T00:00:00.000Z");
    expect(payload.endDate).toBe("2025-06-30T00:00:00.000Z");
    expect(payload.pgmPersonId).toBe("p3");
    expect(payload.cadPersonId).toBeNull();
    expect(payload.actualsHighThresholdPercent).toBeNull();
    // Re-applying the payload's own fields must be byte-identical, otherwise hydration would
    // look like a local edit and auto-save a stale snapshot back to the server.
    expect(JSON.stringify(buildProjectSettingsPayload(fields, { isAdmin: true }))).toBe(
      JSON.stringify(payload)
    );
  });

  it("omits planEnabled for non-admins", () => {
    const fields = projectToSettingsFormFields({ ...serverProject, planEnabled: true });
    expect(buildProjectSettingsPayload(fields, { isAdmin: false })).not.toHaveProperty(
      "planEnabled"
    );
    expect(buildProjectSettingsPayload(fields, { isAdmin: true }).planEnabled).toBe(true);
  });

  it("normalizes blank and out-of-range values", () => {
    const fields = projectToSettingsFormFields(serverProject);
    const payload = buildProjectSettingsPayload(
      {
        ...fields,
        clientSponsor: "   ",
        actualsLowThresholdPercent: "150",
        actualsHighThresholdPercent: "5",
        endDate: "",
        pmPersonIds: ["p1", ""],
      },
      { isAdmin: true }
    );
    expect(payload.clientSponsor).toBeNull();
    expect(payload.actualsLowThresholdPercent).toBeNull();
    expect(payload.actualsHighThresholdPercent).toBe(5);
    expect(payload.endDate).toBeNull();
    expect(payload.pmPersonIds).toEqual(["p1"]);
  });
});

describe("resolveSettingsAutosaveAction", () => {
  it("does nothing when the payload matches the last save", () => {
    expect(
      resolveSettingsAutosaveAction({
        payload: "a",
        lastSavedPayload: "a",
        serverHydrationBaseline: null,
      })
    ).toBe("idle");
  });

  it("adopts a hydrated snapshot instead of saving it back", () => {
    expect(
      resolveSettingsAutosaveAction({
        payload: "stale-from-server",
        lastSavedPayload: "just-saved",
        serverHydrationBaseline: "stale-from-server",
      })
    ).toBe("adopt-server-baseline");
  });

  it("saves genuine local edits", () => {
    expect(
      resolveSettingsAutosaveAction({
        payload: "edited",
        lastSavedPayload: "just-saved",
        serverHydrationBaseline: "stale-from-server",
      })
    ).toBe("save");
  });

  it("treats a matching last save as idle even while a hydration baseline is pending", () => {
    expect(
      resolveSettingsAutosaveAction({
        payload: "same",
        lastSavedPayload: "same",
        serverHydrationBaseline: "same",
      })
    ).toBe("idle");
  });
});
