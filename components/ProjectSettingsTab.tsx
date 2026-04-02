"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PersonCombobox, PersonMultiCombobox } from "@/components/PersonCombobox";
import { Toggle } from "@/components/Toggle";
import { RatesTab } from "@/components/RatesTab";
import { AssignmentsTab } from "@/components/AssignmentsTab";
import type { EditProjectInitial } from "@/app/(app)/projects/[slug]/edit/EditProjectDataContext";

export function ProjectSettingsTab({
  projectSlug,
  canEdit,
  initialProject: initialProjectProp,
  initialEligiblePeople: initialEligibleProp,
}: {
  projectSlug: string;
  canEdit: boolean;
  initialProject: EditProjectInitial | null;
  initialEligiblePeople: { id: string; name: string }[] | null;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<"Active" | "Closed">("Active");
  const [cdaEnabled, setCdaEnabled] = useState(false);
  const [actualsLowThresholdPercent, setActualsLowThresholdPercent] = useState<string>("");
  const [actualsHighThresholdPercent, setActualsHighThresholdPercent] = useState<string>("");
  const [pmPersonIds, setPmPersonIds] = useState<string[]>([]);
  const [pgmPersonId, setPgmPersonId] = useState("");
  const [cadPersonId, setCadPersonId] = useState("");
  const [clientSponsor, setClientSponsor] = useState("");
  const [clientSponsor2, setClientSponsor2] = useState("");
  const [otherContact, setOtherContact] = useState("");
  const [keyStaffName, setKeyStaffName] = useState("");
  const [sowLink, setSowLink] = useState("");
  const [estimateLink, setEstimateLink] = useState("");
  const [floatLink, setFloatLink] = useState("");
  const [metricLink, setMetricLink] = useState("");
  const [eligiblePeople, setEligiblePeople] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [backfillingFloat, setBackfillingFloat] = useState(false);
  const [syncingPlanFromFloat, setSyncingPlanFromFloat] = useState(false);
  const [showSyncPlanConfirm, setShowSyncPlanConfirm] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [settingsTab, setSettingsTab] = useState<"details" | "links" | "key-roles" | "resourcing" | "rates" | "assignments">("details");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");
  const lastSavedRef = useRef<string | null>(null);
  const initialSaveRecordedRef = useRef(false);

  const buildPayload = useCallback(
    () => ({
      name,
      clientName,
      startDate: new Date(startDate).toISOString(),
      endDate: endDate ? new Date(endDate).toISOString() : null,
      status,
      cdaEnabled,
      pmPersonIds: pmPersonIds.filter(Boolean),
      pgmPersonId: pgmPersonId || null,
      cadPersonId: cadPersonId || null,
      clientSponsor: clientSponsor.trim() || null,
      clientSponsor2: clientSponsor2.trim() || null,
      otherContact: otherContact.trim() || null,
      keyStaffName: keyStaffName.trim() || null,
      actualsLowThresholdPercent:
        actualsLowThresholdPercent === ""
          ? null
          : (() => {
              const n = Number(actualsLowThresholdPercent);
              return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
            })(),
      actualsHighThresholdPercent:
        actualsHighThresholdPercent === ""
          ? null
          : (() => {
              const n = Number(actualsHighThresholdPercent);
              return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
            })(),
      sowLink: sowLink.trim() || null,
      estimateLink: estimateLink.trim() || null,
      floatLink: floatLink.trim() || null,
      metricLink: metricLink.trim() || null,
    }),
    [
      name,
      clientName,
      startDate,
      endDate,
      status,
      cdaEnabled,
      pmPersonIds,
      pgmPersonId,
      cadPersonId,
      clientSponsor,
      clientSponsor2,
      otherContact,
      keyStaffName,
      actualsLowThresholdPercent,
      actualsHighThresholdPercent,
      sowLink,
      estimateLink,
      floatLink,
      metricLink,
    ]
  );

  function applyProjectToState(p: {
    id?: string;
    name?: string;
    clientName?: string;
    startDate?: string;
    endDate?: string | null;
    status?: string;
    cdaEnabled?: boolean;
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
    projectKeyRoles?: Array<{ type: string; personId: string; person: { id: string; name: string } }>;
  }) {
    if (!p) return;
    setProjectId(p.id ?? "");
    setName(p.name ?? "");
    setClientName(p.clientName ?? "");
    setStartDate(p.startDate ? new Date(p.startDate).toISOString().slice(0, 10) : "");
    setEndDate(p.endDate ? new Date(p.endDate).toISOString().slice(0, 10) : "");
    setStatus((p.status as "Active" | "Closed") ?? "Active");
    setCdaEnabled(p.cdaEnabled ?? false);
    setActualsLowThresholdPercent(p.actualsLowThresholdPercent != null ? String(p.actualsLowThresholdPercent) : "");
    setActualsHighThresholdPercent(p.actualsHighThresholdPercent != null ? String(p.actualsHighThresholdPercent) : "");
    const keyRoles = (p.projectKeyRoles ?? []) as { type: string; personId: string; person: { id: string; name: string } }[];
    setPmPersonIds(keyRoles.filter((kr) => kr.type === "PM").map((kr) => kr.personId));
    setPgmPersonId(keyRoles.find((kr) => kr.type === "PGM")?.personId ?? "");
    setCadPersonId(keyRoles.find((kr) => kr.type === "CAD")?.personId ?? "");
    setClientSponsor(p.clientSponsor ?? "");
    setClientSponsor2(p.clientSponsor2 ?? "");
    setOtherContact(p.otherContact ?? "");
    setKeyStaffName(p.keyStaffName ?? "");
    setSowLink(p.sowLink ?? "");
    setEstimateLink(p.estimateLink ?? "");
    setFloatLink(p.floatLink ?? "");
    setMetricLink(p.metricLink ?? "");
  }

  function applyEligiblePeople(people: { id: string; name: string }[], keyRoles: { type: string; personId: string; person: { id: string; name: string } }[]) {
    const eligible = Array.isArray(people) ? people : [];
    const currentIds = new Set(eligible.map((x) => x.id));
    const fromRoles = keyRoles.map((kr) => kr.person).filter((p) => p && !currentIds.has(p.id));
    setEligiblePeople([...eligible, ...fromRoles].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")));
  }

  useEffect(() => {
    if (initialProjectProp) {
      applyProjectToState(initialProjectProp);
      if (initialEligibleProp != null) {
        setEligiblePeople(initialEligibleProp);
      } else {
        fetch("/api/people/eligible-key-roles")
          .then((r) => r.json())
          .then((people) => {
            applyEligiblePeople(people, initialProjectProp.projectKeyRoles);
          })
          .catch(() => {});
      }
      setLoading(false);
      return;
    }
    Promise.all([
      fetch(`/api/projects/${projectSlug}`).then((r) => r.json()),
      fetch("/api/people/eligible-key-roles").then((r) => r.json()),
    ])
      .then(([p, people]) => {
        applyProjectToState(p);
        const keyRoles = (p?.projectKeyRoles ?? []) as { type: string; personId: string; person: { id: string; name: string } }[];
        applyEligiblePeople(Array.isArray(people) ? people : [], keyRoles);
      })
      .finally(() => setLoading(false));
  }, [projectSlug, initialProjectProp, initialEligibleProp]);

  // Record initial payload once load completes so we don't auto-save on first paint
  useEffect(() => {
    if (loading || initialSaveRecordedRef.current) return;
    initialSaveRecordedRef.current = true;
    lastSavedRef.current = JSON.stringify(buildPayload());
  }, [loading, buildPayload]);

  // Auto-save when form state changes (debounced)
  useEffect(() => {
    if (loading || !initialSaveRecordedRef.current) return;
    const payloadStr = JSON.stringify(buildPayload());
    if (payloadStr === lastSavedRef.current) return;

    const timer = setTimeout(async () => {
      setSaving(true);
      setError("");
      const res = await fetch(`/api/projects/${projectSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) {
        setError(await res.text());
        setSaving(false);
        return;
      }
      lastSavedRef.current = JSON.stringify(buildPayload());
      setSaving(false);
      setSaveStatus("saved");
      router.refresh();
      setTimeout(() => setSaveStatus("idle"), 2000);
    }, 800);

    return () => clearTimeout(timer);
  }, [
    loading,
    projectSlug,
    buildPayload,
    router,
  ]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
  }

  async function backfillFloat() {
    if (!canEdit || backfillingFloat) return;
    setBackfillingFloat(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/backfill-float`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data.detail ?? data.error ?? "Backfill failed";
        const available = data.availableInImport as string[] | undefined;
        const msg = Array.isArray(available) && available.length > 0
          ? `${detail}\n\nNames in last import: ${available.join(", ")}`
          : detail;
        alert(msg);
        return;
      }
      router.refresh();
    } finally {
      setBackfillingFloat(false);
    }
  }

  async function syncPlanFromFloat() {
    if (!canEdit || syncingPlanFromFloat) return;
    setShowSyncPlanConfirm(false);
    setSyncingPlanFromFloat(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/sync-plan-from-float`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? data.message ?? "Sync failed");
        return;
      }
      const msg = data.message ?? `Synced ${data.updated ?? 0} project plan entries from Float scheduled hours.`;
      alert(msg);
      router.refresh();
    } finally {
      setSyncingPlanFromFloat(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-body-sm text-surface-500 dark:text-surface-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-title-lg font-semibold text-surface-900 dark:text-white mb-4">Project settings</h2>
        <form id="edit-project-form" onSubmit={handleSubmit} className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark">
          <nav className="flex gap-2 border-b border-surface-200 dark:border-dark-border px-6 pt-6 -mb-px" aria-label="Settings sections">
            {[
              { id: "details" as const, label: "Details" },
              { id: "links" as const, label: "Links" },
              { id: "key-roles" as const, label: "Key roles" },
              { id: "resourcing" as const, label: "Resourcing" },
              { id: "rates" as const, label: "Rates" },
              { id: "assignments" as const, label: "Assignments" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSettingsTab(t.id)}
                className={`px-4 py-2 border-b-2 transition-colors ${
                  settingsTab === t.id
                    ? "border-jblue-500 text-jblue-600 dark:text-jblue-400 font-semibold"
                    : "border-transparent text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-dark-raised rounded-t-md"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="p-6 space-y-8">
            {error && (
              <p className="text-body-sm text-jred-700 dark:text-jred-400 bg-jred-50 dark:bg-jred-900/20 p-3 rounded-md">{error}</p>
            )}
            {settingsTab === "details" && (
            <section className="space-y-4">
              <h2 className="text-label-lg font-semibold text-surface-900 dark:text-white mb-3">Project details</h2>
              <div>
                <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
                />
              </div>
              <div>
                <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">Client</label>
                <input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  required
                  className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
                  />
                </div>
                <div>
                  <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "Active" | "Closed")}
                  className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
                >
                  <option value="Active">Active</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <div>
                <Toggle
                  checked={cdaEnabled}
                  onChange={setCdaEnabled}
                  label="Enable CDA tab (monthly planned / actuals)"
                  aria-label="Enable CDA tab"
                />
              </div>
            </section>
            )}

            {settingsTab === "links" && (
            <section className="space-y-4">
              <h2 className="text-label-lg font-semibold text-surface-900 dark:text-white mb-3">External links</h2>
              <p className="text-body-sm text-surface-500 dark:text-surface-400 mb-4">Optional links to SOW, estimates, Float, and metrics.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">SOW link</label>
                  <input
                    type="text"
                    value={sowLink}
                    onChange={(e) => setSowLink(e.target.value)}
                    placeholder="https://..."
                    className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
                  />
                </div>
                <div>
                  <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">Estimate link</label>
                  <input
                    type="text"
                    value={estimateLink}
                    onChange={(e) => setEstimateLink(e.target.value)}
                    placeholder="https://..."
                    className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
                  />
                </div>
                <div>
                  <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">Float link</label>
                  <input
                    type="text"
                    value={floatLink}
                    onChange={(e) => setFloatLink(e.target.value)}
                    placeholder="https://..."
                    className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
                  />
                </div>
                <div>
                  <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">Metric link</label>
                  <input
                    type="text"
                    value={metricLink}
                    onChange={(e) => setMetricLink(e.target.value)}
                    placeholder="https://..."
                    className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
                  />
                </div>
              </div>
            </section>
            )}

            {settingsTab === "key-roles" && (
            <section className="space-y-4">
              <h2 className="text-label-lg font-semibold text-surface-900 dark:text-white mb-3">Key roles</h2>
            <div>
              <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">PM (Project Manager)</label>
              <div className="mt-1">
                <PersonMultiCombobox
                  value={pmPersonIds}
                  onChange={setPmPersonIds}
                  options={eligiblePeople}
                  placeholder="Type to search and add..."
                  aria-label="PM (Project Manager)"
                />
              </div>
              <p className="text-body-sm text-surface-500 dark:text-surface-400 mt-0.5">Type to search; remove with × on each chip.</p>
            </div>
            <div>
              <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">PGM (Program Manager)</label>
              <div className="mt-1">
                <PersonCombobox
                  value={pgmPersonId}
                  onChange={setPgmPersonId}
                  options={eligiblePeople}
                  placeholder="Type to search..."
                  aria-label="PGM (Program Manager)"
                />
              </div>
            </div>
            <div>
              <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">CAD (Client Account Director)</label>
              <div className="mt-1">
                <PersonCombobox
                  value={cadPersonId}
                  onChange={setCadPersonId}
                  options={eligiblePeople}
                  placeholder="Type to search..."
                  aria-label="CAD (Client Account Director)"
                />
              </div>
            </div>
            <p className="text-body-sm text-surface-500 dark:text-surface-400 mt-2">These optional fields appear on status report PDFs.</p>
            <div>
              <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">Client Sponsor</label>
              <input
                type="text"
                value={clientSponsor}
                onChange={(e) => setClientSponsor(e.target.value)}
                placeholder="Name or title"
                className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
              />
            </div>
            <div>
              <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">Client Sponsor 2</label>
              <input
                type="text"
                value={clientSponsor2}
                onChange={(e) => setClientSponsor2(e.target.value)}
                placeholder="Name or title"
                className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
              />
            </div>
            <div>
              <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">Other Contact</label>
              <input
                type="text"
                value={otherContact}
                onChange={(e) => setOtherContact(e.target.value)}
                placeholder="Name or title"
                className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
              />
            </div>
            <div>
              <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">Key Staff</label>
              <input
                type="text"
                value={keyStaffName}
                onChange={(e) => setKeyStaffName(e.target.value)}
                placeholder="Name(s) for status report"
                className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
              />
            </div>
            </section>
            )}

            {settingsTab === "resourcing" && (
            <section className="space-y-4">
            <h2 className="text-label-lg font-semibold text-surface-900 dark:text-white mb-3">Resourcing</h2>
            <p className="text-body-sm text-surface-500 dark:text-surface-400 mb-4">
              Thresholds for highlighting cells in the Resourcing grid. Leave blank to use defaults.
            </p>
            <div>
              <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">Under-resourced threshold (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={actualsLowThresholdPercent}
                onChange={(e) => setActualsLowThresholdPercent(e.target.value)}
                placeholder="10"
                className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
              />
              <p className="text-body-sm text-surface-500 dark:text-surface-400 mt-0.5">If actual is lower than resourced by more than this %, cell is purple. Default: 10.</p>
            </div>
            <div>
              <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">Over-resourced threshold (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={actualsHighThresholdPercent}
                onChange={(e) => setActualsHighThresholdPercent(e.target.value)}
                placeholder="5"
                className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
              />
              <p className="text-body-sm text-surface-500 dark:text-surface-400 mt-0.5">If actual is higher than resourced by more than this %, cell is red. Default: 5.</p>
            </div>
            </section>
            )}

            {settingsTab === "rates" && projectId && (
              <div className="space-y-4">
                <RatesTab projectId={projectId} canEdit={canEdit} />
              </div>
            )}

            {settingsTab === "assignments" && projectId && (
              <div className="space-y-4">
                <AssignmentsTab projectId={projectId} canEdit={canEdit} />
              </div>
            )}

            <section className="border-t border-surface-200 dark:border-dark-border pt-6">
              <div className="flex gap-4 flex-wrap items-center">
                {saving ? (
                  <span className="text-body-sm text-surface-500 dark:text-surface-400">Saving…</span>
                ) : saveStatus === "saved" ? (
                  <span className="text-body-sm text-green-600 dark:text-green-400 font-medium">Saved</span>
                ) : null}
                <Link
                  href={`/projects/${projectSlug}`}
                  className="inline-flex items-center justify-center h-9 px-4 rounded-md border border-surface-300 dark:border-dark-muted bg-transparent hover:bg-surface-100 dark:hover:bg-dark-raised text-surface-700 dark:text-surface-200 font-medium text-body-sm"
                >
                  Back to overview
                </Link>
                {canEdit && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowSyncPlanConfirm(true)}
                      disabled={syncingPlanFromFloat}
                      title="Copy Float scheduled hours from the database into the Project Plan grid for all weeks that have Float data (past, current, and future)"
                      className="inline-flex items-center justify-center h-9 px-4 rounded-md border border-surface-300 dark:border-dark-muted bg-transparent hover:bg-surface-100 dark:hover:bg-dark-raised text-surface-700 dark:text-surface-200 font-medium text-body-sm disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
                    >
                      {syncingPlanFromFloat ? "Syncing…" : "Sync plan from Float"}
                    </button>
                    <button
                      type="button"
                      onClick={backfillFloat}
                      disabled={backfillingFloat}
                      title="Import float hour data from the last Float sync for this project"
                      className="inline-flex items-center justify-center h-9 px-4 rounded-md border border-surface-300 dark:border-dark-muted bg-transparent hover:bg-surface-100 dark:hover:bg-dark-raised text-surface-700 dark:text-surface-200 font-medium text-body-sm disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
                    >
                      {backfillingFloat ? "Backfilling…" : "Backfill float data"}
                    </button>
                  </>
                )}
              </div>
            </section>
          </div>
        </form>
        {showSyncPlanConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sync-plan-dialog-title"
            aria-describedby="sync-plan-dialog-desc"
          >
            <div
              className="absolute inset-0 bg-black/50"
              aria-hidden
              onClick={() => setShowSyncPlanConfirm(false)}
            />
            <div className="relative w-full max-w-md rounded-lg border border-surface-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-xl p-5">
              <h3 id="sync-plan-dialog-title" className="text-title-md font-semibold text-surface-900 dark:text-white">
                Sync plan from Float
              </h3>
              <p id="sync-plan-dialog-desc" className="mt-2 text-body-sm text-surface-600 dark:text-surface-300">
                This copies <strong className="text-surface-900 dark:text-white">Float scheduled hours</strong> (what’s stored in Workbench from
                Float sync) into the <strong className="text-surface-900 dark:text-white">Project Plan</strong> grid for every week that has
                Float data — past, current, and future — so Planned matches the Float column.
              </p>
              <p className="mt-3 text-body-sm text-surface-500 dark:text-surface-400 italic">
                If Workbench’s Float column still doesn’t match the Float product for an old week, past Float rows may not be updated by API
                sync; use Backfill from stored imports or align data in Float and re-sync future weeks.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSyncPlanConfirm(false)}
                  disabled={syncingPlanFromFloat}
                  className="px-3 py-1.5 rounded-md text-body-sm font-medium text-surface-700 dark:text-surface-200 bg-surface-100 dark:bg-dark-raised hover:bg-surface-200 dark:hover:bg-dark-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={syncPlanFromFloat}
                  disabled={syncingPlanFromFloat}
                  className="px-3 py-1.5 rounded-md text-body-sm font-medium text-white bg-jblue-600 hover:bg-jblue-700 disabled:opacity-50 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
                >
                  {syncingPlanFromFloat ? "Syncing…" : "Sync plan"}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
