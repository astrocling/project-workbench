"use client";

import { useState, useEffect } from "react";
import { RevenueRecoveryChart, type MonthlyRecoveryRow } from "@/components/RevenueRecoveryChart";

function formatDollars(dollars: number): string {
  return dollars.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function RevenueRecoveryPieChart({
  recoveryPercent,
}: {
  recoveryPercent: number | null;
}) {
  const size = 160;
  const r = 56;
  const stroke = 24;
  const circumference = 2 * Math.PI * r;
  const clamped =
    recoveryPercent == null ? 0 : Math.max(0, recoveryPercent);
  const dash = (Math.min(100, clamped) / 100) * circumference;

  const strokeColor =
    recoveryPercent != null && recoveryPercent > 100
      ? "#f97316" // orange
      : recoveryPercent != null && recoveryPercent >= 85
        ? "#22c55e" // green
        : recoveryPercent != null && recoveryPercent >= 80
          ? "#eab308" // yellow
          : recoveryPercent != null && recoveryPercent >= 0
            ? "#ff3f3f" // red
            : "#9aa3b2"; // neutral gray when null

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#E2E5EC"
            strokeWidth={stroke}
          />
          {clamped > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={strokeColor}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${circumference}`}
              strokeLinecap="round"
            />
          )}
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center text-title-lg font-semibold text-surface-900 dark:text-white tabular-nums"
          aria-live="polite"
        >
          {recoveryPercent != null
            ? `${recoveryPercent.toFixed(1)}%`
            : "—"}
        </div>
      </div>
      <p className="text-label-md uppercase text-surface-400 dark:text-surface-500 tracking-wider text-center">
        Recovery
      </p>
    </div>
  );
}

type WeekData = {
  weekStartDate: string;
  forecastDollars: number;
  actualDollars: number;
  recoveryPercent: number | null;
  dollarsDelta: number;
};

function formatWeekLabelShort(weekStartDate: string): string {
  if (!weekStartDate) return "—";
  const d = new Date(weekStartDate + "T12:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getRecoveryColorClass(recoveryPercent: number | null): string {
  if (recoveryPercent == null) return "text-surface-600 dark:text-surface-300";
  if (recoveryPercent > 100) return "text-orange-600 dark:text-orange-400";
  if (recoveryPercent >= 85) return "text-green-600 dark:text-green-400";
  if (recoveryPercent >= 80) return "text-amber-600 dark:text-amber-400";
  return "text-jred-600 dark:text-jred-400";
}

function RecoveryCardContent({ data }: { data: WeekData }) {
  const dollarsDelta = data.dollarsDelta;
  const deltaLabel =
    dollarsDelta > 0
      ? `$${formatDollars(Math.abs(dollarsDelta))} above forecast`
      : dollarsDelta < 0
        ? `$${formatDollars(Math.abs(dollarsDelta))} below forecast`
        : "On forecast";

  const deltaColorClass = getRecoveryColorClass(data.recoveryPercent);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
      <RevenueRecoveryPieChart recoveryPercent={data.recoveryPercent} />
      <div className="flex flex-col gap-1">
        <p className="text-body-sm text-surface-600 dark:text-surface-300">
          Forecast: ${formatDollars(data.forecastDollars)}
        </p>
        <p className="text-body-sm text-surface-600 dark:text-surface-300">
          Actual: ${formatDollars(data.actualDollars)}
        </p>
        <p className={`text-label-md font-semibold ${deltaColorClass}`}>
          {deltaLabel}
        </p>
      </div>
    </div>
  );
}

type ToDateData = {
  forecastDollars: number;
  actualDollars: number;
  recoveryPercent: number | null;
  dollarsDelta: number;
};

export function RevenueRecoveryCard({ projectId }: { projectId: string }) {
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [toDate, setToDate] = useState<ToDateData | null>(null);
  const [monthly, setMonthly] = useState<MonthlyRecoveryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/revenue-recovery`)
      .then((r) => r.json())
      .then((d) => {
        setWeeks(d.weeks ?? []);
        setToDate(d.toDate ?? null);
        setMonthly(d.monthly ?? []);
      })
      .catch(() => {
        setWeeks([]);
        setToDate(null);
        setMonthly([]);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading)
    return (
      <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-5 hover:shadow-card-hover hover:border-jblue-200 dark:hover:border-jblue-500/30 transition-all duration-200">
        <p className="text-body-sm text-surface-500 dark:text-surface-400">
          Loading revenue recovery…
        </p>
      </div>
    );

  const thisWeek = weeks[0];
  const combined = weeks.reduce(
    (acc, w) => ({
      forecastDollars: acc.forecastDollars + w.forecastDollars,
      actualDollars: acc.actualDollars + w.actualDollars,
    }),
    { forecastDollars: 0, actualDollars: 0 }
  );
  const prevFourWeeks: WeekData = {
    weekStartDate: "",
    forecastDollars: combined.forecastDollars,
    actualDollars: combined.actualDollars,
    recoveryPercent:
      combined.forecastDollars > 0
        ? (combined.actualDollars / combined.forecastDollars) * 100
        : null,
    dollarsDelta: combined.actualDollars - combined.forecastDollars,
  };

  const toDateData: WeekData | null = toDate
    ? {
        weekStartDate: "",
        forecastDollars: toDate.forecastDollars,
        actualDollars: toDate.actualDollars,
        recoveryPercent: toDate.recoveryPercent,
        dollarsDelta: toDate.dollarsDelta,
      }
    : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {toDateData && (
        <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-5 hover:shadow-card-hover hover:border-jblue-200 dark:hover:border-jblue-500/30 transition-all duration-200">
          <p className="text-title-md font-semibold text-surface-800 dark:text-surface-100 mb-2">
            Revenue recovery
          </p>
          <p className="text-body-sm text-surface-500 dark:text-surface-400 mb-3 flex items-center gap-2 flex-wrap">
            To date
          </p>
          <RecoveryCardContent data={toDateData} />
        </div>
      )}
      {thisWeek && (
        <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-5 hover:shadow-card-hover hover:border-jblue-200 dark:hover:border-jblue-500/30 transition-all duration-200">
          <p className="text-title-md font-semibold text-surface-800 dark:text-surface-100 mb-2">
            Revenue recovery
          </p>
          <p className="text-body-sm text-surface-500 dark:text-surface-400 mb-3 flex items-center gap-2 flex-wrap">
            This week {formatWeekLabelShort(thisWeek.weekStartDate)}
          </p>
          <RecoveryCardContent data={thisWeek} />
        </div>
      )}
      <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border shadow-card-light dark:shadow-card-dark p-5 hover:shadow-card-hover hover:border-jblue-200 dark:hover:border-jblue-500/30 transition-all duration-200">
        <p className="text-title-md font-semibold text-surface-800 dark:text-surface-100 mb-2">
          Revenue recovery
        </p>
        <p className="text-body-sm text-surface-500 dark:text-surface-400 mb-3 flex items-center gap-2 flex-wrap">
          Previous 4 weeks
        </p>
        <RecoveryCardContent data={prevFourWeeks} />
      </div>
      </div>
      <RevenueRecoveryChart monthly={monthly} />
    </div>
  );
}
