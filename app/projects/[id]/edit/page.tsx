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

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <Link href={`/projects/${id}`} className="text-blue-600 hover:underline">
          ← Back to project
        </Link>
      </header>
      <main className="p-6 max-w-xl">
        <h1 className="text-xl font-semibold mb-6">Edit Project</h1>
        <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded border">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
          )}
          <div>
            <label className="block text-sm font-medium text-black">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-black">Client</label>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              required
              className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-black">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-black">End Date (optional)</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-black">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "Active" | "Closed")}
              className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
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
              <label className="block text-sm font-medium text-black">PM (Project Manager)</label>
              <select
                multiple
                value={pmPersonIds}
                onChange={(e) => {
                  const opts = Array.from(e.target.selectedOptions, (o) => o.value);
                  setPmPersonIds(opts);
                }}
                className="mt-1 block w-full border border-gray-300 rounded px-3 py-2 min-h-[80px]"
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
              <label className="block text-sm font-medium text-black">PGM (Program Manager)</label>
              <select
                value={pgmPersonId}
                onChange={(e) => setPgmPersonId(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
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
              <label className="block text-sm font-medium text-black">CAD</label>
              <select
                value={cadPersonId}
                onChange={(e) => setCadPersonId(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
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
              <label className="block text-sm font-medium text-black">Under-resourced threshold (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={actualsLowThresholdPercent}
                onChange={(e) => setActualsLowThresholdPercent(e.target.value)}
                placeholder="10"
                className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-0.5">If actual is lower than resourced by more than this %, cell is purple. Default: 10.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-black">Over-resourced threshold (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={actualsHighThresholdPercent}
                onChange={(e) => setActualsHighThresholdPercent(e.target.value)}
                placeholder="5"
                className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-0.5">If actual is higher than resourced by more than this %, cell is red. Default: 5.</p>
            </div>
          </div>
          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Save
            </button>
            <Link
              href={`/projects/${id}`}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
