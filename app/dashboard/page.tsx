import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard-data";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { CycleBanner } from "@/components/ui/cycle-banner";
import { QuickActionItem } from "@/components/ui/quick-action-item";
import { EmptyState } from "@/components/ui/empty-state";
import { AchievementTimeline } from "@/components/appraisal/AchievementTimeline";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

const GridIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const DocumentIcon = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const ClipboardIcon = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </svg>
);

const BoltIcon = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const NetworkIcon = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="5" r="3" />
    <line x1="12" y1="8" x2="12" y2="14" />
    <circle cx="6" cy="19" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="12" y1="14" x2="6" y2="16" />
    <line x1="12" y1="14" x2="18" y2="16" />
  </svg>
);

const FileEditIcon = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 11 12 14 22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

const TrendingUpIcon = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const StarIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const PurpleIcon = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    <line x1="9" y1="9" x2="9.01" y2="9" />
    <line x1="15" y1="9" x2="15.01" y2="9" />
  </svg>
);

const AmberIcon = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="9" y1="21" x2="9" y2="9" />
  </svg>
);

const DocumentEmptyIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const employeeId = user?.employee_id ?? null;
  const data = await getDashboardData(employeeId);

  const cycleYear = data.activeCycle?.name || "FY 2025/26";
  const cycleRange = data.activeCycle
    ? `${formatDate(data.activeCycle.start_date)} – ${formatDate(data.activeCycle.end_date)}`
    : "No active cycle";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Page Header */}
      <PageHeader
        icon={<GridIcon />}
        title="Dashboard"
        subtitle="Overview of your performance appraisal activity"
      />

      {/* Active Cycle Banner */}
      {data.activeCycle && (
        <CycleBanner
          fiscalYear={cycleYear}
          dateRange={cycleRange}
          isActive={data.activeCycle.status === "open"}
        />
      )}

      {/* Stat Cards */}
      <div className="animate-fade-up-delay-2 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Self Assessment"
          value={data.selfAssessmentPending}
          meta={`Pending • ${data.selfAssessmentCompleted} completed`}
          icon={<FileEditIcon />}
          variant="blue"
        />
        <StatCard
          label="Manager Reviews"
          value={data.managerReviewPending}
          meta={`Awaiting manager • ${data.managerReviewCompleted} completed`}
          icon={<CheckIcon />}
          variant="gold"
        />
        <StatCard
          label="Latest Score"
          value={
            data.recentScores.length > 0 && data.recentScores[0].total_score != null
              ? `${data.recentScores[0].total_score.toFixed(1)}%`
              : "—"
          }
          meta={
            data.recentScores.length > 0 && data.recentScores[0].final_rating
              ? data.recentScores[0].final_rating
              : "No recent scores"
          }
          icon={<TrendingUpIcon />}
          variant="teal"
        />
        <StatCard
          label="Cycle Status"
          value={data.activeCycle ? "Active" : "None"}
          meta={data.activeCycle?.name || "No open cycle"}
          icon={<StarIcon />}
          variant="rose"
        />
      </div>

      {/* Achievement Timeline */}
      {employeeId && (
        <div className="animate-fade-up-delay-3">
          <AchievementTimeline employeeId={employeeId} />
        </div>
      )}

      {/* Quick Actions and Scores Grid */}
      <div className="animate-fade-up-delay-3 grid gap-6 md:grid-cols-2">
        {/* Quick Actions Card */}
        <div
          className="overflow-hidden rounded-[14px] bg-white"
          style={{
            boxShadow: "var(--shadow-card)",
            border: "1px solid var(--border-color)",
          }}
        >
          <div
            className="flex items-center gap-3 px-6 py-5"
            style={{ borderBottom: "1px solid var(--border-color)" }}
          >
            <div
              className="flex h-[30px] w-[30px] items-center justify-center rounded-lg"
              style={{ backgroundColor: "#f3e8ff" }}
            >
              <span style={{ color: "#9333ea" }}>
                <PurpleIcon />
              </span>
            </div>
            <div>
              <h2 className="font-display text-[15px] font-semibold text-text-primary">
                Quick Actions
              </h2>
              <p className="text-xs text-text-muted">
                Start a self-assessment or manage your workplan
              </p>
            </div>
          </div>
          <div>
            <QuickActionItem
              href="/appraisals"
              icon={<DocumentIcon />}
              name="My Appraisals"
              description="View and complete your appraisals"
              variant="blue"
            />
            <QuickActionItem
              href="/workplans"
              icon={<ClipboardIcon />}
              name="My Workplans"
              description="Manage goals and objectives"
              variant="teal"
            />
            <QuickActionItem
              href="/development"
              icon={<BoltIcon />}
              name="Development Profile"
              description="Track your growth journey"
              variant="violet"
            />
            <QuickActionItem
              href="/reporting-test"
              icon={<NetworkIcon />}
              name="Reporting Structure"
              description="View organizational hierarchy"
              variant="gold"
            />
          </div>
        </div>

        {/* Recent Scores Card */}
        <div
          className="overflow-hidden rounded-[14px] bg-white"
          style={{
            boxShadow: "var(--shadow-card)",
            border: "1px solid var(--border-color)",
          }}
        >
          <div
            className="flex items-center gap-3 px-6 py-5"
            style={{ borderBottom: "1px solid var(--border-color)" }}
          >
            <div
              className="flex h-[30px] w-[30px] items-center justify-center rounded-lg"
              style={{ backgroundColor: "#fffbeb" }}
            >
              <span style={{ color: "#d97706" }}>
                <AmberIcon />
              </span>
            </div>
            <div>
              <h2 className="font-display text-[15px] font-semibold text-text-primary">
                Recent Appraisal Scores
              </h2>
              <p className="text-xs text-text-muted">
                Your latest performance ratings by cycle
              </p>
            </div>
          </div>
          <div className="p-6">
            {data.recentScores.length === 0 ? (
              <EmptyState
                icon={<DocumentEmptyIcon />}
                title="No scores yet"
                description="Complete an appraisal cycle to see your performance results here."
              />
            ) : (
              <ul className="space-y-3">
                {data.recentScores.map((score) => (
                  <li
                    key={score.appraisal_id}
                    className="flex items-center justify-between rounded-lg px-4 py-3 text-sm transition-colors hover:bg-surface"
                    style={{ border: "1px solid var(--border-color)" }}
                  >
                    <span className="font-medium text-text-primary">
                      {score.cycle_name}
                    </span>
                    <span className="text-text-muted">
                      {score.total_score != null
                        ? `${score.total_score.toFixed(1)}%`
                        : "—"}
                      {score.final_rating ? ` • ${score.final_rating}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Warning for unlinked employee */}
      {!employeeId && (
        <div
          className="rounded-[14px] px-6 py-4"
          style={{
            backgroundColor: "#fffbeb",
            border: "1px solid #fde68a",
          }}
        >
          <p className="text-sm text-amber-800">
            Your profile is not linked to an employee record. Connect your
            account in HR Administration to see your appraisal data here.
          </p>
        </div>
      )}
    </div>
  );
}
