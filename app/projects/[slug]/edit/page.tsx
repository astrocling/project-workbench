"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { getSessionPermissionLevel, canAccessAdmin, canEditProject } from "@/lib/auth";
import { PersonCombobox, PersonMultiCombobox } from "@/components/PersonCombobox";

export default function EditProjectPage() {
  const router = useRouter();
  const params = useParams();
  const { data: session } = useSession();
  const slug = params.slug as string;
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
  const [sowLink, setSowLink] = useState("");
  const [estimateLink, setEstimateLink] = useState("");
  const [floatLink, setFloatLink] = useState("");
  const [metricLink, setMetricLink] = useState("");
  const [eligiblePeople, setEligiblePeople] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [backfillingFloat, setBackfillingFloat] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${slug}`).then((r) => r.json()),
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
        const keyRoles = (p.projectKeyRoles ?? []) as { type: string; personId: string; person: { id: string; name: string } }[];
        setPmPersonIds(keyRoles.filter((kr) => kr.type === "PM").map((kr) => kr.personId));
        setPgmPersonId(keyRoles.find((kr) => kr.type === "PGM")?.personId ?? "");
        setCadPersonId(keyRoles.find((kr) => kr.type === "CAD")?.personId ?? "");
        setSowLink(p.sowLink ?? "");
        setEstimateLink(p.estimateLink ?? "");
        setFloatLink(p.floatLink ?? "");
        setMetricLink(p.metricLink ?? "");
        const eligible = Array.isArray(people) ? people : [];
        const currentIds = new Set(eligible.map((x: { id: string }) => x.id));
        const fromRoles = keyRoles
          .map((kr) => kr.person)
          .filter((p) => p && !currentIds.has(p.id));
        setEligiblePeople(
          [...eligible, ...fromRoles].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
        );
      })
      .finally(() => setLoading(false));
  }, [slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch(`/api/projects/${slug}`, {
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
        sowLink: sowLink.trim() || null,
        estimateLink: estimateLink.trim() || null,
        floatLink: floatLink.trim() || null,
        metricLink: metricLink.trim() || null,
      }),
    });
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    const data = await res.json();
    router.push(`/projects/${data.slug ?? slug}`);
    router.refresh();
  }

  async function backfillFloat() {
    if (!canEdit || backfillingFloat) return;
    setBackfillingFloat(true);
    try {
      const res = await fetch(`/api/projects/${slug}/backfill-float`, { method: "POST" });
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

  let permissionLevel: ReturnType<typeof getSessionPermissionLevel> | undefined;
  try {
    const user = session?.user;
    permissionLevel = user != null ? getSessionPermissionLevel(user as { permissions?: string; role?: string }) : undefined;
  } catch {
    permissionLevel = undefined;
  }
  const canEdit = canEditProject(permissionLevel);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-dark-bg flex items-center justify-center">
        <p className="text-body-sm text-surface-500 dark:text-surface-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-dark-bg">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-white/80 dark:bg-dark-bg/90 backdrop-blur-md border-b border-surface-200 dark:border-dark-border px-6 py-4">
        <Link href={`/projects/${slug}`} className="text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 font-medium">
          ← Back to project
        </Link>
        <div className="flex gap-4 items-center">
          {canAccessAdmin(permissionLevel) && (
            <Link
              href="/admin/float-import"
              className="text-body-sm text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 font-medium"
            >
              Admin
            </Link>
          )}
          <Link
            href="/api/auth/signout"
            className="text-body-sm text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 font-medium"
          >
            Sign out
          </Link>
        </div>
      </header>
      <main className="p-8 max-w-2xl">
        <h1 className="text-display-md font-bold text-surface-900 dark:text-white mb-6">Edit Project</h1>
        <form id="edit-project-form" onSubmit={handleSubmit} className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark">
          <nav className="px-6 pt-6 pb-4 border-b border-surface-200 dark:border-dark-border" aria-label="Settings sections">
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-body-sm">
              <li><a href="#project-details" className="text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 font-medium">Details</a></li>
              <li><a href="#links" className="text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 font-medium">Links</a></li>
              <li><a href="#key-roles" className="text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 font-medium">Key roles</a></li>
              <li><a href="#resourcing" className="text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 font-medium">Resourcing</a></li>
            </ul>
          </nav>
          <div className="p-6 space-y-8">
            {error && (
              <p className="text-body-sm text-jred-700 dark:text-jred-400 bg-jred-50 dark:bg-jred-900/20 p-3 rounded-md">{error}</p>
            )}
            <section id="project-details" className="space-y-4">
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
            </section>

            <section id="links" className="border-t border-surface-200 dark:border-dark-border pt-6 space-y-4">
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

            <section id="key-roles" className="border-t border-surface-200 dark:border-dark-border pt-6 space-y-4">
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
            </section>
            <section id="resourcing" className="border-t border-surface-200 dark:border-dark-border pt-6 space-y-4">
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
            <section id="actions" className="border-t border-surface-200 dark:border-dark-border pt-6">
              <div className="flex gap-2 flex-wrap items-center">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 text-white font-semibold text-body-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
                >
                  Save
                </button>
                <Link
                  href={`/projects/${slug}`}
                  className="inline-flex items-center justify-center h-9 px-4 rounded-md border border-surface-300 dark:border-dark-muted bg-transparent hover:bg-surface-100 dark:hover:bg-dark-raised text-surface-700 dark:text-surface-200 font-medium text-body-sm"
                >
                  Cancel
                </Link>
                {canEdit && (
                  <button
                    type="button"
                    onClick={backfillFloat}
                    disabled={backfillingFloat}
                    title="Import float hour data from the last CSV upload for this project"
                    className="inline-flex items-center justify-center h-9 px-4 rounded-md border border-surface-300 dark:border-dark-muted bg-transparent hover:bg-surface-100 dark:hover:bg-dark-raised text-surface-700 dark:text-surface-200 font-medium text-body-sm disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
                  >
                    {backfillingFloat ? "Backfilling…" : "Backfill float data"}
                  </button>
                )}
              </div>
            </section>
          </div>
        </form>
        <div className="sticky bottom-0 left-0 right-0 z-20 flex justify-center gap-2 py-3 px-4 bg-white/90 dark:bg-dark-bg/90 backdrop-blur-md border-t border-surface-200 dark:border-dark-border">
          <button
            type="submit"
            form="edit-project-form"
            className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 text-white font-semibold text-body-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
          >
            Save
          </button>
          <Link
            href={`/projects/${slug}`}
            className="inline-flex items-center justify-center h-9 px-4 rounded-md border border-surface-300 dark:border-dark-muted bg-transparent hover:bg-surface-100 dark:hover:bg-dark-raised text-surface-700 dark:text-surface-200 font-medium text-body-sm"
          >
            Cancel
          </Link>
          {canEdit && (
            <button
              type="button"
              onClick={backfillFloat}
              disabled={backfillingFloat}
              title="Import float hour data from the last CSV upload for this project"
              className="inline-flex items-center justify-center h-9 px-4 rounded-md border border-surface-300 dark:border-dark-muted bg-transparent hover:bg-surface-100 dark:hover:bg-dark-raised text-surface-700 dark:text-surface-200 font-medium text-body-sm disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
            >
              {backfillingFloat ? "Backfilling…" : "Backfill float data"}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
