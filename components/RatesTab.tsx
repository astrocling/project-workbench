"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type Role = { id: string; name: string };
type ProjectRoleRate = { roleId: string; role: Role; billRate: number };
type Assignment = { roleId: string };
type Project = {
  useSingleRate: boolean;
  singleBillRate: number | null;
};

export function RatesTab({
  projectId,
  canEdit,
}: {
  projectId: string;
  canEdit: boolean;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [rates, setRates] = useState<ProjectRoleRate[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [singleRateEditing, setSingleRateEditing] = useState("");
  const [loading, setLoading] = useState(true);
  const singleRateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingToggleRef = useRef<{ useSingleRate: boolean } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/assignments`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/rates`).then((r) => r.json()),
      fetch("/api/roles").then((r) => r.json()),
    ]).then(([p, a, r, rolesList]) => {
      const pending = pendingToggleRef.current;
      const merged = pending
        ? { ...p, useSingleRate: pending.useSingleRate, singleBillRate: pending.useSingleRate ? p.singleBillRate : null }
        : p;
      setProject(merged);
      setAssignments(Array.isArray(a) ? a : []);
      setRates(Array.isArray(r) ? r : []);
      setRoles(Array.isArray(rolesList) ? rolesList : []);
      setSingleRateEditing(
        merged.singleBillRate != null ? String(merged.singleBillRate) : ""
      );
    }).finally(() => setLoading(false));
  }, [projectId]);

  const rateByRole = new Map(rates.map((x) => [x.roleId, x]));
  const resourcedRoleIds = new Set(
    assignments.map((a) => a.roleId)
  );
  const hasSingleRate =
    project?.useSingleRate === true && project?.singleBillRate != null;
  const missingRateRoleIds = hasSingleRate
    ? new Set<string>()
    : new Set(
        [...resourcedRoleIds].filter((roleId) => !rateByRole.has(roleId))
      );

  const saveRateTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const saveRate = useCallback(
    async (roleId: string, value: string) => {
      if (!canEdit) return;
      const num = parseFloat(value);
      if (isNaN(num) || num < 0) return;
      const res = await fetch(`/api/projects/${projectId}/rates`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId, billRate: num }),
      });
      if (res.ok) {
        const r = await res.json();
        const savedNum = r.billRate != null ? Number(r.billRate) : num;
        setRates((prev) => prev.filter((x) => x.roleId !== roleId).concat(r));
        setEditing((e) => ({ ...e, [roleId]: String(savedNum) }));
      }
    },
    [projectId, canEdit]
  );

  const removeRate = useCallback(
    async (roleId: string) => {
      if (!canEdit) return;
      const res = await fetch(
        `/api/projects/${projectId}/rates?roleId=${encodeURIComponent(roleId)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setRates((prev) => prev.filter((x) => x.roleId !== roleId));
        setEditing((e) => ({ ...e, [roleId]: "" }));
      }
    },
    [projectId, canEdit]
  );

  function scheduleSaveRate(roleId: string, value: string) {
    if (saveRateTimeoutRef.current[roleId]) {
      clearTimeout(saveRateTimeoutRef.current[roleId]);
    }
    saveRateTimeoutRef.current[roleId] = setTimeout(() => {
      const trimmed = value.trim();
      if (trimmed === "") {
        removeRate(roleId);
      } else {
        const num = parseFloat(trimmed);
        if (!isNaN(num) && num >= 0) saveRate(roleId, trimmed);
      }
      delete saveRateTimeoutRef.current[roleId];
    }, 800);
  }

  useEffect(() => {
    return () => {
      Object.values(saveRateTimeoutRef.current).forEach(clearTimeout);
      saveRateTimeoutRef.current = {};
      if (singleRateTimeoutRef.current) clearTimeout(singleRateTimeoutRef.current);
    };
  }, []);

  async function setUseSingleRate(useSingleRate: boolean) {
    if (!canEdit) return;
    const prev = project;
    pendingToggleRef.current = { useSingleRate };
    // Optimistic update so UI responds immediately
    setProject((p) =>
      p
        ? {
            ...p,
            useSingleRate,
            singleBillRate: useSingleRate ? p.singleBillRate : null,
          }
        : null
    );
    if (!useSingleRate) setSingleRateEditing("");
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          useSingleRate,
          ...(useSingleRate ? {} : { singleBillRate: null }),
        }),
      });
      if (res.ok) {
        const p = await res.json();
        pendingToggleRef.current = null;
        setProject(p);
        setSingleRateEditing(
          p.singleBillRate != null ? String(p.singleBillRate) : ""
        );
      } else {
        pendingToggleRef.current = null;
        setProject(prev);
        setSingleRateEditing(
          prev?.singleBillRate != null ? String(prev.singleBillRate) : ""
        );
      }
    } catch {
      pendingToggleRef.current = null;
      setProject(prev);
      setSingleRateEditing(
        prev?.singleBillRate != null ? String(prev.singleBillRate) : ""
      );
    }
  }

  const saveSingleRate = useCallback(
    async (value: string) => {
      if (!canEdit || !project?.useSingleRate) return;
      const num = parseFloat(value);
      if (isNaN(num) || num < 0) return;
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ singleBillRate: num }),
      });
      if (res.ok) {
        const p = await res.json();
        const savedNum =
          p.singleBillRate != null ? Number(p.singleBillRate) : num;
        setProject(p);
        setSingleRateEditing(String(savedNum));
      }
    },
    [projectId, canEdit, project?.useSingleRate]
  );

  function scheduleSaveSingleRate(value: string) {
    if (singleRateTimeoutRef.current) clearTimeout(singleRateTimeoutRef.current);
    singleRateTimeoutRef.current = setTimeout(() => {
      if (value && parseFloat(value) >= 0) saveSingleRate(value);
      singleRateTimeoutRef.current = null;
    }, 800);
  }

  if (loading) return <p className="text-body-sm text-surface-700 dark:text-surface-200">Loading...</p>;

  const useSingleRate = project?.useSingleRate === true;
  const missingRateRoles = useSingleRate
    ? []
    : [...missingRateRoleIds]
        .map((id) => roles.find((r) => r.id === id)?.name)
        .filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      {missingRateRoles.length > 0 && (
        <div
          className="rounded-md border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 text-body-sm text-amber-800 dark:text-amber-400"
          role="alert"
        >
          <p className="font-medium">
            Roles on this project without a bill rate
          </p>
          <p className="mt-1">
            The following roles are assigned on this project but have no rate
            set: <strong>{missingRateRoles.join(", ")}</strong>. Add rates in
            the table below.
          </p>
        </div>
      )}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-body-sm text-surface-800 dark:text-surface-100 cursor-pointer">
          <input
            type="checkbox"
            checked={useSingleRate}
            onChange={(e) => setUseSingleRate(e.target.checked)}
            disabled={!canEdit}
            className="rounded border-surface-300 dark:border-dark-muted accent-jblue-500"
          />
          Use single rate for all roles
        </label>
      </div>

      {useSingleRate ? (
        <div className="space-y-2 max-w-xs">
          <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">
            Bill rate ($)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step={0.01}
              value={singleRateEditing}
              onChange={(e) => {
                const v = e.target.value;
                setSingleRateEditing(v);
                if (canEdit) scheduleSaveSingleRate(v);
              }}
              onBlur={() =>
                singleRateEditing && saveSingleRate(singleRateEditing)
              }
              className="h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 w-24 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
              readOnly={!canEdit}
            />
          </div>
          <p className="text-label-md text-surface-500 dark:text-surface-400">
            This rate applies to all resourced roles on the project.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border overflow-hidden shadow-card-light dark:shadow-card-dark max-w-xl">
          <table className="w-full text-body-sm border-collapse">
            <thead>
              <tr className="bg-surface-50 dark:bg-dark-raised border-b border-surface-200 dark:border-dark-border">
                <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">Role</th>
                <th className="text-left px-4 py-3 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">Bill Rate ($)</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => {
                const existing = rateByRole.get(role.id);
                const val =
                  editing[role.id] ??
                  (existing ? String(existing.billRate) : "");
                const isMissing = missingRateRoleIds.has(role.id);
                return (
                  <tr
                    key={role.id}
                    className={`border-b border-surface-100 dark:border-dark-border/60 last:border-0 ${
                      isMissing ? "bg-amber-50 dark:bg-amber-900/20" : ""
                    } hover:bg-jblue-500/[0.03] dark:hover:bg-jblue-500/[0.06] transition-colors duration-100`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-surface-800 dark:text-white">{role.name}</span>
                      {isMissing && (
                        <span className="ml-2 text-label-sm font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                          Missing rate
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canEdit ? (
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={val}
                          onChange={(e) => {
                            const v = e.target.value;
                            setEditing((x) => ({ ...x, [role.id]: v }));
                            scheduleSaveRate(role.id, v);
                          }}
                          onBlur={() =>
                            val.trim() === ""
                              ? removeRate(role.id)
                              : val && saveRate(role.id, val)
                          }
                          className="h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 w-24 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
                        />
                    ) : (
                      <span className="tabular-nums text-surface-700 dark:text-surface-200">{existing ? existing.billRate : "—"}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
