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
    <div className="min-h-screen bg-surface-50 dark:bg-dark-bg">
      <header className="bg-white/80 dark:bg-dark-bg/90 backdrop-blur-md border-b border-surface-200 dark:border-dark-border px-6 py-4">
        <Link href="/projects" className="text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 font-medium">
          ← Projects
        </Link>
      </header>
      <main className="p-8 max-w-xl">
        <h1 className="text-display-md font-bold text-surface-900 dark:text-white mb-6">New Project</h1>
        <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-dark-surface p-6 rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark">
          {error && (
            <p className="text-body-sm text-jred-700 dark:text-jred-400 bg-jred-50 dark:bg-jred-900/20 p-3 rounded-md">{error}</p>
          )}
          <div>
            <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">Name</label>
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
                  className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
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
                    className="block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
                  />
                )}
              </div>
            ) : (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Project name"
                className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
              />
            )}
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
            <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">PM (Project Manager)</label>
            <select
              multiple
              value={pmPersonIds}
              onChange={(e) => {
                const opts = Array.from(e.target.selectedOptions, (o) => o.value);
                setPmPersonIds(opts);
              }}
              className="mt-1 block w-full h-auto min-h-[80px] px-3 py-2 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
              title="Hold Ctrl/Cmd to select multiple"
            >
              {eligiblePeople.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="text-label-md text-surface-500 dark:text-surface-400 mt-0.5">Eligible: Director or Project Manager. Hold Ctrl/Cmd to select multiple.</p>
          </div>
          <div>
            <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">PGM (Program Manager)</label>
            <select
              value={pgmPersonId}
              onChange={(e) => setPgmPersonId(e.target.value)}
              className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
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
            <label className="block text-body-sm font-semibold text-surface-800 dark:text-surface-100">CAD</label>
            <select
              value={cadPersonId}
              onChange={(e) => setCadPersonId(e.target.value)}
              className="mt-1 block w-full h-9 px-3 rounded-md text-body-sm bg-white dark:bg-dark-raised border border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400"
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
          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              className="h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 text-white font-semibold text-body-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
            >
              Create
            </button>
            <Link
              href="/projects"
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
