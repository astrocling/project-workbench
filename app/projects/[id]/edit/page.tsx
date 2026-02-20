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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => r.json())
      .then((p) => {
        setName(p.name ?? "");
        setClientName(p.clientName ?? "");
        setStartDate(p.startDate ? new Date(p.startDate).toISOString().slice(0, 10) : "");
        setEndDate(p.endDate ? new Date(p.endDate).toISOString().slice(0, 10) : "");
        setStatus(p.status ?? "Active");
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
