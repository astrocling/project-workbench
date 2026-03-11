"use client";

import { useRouter } from "next/navigation";

type DashboardClientFilterProps = {
  clientsInScope: string[];
  selectedClient: string | null;
  basePath: string;
};

export function DashboardClientFilter({
  clientsInScope,
  selectedClient,
  basePath,
}: DashboardClientFilterProps) {
  const router = useRouter();

  if (clientsInScope.length === 0) {
    return null;
  }

  const value = selectedClient ?? "";

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    if (!v) {
      router.push(basePath);
    } else {
      router.push(`${basePath}?client=${encodeURIComponent(v)}`);
    }
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <select
        id="dashboard-client-filter"
        value={value}
        onChange={handleChange}
        className="rounded-md border border-surface-300 dark:border-dark-border bg-white dark:bg-dark-surface px-3 py-2 text-body-sm text-surface-900 dark:text-white focus:border-jblue-500 focus:outline-none focus:ring-1 focus:ring-jblue-500"
        aria-label="Filter by client"
        title="Filter by client"
      >
        <option value="">All clients</option>
        {clientsInScope.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}
