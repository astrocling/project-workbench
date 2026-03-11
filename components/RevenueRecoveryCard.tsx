"use client";

import { useState, useEffect } from "react";
import { RevenueRecoveryChart, type MonthlyRecoveryRow } from "@/components/RevenueRecoveryChart";
import {
  RevenueRecoveryPieChart,
  RecoveryCardContent,
  formatWeekLabelShort,
  type RecoveryCardData,
} from "@/components/RevenueRecoveryShared";

type WeekData = RecoveryCardData & { weekStartDate: string };
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

  const toDateData: RecoveryCardData | null = toDate
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
