"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

export default function EditProjectPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<"Active" | "Closed">("Active");
  const [actualsLowThresholdPercent, setActualsLowThresholdPercent] = useState<string>("");
  const [actualsHighThresholdPercent, setActualsHighThresholdPercent] = useState<string>("");
  const [pmPersonIds, setPmPersonIds] = useState<string[]>([]);
  const [pgmPersonId, setPgmPersonId] = useState("");
  const [cadPersonId, setCadPersonId] = useState("");
  const [eligiblePeople, setEligiblePeople] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${id}`).then((r) => r.json()),
      fetch("/api/people/eligible-key-roles").then((r) => r.json()),
    ])
      .then(([p, people]) => {
        setName(p.name ?? "");
        setClientName(p.clientName ?? "");
        setStartDate(p.startDate ? new Date(p.startDate).toISOString().slice(0, 10) : "");
        setEndDate(p.endDate ? new Date(p.endDate).toISOString().slice(0, 10) : "");
        setStatus(p.status ?? "Active");
        setActualsLowThresholdPercent(p.actualsLowThresholdPercent != null ? String(p.actualsLowThresholdPercent) : "");
        setActualsHighThresholdPercent(p.actualsHighThresholdPercent != null ? String(p.actualsHighThresholdPercent) : "");
        const keyRoles = p.projectKeyRoles ?? [];
        setPmPersonIds(keyRoles.filter((kr: { type: string }) => kr.type === "PM").map((kr: { personId: string }) => kr.personId));
        setPgmPersonId(keyRoles.find((kr: { type: string }) => kr.type === "PGM")?.personId ?? "");
        setCadPersonId(keyRoles.find((kr: { type: string }) => kr.type === "CAD")?.personId ?? "");
        const eligible = Array.isArray(people) ? people : [];
        const currentIds = new Set(eligible.map((x: { id: string }) => x.id));
        const fromRoles = (keyRoles as { person: { id: string; name: string } }[])
          .map((kr) => kr.person)
          .filter((pers) => !currentIds.has(pers.id));
        setEligiblePeople(
          [...eligible, ...fromRoles].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
        );
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        clientName,
        startDate: new Date(startDate).toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : null,
        status,
        pmPersonIds: pmPersonIds.filter(Boolean),
        pgmPersonId: pgmPersonId || null,
        cadPersonId: cadPersonId || null,
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
      }),
    });
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    router.push(`/projects/${id}`);
    router.refresh();
  }

  if (loading) return <div className="p-6 text-body-sm text-surface-700 dark:text-surface-200">Loading...</div>;

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-dark-bg">
      <header className="bg-white/80 dark:bg-dark-bg/90 backdrop-blur-md border-b border-surface-200 dark:border-dark-border px-6 py-4">
        <Link href={`/projects/${id}`} className="text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 font-medium">
          ← Back to project
        </Link>
      </header>
      <main className="p-8 max-w-xl">
        <h1 className="text-display-md font-bold text-surface-900 dark:text-white mb-6">Edit Project</h1>
        <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-dark-surface p-6 rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark">
          {error && (
            <p className="text-body-sm text-jred-700 dark:text-jred-400 bg-jred-50 dark:bg-jred-900/20 p-3 rounded-md">{error}</p>
          )}
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
            <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">End Date (optional)</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
            />
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
          <div className="border-t pt-4 mt-4 space-y-4">
            <h3 className="text-sm font-medium text-black">Key roles</h3>
            <p className="text-sm text-gray-600">
              Assign PM, PGM, and CAD. Eligible: people with Director or Project Manager role from Float.
            </p>
            <div>
              <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">PM (Project Manager)</label>
              <select
                multiple
                value={pmPersonIds}
                onChange={(e) => {
                  const opts = Array.from(e.target.selectedOptions, (o) => o.value);
                  setPmPersonIds(opts);
                }}
                className="mt-1 block w-full min-h-[80px] px-3 py-2 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
                title="Hold Ctrl/Cmd to select multiple"
              >
                {eligiblePeople.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-0.5">Hold Ctrl/Cmd to select multiple.</p>
            </div>
            <div>
              <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">PGM (Program Manager)</label>
              <select
                value={pgmPersonId}
                onChange={(e) => setPgmPersonId(e.target.value)}
                className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
              >
                <option value="">— None —</option>
                {eligiblePeople.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">CAD</label>
              <select
                value={cadPersonId}
                onChange={(e) => setCadPersonId(e.target.value)}
                className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
              >
                <option value="">— None —</option>
                {eligiblePeople.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="border-t pt-4 mt-4 space-y-4">
            <h3 className="text-sm font-medium text-black">Weekly actuals validation</h3>
            <p className="text-sm text-gray-600">
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
              <p className="text-xs text-gray-500 mt-0.5">If actual is lower than resourced by more than this %, cell is purple. Default: 10.</p>
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
              <p className="text-xs text-gray-500 mt-0.5">If actual is higher than resourced by more than this %, cell is red. Default: 5.</p>
            </div>
          </div>
          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              className="h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 text-white font-semibold text-body-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
            >
              Save
            </button>
            <Link
              href={`/projects/${id}`}
              className="h-9 px-4 rounded-md border border-surface-300 dark:border-dark-muted bg-transparent hover:bg-surface-100 dark:hover:bg-dark-raised text-surface-700 dark:text-surface-200 font-medium text-body-sm"
            >
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
