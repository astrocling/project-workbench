"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<"Active" | "Closed">("Active");
  const [error, setError] = useState("");
  const [floatProjectNames, setFloatProjectNames] = useState<string[]>([]);
  const [floatProjectClients, setFloatProjectClients] = useState<Record<string, string>>({});
  const [selectedFloatProject, setSelectedFloatProject] = useState("");
  const [eligiblePeople, setEligiblePeople] = useState<{ id: string; name: string }[]>([]);
  const [pmPersonIds, setPmPersonIds] = useState<string[]>([]);
  const [pgmPersonId, setPgmPersonId] = useState("");
  const [cadPersonId, setCadPersonId] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/people/eligible-key-roles").then((r) => r.json()),
    ])
      .then(([data, people]) => {
        setFloatProjectNames(data.floatProjectNames ?? []);
        setFloatProjectClients(data.floatProjectClients ?? {});
        setEligiblePeople(Array.isArray(people) ? people : []);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        clientName,
        startDate: new Date(startDate).toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : null,
        status,
        floatProjectName: selectedFloatProject || undefined,
        pmPersonIds: pmPersonIds.filter(Boolean),
        pgmPersonId: pgmPersonId || undefined,
        cadPersonId: cadPersonId || undefined,
      }),
    });
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    const project = await res.json();
    router.push(`/projects/${project.id}`);
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <Link href="/projects" className="text-blue-600 hover:underline">
          ← Projects
        </Link>
      </header>
      <main className="p-6 max-w-xl">
        <h1 className="text-xl font-semibold mb-6">New Project</h1>
        <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded border">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
          )}
          <div>
            <label className="block text-sm font-medium text-black">Name</label>
            {floatProjectNames.length > 0 ? (
              <div className="space-y-2">
                <select
                  value={
                    selectedFloatProject && floatProjectNames.includes(selectedFloatProject)
                      ? selectedFloatProject
                      : name && floatProjectNames.includes(name)
                        ? name
                        : name
                          ? "__custom__"
                          : ""
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "__custom__") {
                      setSelectedFloatProject("");
                      setName("");
                      setClientName("");
                    } else {
                      setSelectedFloatProject(v);
                      setName(v);
                      setClientName(floatProjectClients[v] ?? "");
                    }
                  }}
                  className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
                >
                  <option value="">Select from Float projects...</option>
                  {floatProjectNames.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                  <option value="__custom__">— Or enter custom name —</option>
                </select>
                {!(selectedFloatProject && floatProjectNames.includes(selectedFloatProject)) && (
                  <input
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setSelectedFloatProject("");
                    }}
                    placeholder="Type project name"
                    required
                    className="block w-full border border-gray-300 rounded px-3 py-2"
                  />
                )}
              </div>
            ) : (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Project name"
                className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
              />
            )}
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
            <p className="text-xs text-gray-500 mt-0.5">Eligible: Director or Project Manager. Hold Ctrl/Cmd to select multiple.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-black">PGM (Program Manager)</label>
            <select
              value={pgmPersonId}
              onChange={(e) => setPgmPersonId(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value="">— Select (optional) —</option>
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
              <option value="">— Select (optional) —</option>
              {eligiblePeople.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
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
          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Create
            </button>
            <Link
              href="/projects"
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
