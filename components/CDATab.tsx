"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

function roundToQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

function formatHours(hours: number): string {
  const r = roundToQuarter(hours);
  return r.toFixed(2).replace(/\.?0+$/, "") || "0";
}

/** YYYY-MM for the current month (for "previous month" comparison). */
function getCurrentMonthKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

type CdaRow = {
  monthKey: string;
  monthLabel: string;
  planned: number;
  mtdActuals: number;
};

export function CDATab({
  projectId,
  canEdit,
}: {
  projectId: string;
  canEdit: boolean;
}) {
  const [rows, setRows] = useState<CdaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    monthKey: string;
    field: "planned" | "mtdActuals";
    str: string;
  } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setSaveError(null);
    fetch(`/api/projects/${projectId}/cda`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.rows ?? []);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveRows = useCallback(
    async (nextRows: CdaRow[]) => {
      setSaveError(null);
      const res = await fetch(`/api/projects/${projectId}/cda`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: nextRows.map((r) => ({
            monthKey: r.monthKey,
            planned: roundToQuarter(r.planned),
            mtdActuals: roundToQuarter(r.mtdActuals),
          })),
        }),
      });
      if (!res.ok) {
        setSaveError(await res.text());
        return;
      }
      const d = await res.json();
      setRows(d.rows ?? nextRows);
    },
    [projectId]
  );

  const updateCell = useCallback(
    (monthKey: string, field: "planned" | "mtdActuals", value: number) => {
      const next = rows.map((r) =>
        r.monthKey === monthKey ? { ...r, [field]: value } : r
      );
      setRows(next);
      setEditing(null);
      if (canEdit) saveRows(next);
    },
    [rows, canEdit, saveRows]
  );

  const displayValue = (
    row: CdaRow,
    field: "planned" | "mtdActuals"
  ): string => {
    const edit = editing?.monthKey === row.monthKey && editing?.field === field;
    if (edit && editing?.str !== undefined) return editing.str;
    return formatHours(row[field]);
  };

  const remaining = (row: CdaRow) =>
    roundToQuarter(row.planned - row.mtdActuals);

  const totalPlanned = rows.reduce((s, r) => s + r.planned, 0);
  const totalMtdActuals = rows.reduce((s, r) => s + r.mtdActuals, 0);
  const totalRemaining = roundToQuarter(totalPlanned - totalMtdActuals);

  const currentMonthKey = useMemo(() => getCurrentMonthKey(), []);

  /** Percent of total contract (planned) hours completed (actuals). */
  const hoursCompletePercent =
    totalPlanned > 0
      ? Math.min(100, Math.max(0, (totalMtdActuals / totalPlanned) * 100))
      : null;

  const currentMonthRow = rows.find((r) => r.monthKey === currentMonthKey);
  /** Current month: percent of planned hours used (MTD actuals / planned). */
  const currentMonthPercent =
    currentMonthRow && currentMonthRow.planned > 0
      ? Math.min(
          100,
          Math.max(0, (currentMonthRow.mtdActuals / currentMonthRow.planned) * 100)
        )
      : null;

  /** True if this month is in the past (has ended). */
  const isPreviousMonth = (monthKey: string) => monthKey < currentMonthKey;

  /** Future months only (after current). */
  const futureMonthRows = useMemo(
    () => rows.filter((r) => r.monthKey > currentMonthKey),
    [rows, currentMonthKey]
  );
  const futureMonthCount = futureMonthRows.length;
  /** Average remaining hours per future month (remaining spread over future months only). */
  const avgRemainingPerFutureMonth =
    futureMonthCount > 0
      ? roundToQuarter(totalRemaining / futureMonthCount)
      : null;

  if (loading) {
    return (
      <div className="py-8 text-body-sm text-surface-500 dark:text-surface-400">
        Loading…
      </div>
    );
  }

  function DonutChart({
    percent,
    label,
    size = 100,
  }: {
    percent: number | null;
    label: string;
    size?: number;
  }) {
    const r = size * 0.35;
    const stroke = size * 0.15;
    const circumference = 2 * Math.PI * r;
    const clamped = percent == null ? 0 : Math.min(100, Math.max(0, percent));
    const dash = (clamped / 100) * circumference;
    return (
      <div className="flex flex-col items-center gap-1.5">
        <div className="relative" style={{ width: size, height: size }}>
          <svg
            width={size}
            height={size}
            className="-rotate-90"
            aria-hidden
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              className="stroke-surface-200 dark:stroke-dark-muted"
              strokeWidth={stroke}
            />
            {clamped > 0 && (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke="#1941FA"
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${circumference}`}
                strokeLinecap="round"
              />
            )}
          </svg>
          <div
            className="absolute inset-0 flex items-center justify-center text-title-md font-semibold text-surface-900 dark:text-white tabular-nums"
            aria-live="polite"
          >
            {percent != null ? `${percent.toFixed(0)}%` : "—"}
          </div>
        </div>
        <p className="text-label-sm uppercase text-surface-400 dark:text-surface-500 tracking-wider text-center">
          {label}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {saveError && (
        <p className="text-body-sm text-jred-600 dark:text-jred-400 bg-jred-50 dark:bg-jred-900/20 px-3 py-2 rounded-md">
          {saveError}
        </p>
      )}
      <div className="flex flex-wrap items-start gap-6">
        <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border overflow-hidden shadow-card-light dark:shadow-card-dark max-w-lg">
        <table className="w-full min-w-0 text-body-sm border-collapse table-fixed">
          <colgroup>
            <col className="w-24" />
            <col className="w-20" />
            <col className="w-20" />
            <col className="w-20" />
          </colgroup>
          <thead>
            <tr className="bg-surface-50 dark:bg-dark-raised border-b border-surface-200 dark:border-dark-border">
              <th className="text-left px-2 py-2 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
                Month
              </th>
              <th className="text-right px-2 py-2 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
                Planned
              </th>
              <th className="text-right px-2 py-2 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
                MTD Actuals
              </th>
              <th className="text-right px-2 py-2 text-label-sm uppercase tracking-wider text-surface-500 dark:text-surface-400 font-semibold">
                Remaining
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const rem = remaining(row);
              const isNegative = rem < 0;
              const isPast = isPreviousMonth(row.monthKey);
              const plannedEmpty = isPast && row.planned === 0;
              const mtdEmpty = isPast && row.mtdActuals === 0;
              const inputBase =
                "h-8 px-1.5 rounded border text-body-sm w-full max-w-[5rem] text-right focus:outline-none focus:ring-2 focus:ring-jblue-500/30 focus:border-jblue-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
              const inputClass = (highlight: boolean) =>
                `${inputBase} ${
                  highlight
                    ? "bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-surface-800 dark:text-surface-100"
                    : "bg-white dark:bg-dark-raised border-surface-300 dark:border-dark-muted text-surface-800 dark:text-surface-100"
                }`;
              return (
                <tr
                  key={row.monthKey}
                  className="border-b border-surface-100 dark:border-dark-border/60 last:border-0 hover:bg-jblue-500/[0.03] dark:hover:bg-jblue-500/[0.06] transition-colors duration-100"
                >
                  <td className="px-2 py-2 font-medium text-surface-800 dark:text-white truncate">
                    {row.monthLabel}
                  </td>
                  <td
                    className={`px-2 py-2 text-right tabular-nums ${
                      plannedEmpty && !canEdit
                        ? "bg-amber-50 dark:bg-amber-900/20"
                        : ""
                    }`}
                  >
                    {canEdit ? (
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.25}
                        value={displayValue(row, "planned")}
                        onChange={(e) =>
                          setEditing({
                            monthKey: row.monthKey,
                            field: "planned",
                            str: e.target.value,
                          })
                        }
                        onFocus={(e) => e.currentTarget.select()}
                        onBlur={() => {
                          const str = displayValue(row, "planned");
                          const n = parseFloat(str);
                          if (!Number.isFinite(n) || n < 0) {
                            setEditing(null);
                            return;
                          }
                          updateCell(row.monthKey, "planned", roundToQuarter(n));
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            (e.target as HTMLInputElement).blur();
                        }}
                        className={inputClass(plannedEmpty)}
                      />
                    ) : (
                      <span className="text-surface-700 dark:text-surface-200">
                        {formatHours(row.planned)}
                      </span>
                    )}
                  </td>
                  <td
                    className={`px-2 py-2 text-right tabular-nums ${
                      mtdEmpty && !canEdit
                        ? "bg-amber-50 dark:bg-amber-900/20"
                        : ""
                    }`}
                  >
                    {canEdit ? (
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.25}
                        value={displayValue(row, "mtdActuals")}
                        onChange={(e) =>
                          setEditing({
                            monthKey: row.monthKey,
                            field: "mtdActuals",
                            str: e.target.value,
                          })
                        }
                        onFocus={(e) => e.currentTarget.select()}
                        onBlur={() => {
                          const str = displayValue(row, "mtdActuals");
                          const n = parseFloat(str);
                          if (!Number.isFinite(n) || n < 0) {
                            setEditing(null);
                            return;
                          }
                          updateCell(
                            row.monthKey,
                            "mtdActuals",
                            roundToQuarter(n)
                          );
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            (e.target as HTMLInputElement).blur();
                        }}
                        className={inputClass(mtdEmpty)}
                      />
                    ) : (
                      <span className="text-surface-700 dark:text-surface-200">
                        {formatHours(row.mtdActuals)}
                      </span>
                    )}
                  </td>
                  <td
                    className={`px-2 py-2 text-right tabular-nums font-semibold ${
                      isNegative
                        ? "text-jred-600 dark:text-jred-400"
                        : "text-surface-700 dark:text-surface-200"
                    }`}
                  >
                    {isNegative
                      ? `(${formatHours(-rem)})`
                      : formatHours(rem)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-surface-200 dark:border-dark-border bg-surface-100 dark:bg-dark-raised font-medium">
              <td className="px-2 py-2 text-surface-800 dark:text-surface-100">
                Total
              </td>
              <td className="px-2 py-2" />
              <td className="px-2 py-2 text-right tabular-nums font-semibold text-surface-700 dark:text-surface-200">
                {formatHours(totalMtdActuals)}
              </td>
              <td
                className={`px-2 py-2 text-right tabular-nums font-semibold ${
                  totalRemaining < 0
                    ? "text-jred-600 dark:text-jred-400"
                    : "text-surface-700 dark:text-surface-200"
                }`}
              >
                {totalRemaining < 0
                  ? `(${formatHours(-totalRemaining)})`
                  : formatHours(totalRemaining)}
              </td>
            </tr>
          </tfoot>
        </table>
        </div>
        <div className="flex flex-col gap-4 shrink-0 rounded-lg border border-surface-200 dark:border-dark-border bg-white dark:bg-dark-surface px-6 py-4 shadow-card-light dark:shadow-card-dark">
          <div className="flex items-center gap-8">
            <DonutChart
              percent={hoursCompletePercent}
              label="Hours complete (contract)"
            />
            <DonutChart
              percent={currentMonthPercent}
              label="Current month (used vs planned)"
              size={100}
            />
          </div>
          <div className="border-t border-surface-200 dark:border-dark-border pt-3">
            <p className="text-label-sm uppercase text-surface-400 dark:text-surface-500 tracking-wider">
              Avg remaining per future month
            </p>
            <p
              className={`text-title-md font-semibold tabular-nums mt-0.5 ${
                avgRemainingPerFutureMonth != null && avgRemainingPerFutureMonth < 0
                  ? "text-jred-600 dark:text-jred-400"
                  : "text-surface-900 dark:text-white"
              }`}
            >
              {avgRemainingPerFutureMonth != null
                ? `${avgRemainingPerFutureMonth < 0 ? "(" : ""}${formatHours(Math.abs(avgRemainingPerFutureMonth))}${avgRemainingPerFutureMonth < 0 ? ")" : ""} hrs${futureMonthCount > 0 ? ` (${futureMonthCount} months)` : ""}`
                : "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
