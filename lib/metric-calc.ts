/**
 * Workplan metric type calculations.
 * actual_result (0-100) is always derived from type-specific inputs and used for points.
 */

export type MetricType = "NUMBER" | "DATE" | "PERCENT";

export interface WorkplanMetricItem {
  metric_type?: MetricType | null;
  metric_target?: number | null;
  metric_deadline?: string | null;
  metric_actual_raw?: number | null;
  metric_completion_date?: string | null;
  actual_result?: number | null;
  /** Manager assessment columns (used only in MANAGER_REVIEW) */
  mgr_actual_raw?: number | null;
  mgr_completion_date?: string | null;
  mgr_result?: number | null;
}

/** Compute 0-100 percentage from type-specific fields. Returns null if insufficient data. */
export function calcMetricPercentage(item: WorkplanMetricItem): number | null {
  const type = item.metric_type ?? "PERCENT";

  switch (type) {
    case "NUMBER": {
      if (item.metric_actual_raw == null || item.metric_target == null || item.metric_target <= 0) return null;
      return Math.min(100, Math.round((item.metric_actual_raw / item.metric_target) * 100));
    }

    case "DATE": {
      if (!item.metric_deadline || !item.metric_completion_date) return null;
      const deadline = new Date(item.metric_deadline);
      const completed = new Date(item.metric_completion_date);
      const daysLate = Math.round((completed.getTime() - deadline.getTime()) / 86_400_000);

      if (daysLate <= 0) return 100;

      const penalty = Math.min(80, Math.round((daysLate / 90) * 100));
      return Math.max(20, 100 - penalty);
    }

    case "PERCENT":
    default: {
      if (item.metric_actual_raw == null) return null;
      return Math.min(100, Math.max(0, item.metric_actual_raw));
    }
  }
}

export interface DateVariance {
  daysLate: number;
  label: string;
  isLate: boolean;
}

/** For DATE type, get days late/early and display label. */
export function getDateVariance(item: WorkplanMetricItem): DateVariance | null {
  if (item.metric_type !== "DATE" || !item.metric_deadline || !item.metric_completion_date) return null;
  const deadline = new Date(item.metric_deadline);
  const completed = new Date(item.metric_completion_date);
  const days = Math.round((completed.getTime() - deadline.getTime()) / 86_400_000);
  return {
    daysLate: days,
    isLate: days > 0,
    label:
      days === 0
        ? "Completed on deadline"
        : days < 0
          ? `${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} early`
          : `${days} day${days !== 1 ? "s" : ""} late`,
  };
}

/** Compute 0-100 manager result from mgr_actual_raw / mgr_completion_date. Used only in MANAGER_REVIEW. */
export function calcMgrResult(item: WorkplanMetricItem): number | null {
  const type = item.metric_type ?? "PERCENT";
  switch (type) {
    case "NUMBER": {
      if (item.mgr_actual_raw == null || !item.metric_target) return null;
      return Math.min(100, Math.round((item.mgr_actual_raw / item.metric_target) * 100));
    }
    case "DATE": {
      if (!item.metric_deadline || !item.mgr_completion_date) return null;
      const daysLate = Math.round(
        (new Date(item.mgr_completion_date).getTime() - new Date(item.metric_deadline).getTime()) / 86_400_000
      );
      if (daysLate <= 0) return 100;
      return Math.max(20, 100 - Math.min(80, Math.round((daysLate / 90) * 100)));
    }
    case "PERCENT":
    default: {
      if (item.mgr_actual_raw == null) return null;
      return Math.min(100, Math.max(0, item.mgr_actual_raw));
    }
  }
}
