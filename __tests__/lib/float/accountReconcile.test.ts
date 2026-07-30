import { describe, expect, it } from "vitest";
import {
  normalizeFloatClientName,
  planFloatClientAccounts,
} from "@/lib/float/accountReconcile";

describe("normalizeFloatClientName", () => {
  it("trims and falls back to a stable label", () => {
    expect(normalizeFloatClientName("  Acme  ", 1)).toBe("Acme");
    expect(normalizeFloatClientName("", 1)).toBe("Float client 1");
    expect(normalizeFloatClientName(null, 7)).toBe("Float client 7");
  });
});

describe("planFloatClientAccounts", () => {
  it("matches on floatClientId and leaves matching names alone", () => {
    const plan = planFloatClientAccounts({
      floatClients: [{ floatClientId: 10, name: "Acme" }],
      existingAccounts: [{ id: "a1", name: "Acme", floatClientId: 10 }],
    });

    expect(plan.binds).toEqual([]);
    expect(plan.creates).toEqual([]);
    expect(plan.renames).toEqual([]);
    expect(plan.resolved).toEqual([{ floatClientId: 10, accountId: "a1" }]);
    expect(plan.warnings).toEqual([]);
  });

  it("claims an unlinked account that already uses the name", () => {
    const plan = planFloatClientAccounts({
      floatClients: [{ floatClientId: 10, name: "Acme" }],
      existingAccounts: [{ id: "a1", name: "Acme", floatClientId: null }],
    });

    expect(plan.binds).toEqual([
      { accountId: "a1", floatClientId: 10, previousFloatClientId: null },
    ]);
    expect(plan.creates).toEqual([]);
    expect(plan.warnings).toEqual([]);
  });

  it("rebinds when a Float client is deleted and re-created under the same name", () => {
    // The reported incident: Float client 18370124 was replaced by 18522757.
    const plan = planFloatClientAccounts({
      floatClients: [{ floatClientId: 18522757, name: "University of Minnesota" }],
      existingAccounts: [
        { id: "a1", name: "University of Minnesota", floatClientId: 18370124 },
      ],
    });

    expect(plan.binds).toEqual([
      { accountId: "a1", floatClientId: 18522757, previousFloatClientId: 18370124 },
    ]);
    expect(plan.creates).toEqual([]);
    expect(plan.renames).toEqual([]);
    expect(plan.resolved).toEqual([{ floatClientId: 18522757, accountId: "a1" }]);
    expect(plan.warnings).toEqual([]);
  });

  it("creates an account when nothing can be reused", () => {
    const plan = planFloatClientAccounts({
      floatClients: [{ floatClientId: 10, name: "Acme" }],
      existingAccounts: [{ id: "a1", name: "Other", floatClientId: 99 }],
    });

    expect(plan.creates).toEqual([{ floatClientId: 10, name: "Acme" }]);
    expect(plan.binds).toEqual([]);
    expect(plan.resolved).toEqual([]);
  });

  it("does not steal a name from an account linked to a live Float client", () => {
    const plan = planFloatClientAccounts({
      floatClients: [
        { floatClientId: 10, name: "Acme" },
        { floatClientId: 20, name: "Acme" },
      ],
      existingAccounts: [{ id: "a1", name: "Acme", floatClientId: 10 }],
    });

    expect(plan.creates).toEqual([]);
    expect(plan.binds).toEqual([]);
    expect(plan.resolved).toEqual([{ floatClientId: 10, accountId: "a1" }]);
    expect(plan.warnings).toHaveLength(1);
    expect(plan.warnings[0]).toContain("20");
  });

  it("warns instead of creating two accounts with the same name", () => {
    const plan = planFloatClientAccounts({
      floatClients: [
        { floatClientId: 10, name: "Acme" },
        { floatClientId: 20, name: "Acme" },
      ],
      existingAccounts: [],
    });

    expect(plan.creates).toEqual([{ floatClientId: 10, name: "Acme" }]);
    expect(plan.warnings).toHaveLength(1);
  });

  it("renames an account when its Float client was renamed", () => {
    const plan = planFloatClientAccounts({
      floatClients: [{ floatClientId: 10, name: "Acme Corp" }],
      existingAccounts: [{ id: "a1", name: "Acme", floatClientId: 10 }],
    });

    expect(plan.renames).toEqual([{ accountId: "a1", from: "Acme", to: "Acme Corp" }]);
    expect(plan.renamesNeedStaging).toBe(false);
  });

  it("stages renames when two clients swap names", () => {
    const plan = planFloatClientAccounts({
      floatClients: [
        { floatClientId: 10, name: "Beta" },
        { floatClientId: 20, name: "Alpha" },
      ],
      existingAccounts: [
        { id: "a1", name: "Alpha", floatClientId: 10 },
        { id: "a2", name: "Beta", floatClientId: 20 },
      ],
    });

    expect(plan.renamesNeedStaging).toBe(true);
    expect(plan.renames).toEqual([
      { accountId: "a1", from: "Alpha", to: "Beta" },
      { accountId: "a2", from: "Beta", to: "Alpha" },
    ]);
    expect(plan.warnings).toEqual([]);
  });

  it("refuses a rename that would collide with an untouched account", () => {
    const plan = planFloatClientAccounts({
      floatClients: [{ floatClientId: 10, name: "Taken" }],
      existingAccounts: [
        { id: "a1", name: "Acme", floatClientId: 10 },
        { id: "a2", name: "Taken", floatClientId: null },
      ],
    });

    expect(plan.renames).toEqual([]);
    expect(plan.warnings).toHaveLength(1);
    expect(plan.warnings[0]).toContain("Taken");
    expect(plan.resolved).toEqual([{ floatClientId: 10, accountId: "a1" }]);
  });

  it("reuses a name freed by a rename in the same run", () => {
    // Float renamed client 10 and added client 20 under the old name.
    const plan = planFloatClientAccounts({
      floatClients: [
        { floatClientId: 10, name: "Acme Holdings" },
        { floatClientId: 20, name: "Acme" },
      ],
      existingAccounts: [{ id: "a1", name: "Acme", floatClientId: 10 }],
    });

    expect(plan.renames).toEqual([
      { accountId: "a1", from: "Acme", to: "Acme Holdings" },
    ]);
    expect(plan.creates).toEqual([{ floatClientId: 20, name: "Acme" }]);
    expect(plan.warnings).toEqual([]);
  });

  it("never assigns one account to two Float clients", () => {
    const plan = planFloatClientAccounts({
      floatClients: [
        { floatClientId: 10, name: "Acme" },
        { floatClientId: 20, name: "Acme" },
      ],
      existingAccounts: [{ id: "a1", name: "Acme", floatClientId: null }],
    });

    const accountIds = [
      ...plan.resolved.map((r) => r.accountId),
      ...plan.binds.map((b) => b.accountId),
    ];
    expect(new Set(accountIds).size).toBe(1);
    expect(plan.creates).toEqual([]);
  });
});
