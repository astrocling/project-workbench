"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

export type MonthlyRecoveryRow = {
  monthKey: string;
  monthLabel: string;
  forecastDollars: number;
  actualDollars: number;
  recoveryPercent: number | null;
  overallRecoveryPercent: number | null;
};

const CHART_COLORS = {
  bar: "#1941FA",
  line: "#F00A0A",
  gridStroke: "#E2E5EC",
  gridStrokeDark: "#1E2E47",
  axisFill: "#64708A",
};

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatDollars(dollars: number): string {
  return dollars.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function RevenueRecoveryChart({
  monthly,
}: {
  monthly: MonthlyRecoveryRow[];
}) {
  if (monthly.length === 0) {
    return (
      <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-5">
        <p className="text-title-md font-semibold text-surface-800 dark:text-surface-100 mb-2">
          Revenue recovery by month
        </p>
        <p className="text-body-sm text-surface-500 dark:text-surface-400">
          No monthly data yet
        </p>
      </div>
    );
  }

  const data = monthly.map((row) => ({
    ...row,
    recoveryPercent: row.recoveryPercent ?? 0,
    overallRecoveryPercent: row.overallRecoveryPercent ?? 0,
  }));

  const maxPct = Math.max(
    100,
    ...data.flatMap((d) => [
      d.recoveryPercent,
      d.overallRecoveryPercent,
    ].filter(Number.isFinite))
  );
  const yMax = Math.ceil(maxPct / 25) * 25 || 125;
  const yDomain: [number, number] = [0, yMax];
  const yTicks = Array.from(
    { length: yMax / 25 + 1 },
    (_, i) => i * 25
  );

  return (
    <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-5">
      <p className="text-title-md font-semibold text-surface-800 dark:text-surface-100 mb-5">
        Revenue recovery by month
      </p>
      <div className="w-full" style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
          >
            <CartesianGrid
              strokeDasharray="4 3"
              stroke={CHART_COLORS.gridStroke}
              vertical={false}
            />
            <XAxis
              dataKey="monthLabel"
              tick={{ fill: CHART_COLORS.axisFill, fontSize: 12, fontFamily: "Raleway, sans-serif" }}
              axisLine={{ stroke: CHART_COLORS.gridStroke }}
              tickLine={false}
            />
            <YAxis
              domain={yDomain}
              ticks={yTicks}
              tickFormatter={formatPct}
              tick={{ fill: CHART_COLORS.axisFill, fontSize: 12, fontFamily: "Raleway, sans-serif" }}
              axisLine={{ stroke: CHART_COLORS.gridStroke }}
              tickLine={false}
            />
            <ReferenceLine
              y={80}
              stroke={CHART_COLORS.axisFill}
              strokeDasharray="4 3"
              strokeOpacity={0.8}
            />
            <ReferenceLine
              y={100}
              stroke={CHART_COLORS.axisFill}
              strokeDasharray="4 3"
              strokeOpacity={0.8}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-surface-100, #f1f5f9)",
                border: "1px solid var(--color-surface-200, #e2e8f0)",
                borderRadius: "0.5rem",
                boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
                padding: "0.625rem 0.75rem",
              }}
              labelStyle={{
                fontWeight: 600,
                color: "var(--color-surface-800, #1e293b)",
                marginBottom: "0.375rem",
              }}
              formatter={(value, name) => [
                typeof value === "number" ? formatPct(value) : "—",
                name ?? "",
              ]}
              labelFormatter={(label) => label}
            />
            <Bar
              dataKey="recoveryPercent"
              name="Recovery %"
              fill={CHART_COLORS.bar}
              radius={[2, 2, 0, 0]}
            />
            <Line
              type="monotone"
              dataKey="overallRecoveryPercent"
              name="Overall recovery %"
              stroke={CHART_COLORS.line}
              strokeWidth={2}
              dot={{ fill: CHART_COLORS.line, r: 3 }}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
