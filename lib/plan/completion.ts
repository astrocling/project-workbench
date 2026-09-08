import type { PlanItemJson, PlanPhaseJson } from "@/lib/plan/serialize";

export type PlanCompletionCounts = {
  completed: number;
  total: number;
  percent: number;
};

export function isPlanItemComplete(item: Pick<PlanItemJson, "status">): boolean {
  return item.status === "complete";
}

export function completedAtForStatus(
  status: PlanItemJson["status"] | undefined,
  currentCompletedAt: Date | null | undefined
): Date | null {
  if (status !== "complete") return null;
  return currentCompletedAt ?? new Date();
}

export function countPlanCompletion(phases: PlanPhaseJson[]): PlanCompletionCounts {
  let completed = 0;
  let total = 0;
  for (const phase of phases) {
    for (const item of phase.items) {
      total += 1;
      if (isPlanItemComplete(item)) completed += 1;
    }
  }
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { completed, total, percent };
}
