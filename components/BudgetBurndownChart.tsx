"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  BudgetBurndownMonthPoint,
  BudgetBurndownSeries,
  BudgetBurndownWeekPoint,
} from "@/lib/budgetCalculations";

const CHART_COLORS = {
  barActual: "#1941FA",
  barProjected: "#8BA3FC",
  barMissing: "#94A3B8",
  lineForecast: "#F00A0A",
  linePlan: "#64708A",
  gridStroke: "#E2E5EC",
  axisFill: "#64708A",
};

type Grain = "week" | "month";

type ChartRow = {
  xKey: string;
  label: string;
  periodDollars: number;
  periodHours: number;
  plannedDollars: number;
  plannedHours: number;
  actualDollars: number | null;
  actualHours: number | null;
  cumulativePlanDollars: number;
  cumulativeActualForecastDollars: number;
  remainingVsHighDollars: number | null;
  isProjected: boolean;
  isMissingActuals: boolean;
  isMixed: boolean;
};

function roundToQuarter(hours: number): number {
  return Math.round(hours * 4) / 4;
}

function formatHours(hours: number): string {
  return roundToQuarter(hours).toFixed(2).replace(/\.?0+$/, "");
}

function formatDollars(dollars: number): string {
  return dollars.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatAxisDollars(dollars: number): string {
  const abs = Math.abs(dollars);
  if (abs >= 10000) return `$${Math.round(dollars / 1000)}k`;
  if (abs >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return `$${Math.round(dollars)}`;
}

function barFill(row: ChartRow): string {
  if (row.isMissingActuals) return CHART_COLORS.barMissing;
  if (row.isProjected || row.isMixed) return CHART_COLORS.barProjected;
  return CHART_COLORS.barActual;
}

function weekToRow(w: BudgetBurndownWeekPoint): ChartRow {
  return {
    xKey: w.weekStartDate,
    label: w.label,
    periodDollars: w.periodDollars,
    periodHours: w.periodHours,
    plannedDollars: w.plannedDollars,
    plannedHours: w.plannedHours,
    actualDollars: w.actualDollars,
    actualHours: w.actualHours,
    cumulativePlanDollars: w.cumulativePlanDollars,
    cumulativeActualForecastDollars: w.cumulativeActualForecastDollars,
    remainingVsHighDollars: w.remainingVsHighDollars,
    isProjected: w.isProjected,
    isMissingActuals: w.isMissingActuals,
    isMixed: false,
  };
}

function monthToRow(m: BudgetBurndownMonthPoint): ChartRow {
  return {
    xKey: m.monthKey,
    label: m.label,
    periodDollars: m.periodDollars,
    periodHours: m.periodHours,
    plannedDollars: m.plannedDollars,
    plannedHours: m.plannedHours,
    actualDollars: m.actualDollars,
    actualHours: m.actualHours,
    cumulativePlanDollars: m.cumulativePlanDollars,
    cumulativeActualForecastDollars: m.cumulativeActualForecastDollars,
    remainingVsHighDollars: m.remainingVsHighDollars,
    isProjected: m.isProjected,
    isMissingActuals: m.isMissingActuals,
    isMixed: m.isMixed,
  };
}

function BurndownTooltip({
  active,
  payload,
  grain,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartRow }>;
  grain: Grain;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const variance =
    row.actualDollars != null ? row.actualDollars - row.plannedDollars : null;
  return (
    <div className="rounded-lg border border-surface-200 bg-surface-100 px-3 py-2.5 text-body-sm shadow-lg dark:border-dark-border dark:bg-dark-raised">
      <p className="mb-1.5 font-semibold text-surface-800 dark:text-surface-100">
        {grain === "week" ? `Week of ${row.label}` : row.label}
      </p>
      <dl className="space-y-0.5 tabular-nums text-surface-700 dark:text-surface-200">
        <div className="flex justify-between gap-6">
          <dt>Period actual</dt>
          <dd>
            {row.isMissingActuals
              ? "Missing actuals"
              : row.actualDollars == null
                ? "—"
                : `$${formatDollars(row.actualDollars)} (${formatHours(row.actualHours ?? 0)} hrs)`}
          </dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt>Period planned</dt>
          <dd>
            ${formatDollars(row.plannedDollars)} ({formatHours(row.plannedHours)} hrs)
          </dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt>Period variance</dt>
          <dd>
            {variance == null
              ? "—"
              : `${variance >= 0 ? "+" : "−"}$${formatDollars(Math.abs(variance))}`}
          </dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt>Cumulative actual + plan</dt>
          <dd>${formatDollars(row.cumulativeActualForecastDollars)}</dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt>Cumulative plan</dt>
          <dd>${formatDollars(row.cumulativePlanDollars)}</dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt>Remaining vs contract high</dt>
          <dd>
            {row.remainingVsHighDollars == null
              ? "—"
              : `$${formatDollars(row.remainingVsHighDollars)}`}
          </dd>
        </div>
      </dl>
      {row.isMixed && (
        <p className="mt-2 text-body-sm text-surface-500 dark:text-surface-400">
          This month mixes completed-week actuals with remaining plan.
        </p>
      )}
      {row.isProjected && !row.isMixed && (
        <p className="mt-2 text-body-sm text-surface-500 dark:text-surface-400">
          Projected from remaining plan.
        </p>
      )}
    </div>
  );
}

export function BudgetBurndownChart({
  series,
  compact = false,
}: {
  series: BudgetBurndownSeries | null | undefined;
  compact?: boolean;
}) {
  const [grain, setGrain] = useState<Grain>("week");

  const data = useMemo(() => {
    if (!series) return [];
    return grain === "week" ? series.weeks.map(weekToRow) : series.months.map(monthToRow);
  }, [series, grain]);

  const asOfKey =
    grain === "week" ? series?.asOfWeekStart ?? null : series?.asOfMonthKey ?? null;
  const contractHigh = series?.contractHighDollars ?? 0;

  if (!series || data.length === 0) {
    return (
      <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-5">
        <p className="text-title-md font-semibold text-surface-800 dark:text-surface-100 mb-2">
          Budget Burndown
        </p>
        <p className="text-body-sm text-surface-500 dark:text-surface-400">No weekly data yet</p>
      </div>
    );
  }

  const yMaxRaw = Math.max(
    contractHigh,
    ...data.flatMap((d) => [
      d.periodDollars,
      d.cumulativePlanDollars,
      d.cumulativeActualForecastDollars,
    ])
  );
  const yMax = yMaxRaw > 0 ? yMaxRaw * 1.08 : 1;
  const tickInterval = data.length > 16 ? Math.ceil(data.length / 12) - 1 : 0;

  return (
    <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <p className="text-title-md font-semibold text-surface-800 dark:text-surface-100">
          Budget Burndown
        </p>
        <div
          className="inline-flex rounded-md border border-surface-300 dark:border-dark-muted overflow-hidden"
          aria-label="Burndown time grain"
        >
          {(["week", "month"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setGrain(mode)}
              className={`px-2.5 py-1 text-body-sm font-medium capitalize ${
                grain === mode
                  ? "bg-surface-800 text-white dark:bg-surface-200 dark:text-surface-900"
                  : "bg-white text-surface-700 hover:bg-surface-100 dark:bg-dark-surface dark:text-surface-300 dark:hover:bg-dark-raised"
              }`}
              aria-pressed={grain === mode}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>
      <div className="w-full" style={{ height: compact ? 220 : 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid
              strokeDasharray="4 3"
              stroke={CHART_COLORS.gridStroke}
              vertical={false}
            />
            <XAxis
              dataKey="xKey"
              interval={tickInterval}
              tickFormatter={(value) => data.find((d) => d.xKey === value)?.label ?? String(value)}
              tick={{ fill: CHART_COLORS.axisFill, fontSize: 12, fontFamily: "Raleway, sans-serif" }}
              axisLine={{ stroke: CHART_COLORS.gridStroke }}
              tickLine={false}
            />
            <YAxis
              domain={[0, yMax]}
              tickFormatter={formatAxisDollars}
              tick={{ fill: CHART_COLORS.axisFill, fontSize: 12, fontFamily: "Raleway, sans-serif" }}
              axisLine={{ stroke: CHART_COLORS.gridStroke }}
              tickLine={false}
            />
            {contractHigh > 0 && (
              <ReferenceLine
                y={contractHigh}
                stroke={CHART_COLORS.axisFill}
                strokeDasharray="4 3"
                strokeOpacity={0.9}
                label={{
                  value: "Contract high",
                  position: "insideTopLeft",
                  fill: CHART_COLORS.axisFill,
                  fontSize: 11,
                }}
              />
            )}
            {asOfKey && data.some((d) => d.xKey === asOfKey) && (
              <ReferenceLine
                x={asOfKey}
                stroke={CHART_COLORS.axisFill}
                strokeDasharray="3 3"
                strokeOpacity={0.9}
              />
            )}
            <Tooltip content={<BurndownTooltip grain={grain} />} />
            <Legend
              itemSorter={null}
              wrapperStyle={{
                fontSize: 12,
                fontFamily: "Raleway, sans-serif",
                color: CHART_COLORS.axisFill,
              }}
            />
            <Bar
              dataKey="periodDollars"
              name="Period burn (actual / projected)"
              fill={CHART_COLORS.barActual}
              legendType="rect"
              radius={[2, 2, 0, 0]}
            >
              {data.map((row) => (
                <Cell key={row.xKey} fill={barFill(row)} />
              ))}
            </Bar>
            <Line
              type="monotone"
              dataKey="cumulativeActualForecastDollars"
              name="Actual + Plan"
              stroke={CHART_COLORS.lineForecast}
              strokeWidth={2}
              dot={{ fill: CHART_COLORS.lineForecast, r: compact ? 2 : 3 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="cumulativePlanDollars"
              name="Plan"
              stroke={CHART_COLORS.linePlan}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-body-sm text-surface-500 dark:text-surface-400">
        Contract high is the current budget-line sum, not a historical cap. Missing actuals
        leave the actual cumulative incomplete. Float hours are not included.
        {grain === "month" ? " Months use week-start calendar month." : ""}
      </p>
    </div>
  );
}
