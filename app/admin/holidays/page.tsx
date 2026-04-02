"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { allUtcYmdsFromHolidayRow, regionIdFromHolidayRow } from "@/lib/float/excludedDays";
import { floatRegionLabelFromHolidayRow } from "@/lib/float/regionLabel";

type HolidayPayload = {
  startDate: string;
  endDate: string;
  publicHolidays: Record<string, unknown>[];
  teamHolidays: Record<string, unknown>[];
};

/** YYYY-MM-DD → MM-DD-YYYY */
function ymdToMmDdYyyy(ymd: string): string {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return ymd;
  return `${m[2]}-${m[3]}-${m[1]}`;
}

function formatHolidayDatesCell(row: Record<string, unknown>): string {
  const ymds = allUtcYmdsFromHolidayRow(row);
  if (ymds.length === 0) return "—";
  return ymds.map(ymdToMmDdYyyy).join(", ");
}

const HOLIDAY_ID_KEYS = ["id", "holiday_id", "holidayId", "public_holiday_id", "publicHolidayId"] as const;

function holidayRecordId(row: Record<string, unknown>): string {
  for (const k of HOLIDAY_ID_KEYS) {
    const v = row[k];
    if (v != null && v !== "") return String(v);
  }
  return "—";
}

function holidayName(row: Record<string, unknown>): string {
  const n = row.name ?? row.title;
  if (typeof n === "string" && n.trim()) return n.trim();
  return "—";
}

function holidayRegionDisplay(row: Record<string, unknown>): string {
  const wb = row.workbench_region_label;
  if (typeof wb === "string" && wb.trim()) return wb.trim();
  const label = floatRegionLabelFromHolidayRow(row);
  if (label) return label;
  const rid = regionIdFromHolidayRow(row);
  return rid != null ? String(rid) : "—";
}

/** Earliest UTC YYYY-MM-DD for sorting (list from {@link allUtcYmdsFromHolidayRow} is already sorted). */
function earliestYmdForSort(row: Record<string, unknown>): string | null {
  const ymds = allUtcYmdsFromHolidayRow(row);
  return ymds.length > 0 ? ymds[0]! : null;
}

function sortHolidayRowsByDate(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return [...rows].sort((a, b) => {
    const ya = earliestYmdForSort(a);
    const yb = earliestYmdForSort(b);
    if (ya == null && yb == null) return holidayName(a).localeCompare(holidayName(b));
    if (ya == null) return 1;
    if (yb == null) return -1;
    const c = ya.localeCompare(yb);
    return c !== 0 ? c : holidayName(a).localeCompare(holidayName(b));
  });
}

function HolidayTable({ title, rows }: { title: string; rows: Record<string, unknown>[] }) {
  const sortedRows = useMemo(() => sortHolidayRowsByDate(rows), [rows]);

  if (rows.length === 0) {
    return (
      <div className="mt-4">
        <h2 className="text-title-md font-semibold text-surface-800 dark:text-surface-100 mb-2">{title}</h2>
        <p className="text-body-sm text-surface-600 dark:text-surface-300">No rows returned for this window.</p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h2 className="text-title-md font-semibold text-surface-800 dark:text-surface-100 mb-3">{title}</h2>
      <div className="overflow-x-auto rounded-lg border border-surface-200 dark:border-dark-border">
        <table className="w-full text-body-sm border-collapse min-w-[640px]">
          <thead>
            <tr className="bg-surface-50 dark:bg-dark-raised border-b border-surface-200 dark:border-dark-border">
              <th className="text-left px-3 py-2 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
                Date
              </th>
              <th className="text-left px-3 py-2 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
                Name
              </th>
              <th className="text-left px-3 py-2 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold whitespace-nowrap">
                ID
              </th>
              <th className="text-left px-3 py-2 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
                Region
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => (
              <tr
                key={`${holidayRecordId(row)}-${i}`}
                className="border-b border-surface-100 dark:border-dark-border/60 last:border-0 hover:bg-jblue-500/[0.03] dark:hover:bg-jblue-500/[0.06]"
              >
                <td className="px-3 py-2 text-surface-700 dark:text-surface-200 align-top max-w-md whitespace-normal">
                  {formatHolidayDatesCell(row)}
                </td>
                <td className="px-3 py-2 text-surface-700 dark:text-surface-200 align-top whitespace-nowrap max-w-[280px] truncate" title={holidayName(row)}>
                  {holidayName(row)}
                </td>
                <td className="px-3 py-2 text-surface-700 dark:text-surface-200 align-top whitespace-nowrap font-mono text-body-xs">
                  {holidayRecordId(row)}
                </td>
                <td className="px-3 py-2 text-surface-700 dark:text-surface-200 align-top whitespace-nowrap max-w-[240px] truncate" title={holidayRegionDisplay(row)}>
                  {holidayRegionDisplay(row)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminHolidaysPage() {
  const [data, setData] = useState<HolidayPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetch("/api/admin/float-holidays")
      .then(async (r) => {
        const j = (await r.json()) as Record<string, unknown>;
        if (!r.ok) {
          const msg = typeof j.error === "string" ? j.error : "Request failed";
          const det = typeof j.details === "string" ? j.details : "";
          throw new Error(det ? `${msg}: ${det}` : msg);
        }
        return j as HolidayPayload;
      })
      .then(setData)
      .catch((e: Error) => setError(e.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="p-8 text-body-sm text-surface-700 dark:text-surface-200">Loading Float holidays…</p>;
  }

  return (
    <>
      <div className="px-6 pt-4 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-display-md font-bold text-surface-900 dark:text-white">Float holidays</h1>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-jblue-500 hover:bg-jblue-700 text-white font-semibold text-body-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jblue-400 focus-visible:ring-offset-2"
        >
          Reload
        </button>
      </div>
      <main className="p-8 max-w-[1200px]">
        {error && (
          <p className="text-body-sm text-jred-700 dark:text-jred-400 bg-jred-50 dark:bg-jred-900/20 p-3 rounded-md mb-4">{error}</p>
        )}
        {data && (
          <p className="text-body-sm text-surface-700 dark:text-surface-200 mb-2">
            Window: <code className="text-body-xs bg-surface-100 dark:bg-dark-muted px-1 rounded">{data.startDate}</code>{" "}
            → <code className="text-body-xs bg-surface-100 dark:bg-dark-muted px-1 rounded">{data.endDate}</code> (UTC,
            inclusive). Same default range as Float sync unless you add query params later.
          </p>
        )}
        {data && (
          <>
            <HolidayTable title="Public holidays" rows={data.publicHolidays} />
            <HolidayTable title="Team holidays" rows={data.teamHolidays} />
          </>
        )}
      </main>
    </>
  );
}
