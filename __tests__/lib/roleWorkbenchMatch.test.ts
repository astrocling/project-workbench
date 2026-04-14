/**
 * Run: npm run test -- __tests__/lib/roleWorkbenchMatch.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  buildWorkbenchRoleLookup,
  getFallbackRoleIdForNewAssignment,
  normalizeFloatRoleName,
  resolveJobTitleToWorkbenchId,
  resolveRoleIdForNewAssignmentFromFloat,
} from "@/lib/float/roleWorkbenchMatch";

describe("roleWorkbenchMatch", () => {
  it("normalizes Float role strings", () => {
    expect(normalizeFloatRoleName("  Project  Manager  ")).toBe("project manager");
  });

  it("resolves Float labels to Workbench ids (exact and alias)", () => {
    const roles = [
      { id: "a", name: "Project Manager" },
      { id: "b", name: "Analytics Engineer" },
    ];
    const { resolveFloatRoleNameToWorkbenchId } = buildWorkbenchRoleLookup(roles);
    expect(resolveFloatRoleNameToWorkbenchId("Project Manager")).toBe("a");
    expect(resolveFloatRoleNameToWorkbenchId("pm")).toBe("a");
    expect(resolveFloatRoleNameToWorkbenchId("nope")).toBeNull();
  });

  it("getFallbackRoleIdForNewAssignment prefers Solutions Consultant when present", () => {
    const roles = [
      { id: "ae", name: "Analytics Engineer" },
      { id: "sc", name: "Solutions Consultant" },
      { id: "ze", name: "ZE Last" },
    ];
    expect(getFallbackRoleIdForNewAssignment(roles)).toBe("sc");
  });

  it("getFallbackRoleIdForNewAssignment uses last alphabetical when Solutions Consultant missing", () => {
    const roles = [
      { id: "ae", name: "Analytics Engineer" },
      { id: "ze", name: "Zebra Role" },
    ];
    expect(getFallbackRoleIdForNewAssignment(roles)).toBe("ze");
  });

  it("resolveJobTitleToWorkbenchId maps aliases and exact role names", () => {
    const roles = [
      { id: "ld", name: "Lead Developer" },
      { id: "des", name: "Designer" },
      { id: "sc", name: "Solutions Consultant" },
    ];
    expect(resolveJobTitleToWorkbenchId("Senior Developer", roles)).toBe("ld");
    expect(resolveJobTitleToWorkbenchId("  designer  ", roles)).toBe("des");
    expect(resolveJobTitleToWorkbenchId("Senior Consultant", roles)).toBe("sc");
    expect(resolveJobTitleToWorkbenchId("", roles)).toBeNull();
    expect(resolveJobTitleToWorkbenchId(null, roles)).toBeNull();
    expect(resolveJobTitleToWorkbenchId("Unknown Title XYZ", roles)).toBeNull();
  });

  describe("resolveRoleIdForNewAssignmentFromFloat", () => {
    const roles = [
      { id: "pm", name: "Project Manager" },
      { id: "ld", name: "Lead Developer" },
      { id: "sc", name: "Solutions Consultant" },
    ];
    const { resolveFloatRoleNameToWorkbenchId } = buildWorkbenchRoleLookup(roles);

    it("resolves Float alias (e.g. pm) to Workbench role", () => {
      expect(
        resolveRoleIdForNewAssignmentFromFloat({
          workbenchRoles: roles,
          floatRoleName: "pm",
          floatJobTitle: null,
          resolveFloatRoleNameToWorkbenchId,
        })
      ).toBe("pm");
    });

    it("prefers job title over Float role when both apply", () => {
      expect(
        resolveRoleIdForNewAssignmentFromFloat({
          workbenchRoles: roles,
          floatRoleName: "pm",
          floatJobTitle: "Senior Developer",
          resolveFloatRoleNameToWorkbenchId,
        })
      ).toBe("ld");
    });

    it("uses job title when Float role is empty", () => {
      expect(
        resolveRoleIdForNewAssignmentFromFloat({
          workbenchRoles: roles,
          floatRoleName: "",
          floatJobTitle: "Senior Developer",
          resolveFloatRoleNameToWorkbenchId,
        })
      ).toBe("ld");
    });

    it("uses fallback when Float role and job title do not map", () => {
      expect(
        resolveRoleIdForNewAssignmentFromFloat({
          workbenchRoles: roles,
          floatRoleName: "totally unknown float label",
          floatJobTitle: null,
          resolveFloatRoleNameToWorkbenchId,
        })
      ).toBe("sc");
    });

    it("uses existingRoleId before fallback when no job/float resolution", () => {
      expect(
        resolveRoleIdForNewAssignmentFromFloat({
          workbenchRoles: roles,
          floatRoleName: "totally unknown float label",
          floatJobTitle: null,
          existingRoleId: "ld",
          resolveFloatRoleNameToWorkbenchId,
        })
      ).toBe("ld");
    });

    it("respects fallbackRoleIdForNew override", () => {
      expect(
        resolveRoleIdForNewAssignmentFromFloat({
          workbenchRoles: roles,
          floatRoleName: "nope",
          floatJobTitle: null,
          resolveFloatRoleNameToWorkbenchId,
          fallbackRoleIdForNew: "ld",
        })
      ).toBe("ld");
    });
  });
});
