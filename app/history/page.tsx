import { getCurrentUser } from "@/lib/auth";
import { getPerformanceHistory } from "@/lib/history-data";
import { PerformanceHistoryView } from "@/components/performance-history-view";

export default async function PerformanceHistoryPage() {
  const user = await getCurrentUser();
  const employeeId = user?.employee_id ?? null;
  const items = await getPerformanceHistory(employeeId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Performance History
        </h1>
        <p className="text-muted-foreground">
          View your past appraisal cycles, scores, and outcomes.
        </p>
      </div>
      <PerformanceHistoryView items={items} />
      {!employeeId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Your profile is not linked to an employee record. Connect your
            account to see your performance history here.
          </p>
        </div>
      )}
    </div>
  );
}
