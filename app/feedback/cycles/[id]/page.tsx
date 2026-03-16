import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { ensureParticipantIfLeader } from "@/lib/feedback-ensure-participant";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase config required");
  return createClient(url, key);
}

const AVATAR_COLORS = [
  "#4f46e5", "#f59e0b", "#ef4444",
  "#10b981", "#3b82f6", "#8b5cf6", "#ec4899",
];

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function capitalize(str: string) {
  return str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    ANNUAL: "bg-[#f5f3ff] border-[#ddd6fe] text-[#6d28d9]",
    MID_YEAR: "bg-[#fffbeb] border-[#fcd34d] text-[#92400e]",
    PEER: "bg-[#eff6ff] border-[#bfdbfe] text-[#1d4ed8]",
    DIRECT_REPORT: "bg-[#fdf4ff] border-[#e9d5ff] text-[#6d28d9]",
    MANAGER: "bg-[#fff7ed] border-[#fed7aa] text-[#9a3412]",
    SELF: "bg-[#ecfdf5] border-[#6ee7b7] text-[#065f46]",
  };
  const label = type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-semibold ${map[type] ?? map.PEER}`}>
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; dot: string; className: string }> = {
    SUBMITTED: { label: "Submitted", dot: "#3b82f6", className: "bg-[#eff6ff] border-[#bfdbfe] text-[#1d4ed8]" },
    PENDING: { label: "Pending", dot: "#d97706", className: "bg-[#fffbeb] border-[#fcd34d] text-[#92400e]" },
    IN_PROGRESS: { label: "In progress", dot: "#d97706", className: "bg-[#fffbeb] border-[#fcd34d] text-[#92400e]" },
    COMPLETED: { label: "Completed", dot: "#059669", className: "bg-[#ecfdf5] border-[#6ee7b7] text-[#065f46]" },
    DRAFT: { label: "Draft", dot: "#8a97b8", className: "bg-[#f8faff] border-[#dde5f5] text-[#8a97b8]" },
    Active: { label: "Active", dot: "#059669", className: "bg-[#ecfdf5] border-[#6ee7b7] text-[#065f46]" },
    Closed: { label: "Closed", dot: "#8a97b8", className: "bg-[#f8faff] border-[#dde5f5] text-[#8a97b8]" },
  };
  const s = map[status] ?? map.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold ${s.className}`}>
      <span className="w-[5px] h-[5px] rounded-full flex-shrink-0" style={{ background: s.dot }} />
      {s.label}
    </span>
  );
}

interface ReviewerForCycle {
  id: string;
  name: string;
  department: string | null;
  reviewType: string;
  status: string;
  score: number | null;
}

export default async function FeedbackCyclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return (
      <div className="w-full px-7 py-6">
        <div className="rounded-[14px] border border-[#dde5f5] bg-white p-6">
          <p className="text-[13px] text-[#8a97b8]">Please sign in to view this cycle.</p>
        </div>
      </div>
    );
  }

  const { id: cycleId } = await params;
  const supabase = getSupabase();

  const { data: cycle, error } = await supabase
    .from("feedback_cycle")
    .select("id, cycle_name, start_date, end_date, status, peer_feedback_visible_to_reviewee, direct_report_feedback_visible_to_reviewee")
    .eq("id", cycleId)
    .maybeSingle();

  if (error || !cycle) {
    notFound();
  }

  const isActive = cycle.status === "Active";
  if (isActive && user.employee_id) {
    await ensureParticipantIfLeader(cycleId, user.employee_id, user.email);
  }

  // Reviewers assigned to this participant (people reviewing me), including SELF
  const { data: reviewerRows } = await supabase
    .from("feedback_reviewer")
    .select("id, reviewer_employee_id, reviewer_type, status")
    .eq("cycle_id", cycleId)
    .eq("participant_employee_id", user.employee_id ?? "");

  const allReviewers = reviewerRows ?? [];
  const selfRow = allReviewers.find((r) => (r.reviewer_type as string) === "SELF");
  const others = allReviewers.filter((r) => (r.reviewer_type as string) !== "SELF");

  // Average score per reviewer from feedback_response
  const reviewerIds = allReviewers.map((r) => r.id);
  let scoreByReviewerId = new Map<string, number>();
  if (reviewerIds.length > 0) {
    const { data: responses } = await supabase
      .from("feedback_response")
      .select("reviewer_id, score")
      .in("reviewer_id", reviewerIds)
      .not("submitted_at", "is", null);
    const sumByReviewer = new Map<string, { sum: number; count: number }>();
    for (const row of responses ?? []) {
      if (row.score == null) continue;
      const cur = sumByReviewer.get(row.reviewer_id) ?? { sum: 0, count: 0 };
      cur.sum += row.score;
      cur.count += 1;
      sumByReviewer.set(row.reviewer_id, cur);
    }
    sumByReviewer.forEach((v, reviewerId) => {
      if (v.count > 0) scoreByReviewerId.set(reviewerId, v.sum / v.count);
    });
  }

  // When closed, get reviewer names (all others — anonymity lifted)
  let nameByReviewerId = new Map<string, string>();
  let departmentByReviewerId = new Map<string, string | null>();
  if (cycle.status === "Closed" && others.length > 0) {
    const empIds = others.map((r) => r.reviewer_employee_id);
    const { data: employees } = await supabase
      .from("employees")
      .select("employee_id, full_name, department_name")
      .in("employee_id", empIds);
    const byEmpId = new Map((employees ?? []).map((e) => [e.employee_id, e]));
    others.forEach((r) => {
      const emp = byEmpId.get(r.reviewer_employee_id);
      nameByReviewerId.set(r.id, emp?.full_name ?? r.reviewer_employee_id);
      departmentByReviewerId.set(r.id, emp?.department_name ?? null);
    });
  }

  const selfAssessment = selfRow
    ? {
        id: selfRow.id,
        status: selfRow.status === "Submitted" ? "SUBMITTED" : "PENDING",
        score: scoreByReviewerId.get(selfRow.id) ?? null,
      }
    : null;

  // Show all assigned reviewers in table (anonymous when active, names when closed)
  const reviewersForTable: ReviewerForCycle[] = others.map((r) => ({
    id: r.id,
    name: nameByReviewerId.get(r.id) ?? "",
    department: departmentByReviewerId.get(r.id) ?? null,
    reviewType: (r.reviewer_type as string) ?? "—",
    status: r.status === "Submitted" ? (cycle.status === "Closed" ? "COMPLETED" : "SUBMITTED") : "PENDING",
    score: scoreByReviewerId.get(r.id) ?? null,
  }));

  const allForKpi = allReviewers.map((r) => ({
    status: r.status === "Submitted" ? "COMPLETED" : "PENDING",
  }));
  const submittedCount = allForKpi.filter((r) => r.status === "COMPLETED").length;
  const pendingCount = allForKpi.filter((r) => r.status === "PENDING").length;

  const cycleStatusBadge = cycle.status === "Active" ? "Active" : "Closed";

  return (
    <div className="w-full px-7 py-6 space-y-6">
      <div className="mb-5">
        <Link
          href="/feedback"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#3b82f6] hover:text-[#1d4ed8] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to 360 Feedback
        </Link>
      </div>

      {/* Cycle info card header */}
      <div className="bg-white border border-[#dde5f5] rounded-[14px] shadow-[0_2px_12px_rgba(15,31,61,0.07)] overflow-hidden mb-4">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#dde5f5] bg-[#f8faff]">
          <div className="w-9 h-9 rounded-[10px] bg-[#f5f3ff] border border-[#ddd6fe] flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
              <circle cx="12" cy="12" r="4" />
              <path d="M16 8v5a3 3 0 006 0v-1a10 10 0 10-3.92 7.94" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-['Sora'] text-[15px] font-bold text-[#0f1f3d]">{cycle.cycle_name}</p>
            <p className="text-[11px] text-[#8a97b8] mt-0.5">
              {formatDate(cycle.start_date)} – {formatDate(cycle.end_date)} · {cycle.status}
            </p>
          </div>
          <StatusBadge status={cycleStatusBadge} />
        </div>
        <div className="grid grid-cols-3 divide-x divide-[#dde5f5]">
          <div className="flex flex-col items-center py-4 gap-0.5">
            <span className="font-['Sora'] text-[22px] font-bold text-[#059669]">{submittedCount}</span>
            <span className="text-[10px] uppercase tracking-[.06em] text-[#8a97b8]">Submitted</span>
          </div>
          <div className="flex flex-col items-center py-4 gap-0.5">
            <span className="font-['Sora'] text-[22px] font-bold text-[#d97706]">{pendingCount}</span>
            <span className="text-[10px] uppercase tracking-[.06em] text-[#8a97b8]">Pending</span>
          </div>
          <div className="flex flex-col items-center py-4 gap-0.5">
            <span className="font-['Sora'] text-[22px] font-bold text-[#0f1f3d]">{allForKpi.length}</span>
            <span className="text-[10px] uppercase tracking-[.06em] text-[#8a97b8]">Total reviewers</span>
          </div>
        </div>
      </div>

      {/* Self-assessment section */}
      <div className="bg-white border border-[#dde5f5] rounded-[14px] shadow-[0_2px_12px_rgba(15,31,61,0.07)] overflow-hidden mb-4">
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#dde5f5] bg-[#f8faff]">
          <p className="text-[10px] font-bold uppercase tracking-[.07em] text-[#8a97b8]">Your self-assessment</p>
        </div>
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="w-9 h-9 rounded-full bg-[#4f46e5] flex items-center justify-center text-[12px] font-semibold text-white flex-shrink-0">
            {getInitials(user.name ?? user.email ?? "U")}
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-[#0f1f3d]">Your self-assessment</p>
            <p className="text-[11px] text-[#8a97b8] mt-0.5">
              {selfAssessment?.status === "SUBMITTED" ? "Completed and submitted" : "Not yet submitted"}
            </p>
          </div>
          {selfAssessment?.score != null && (
            <div className="flex items-center gap-2 mr-4">
              <div className="w-20 h-1.5 rounded-full bg-[#dde5f5] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#0d9488]"
                  style={{ width: `${(selfAssessment.score / 5) * 100}%` }}
                />
              </div>
              <span className="text-[13px] font-semibold text-[#0f1f3d]">{selfAssessment.score.toFixed(1)}</span>
            </div>
          )}
          <StatusBadge status={selfAssessment?.status ?? "PENDING"} />
          {selfRow && (
            <Link
              href={`/feedback/cycles/${cycleId}/review/${selfRow.id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[8px] border border-[#dde5f5] text-[11px] font-semibold text-[#4a5a82] hover:border-[#0f1f3d] hover:text-[#0f1f3d] transition-colors ml-2"
            >
              {selfAssessment?.status === "SUBMITTED" ? "View" : "Start"}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          )}
        </div>
      </div>

      {/* Reviewers section — anonymous when active, revealed when closed */}
      <div className="bg-white border border-[#dde5f5] rounded-[14px] shadow-[0_2px_12px_rgba(15,31,61,0.07)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#dde5f5] bg-[#f8faff]">
          <p className="text-[10px] font-bold uppercase tracking-[.07em] text-[#8a97b8]">Reviewers</p>
          {isActive && (
            <div className="flex items-center gap-1.5">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#8a97b8" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              <span className="text-[10px] text-[#8a97b8]">Reviewer names are hidden until the cycle closes</span>
            </div>
          )}
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#f8faff]">
              <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[.06em] text-[#8a97b8] border-b border-[#dde5f5] w-[35%]">
                Reviewer
              </th>
              <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[.06em] text-[#8a97b8] border-b border-[#dde5f5] w-[18%]">
                Type
              </th>
              <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[.06em] text-[#8a97b8] border-b border-[#dde5f5] w-[20%]">
                Status
              </th>
              <th className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[.06em] text-[#8a97b8] border-b border-[#dde5f5] w-[15%]">
                Score
              </th>
              <th className="px-5 py-2.5 border-b border-[#dde5f5]" />
            </tr>
          </thead>
          <tbody>
            {reviewersForTable.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-[12px] text-[#8a97b8]">
                  No other reviewers assigned for this cycle.
                </td>
              </tr>
            ) : (
              reviewersForTable.map((reviewer, i) => {
              const sameTypeIndex = reviewersForTable
                .slice(0, i + 1)
                .filter((r) => r.reviewType === reviewer.reviewType).length;
              const anonymousLabel = `${capitalize(reviewer.reviewType)} reviewer ${sameTypeIndex}`;

              return (
                <tr key={reviewer.id} className="border-t border-[#dde5f5] hover:bg-[#f8faff] transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      {isActive ? (
                        <div className="w-8 h-8 rounded-full bg-[#eef2fb] border border-[#dde5f5] flex items-center justify-center flex-shrink-0">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a97b8" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                        </div>
                      ) : (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0"
                          style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                        >
                          {getInitials(reviewer.name || "?")}
                        </div>
                      )}
                      <div>
                        <p className="text-[12px] font-semibold text-[#0f1f3d]">
                          {isActive ? anonymousLabel : reviewer.name}
                        </p>
                        {!isActive && reviewer.department && (
                          <p className="text-[10px] text-[#8a97b8] mt-0.5">{reviewer.department}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <TypeBadge type={reviewer.reviewType} />
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={reviewer.status} />
                  </td>
                  <td className="px-5 py-3.5">
                    {!isActive && reviewer.score != null ? (
                      <div className="flex items-center gap-2">
                        <div className="w-14 h-1.5 rounded-full bg-[#dde5f5] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#0d9488]"
                            style={{ width: `${(reviewer.score / 5) * 100}%` }}
                          />
                        </div>
                        <span className="text-[12px] font-semibold text-[#0f1f3d]">{reviewer.score.toFixed(1)}</span>
                      </div>
                    ) : (
                      <span className="text-[12px] text-[#8a97b8]">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {!isActive && reviewer.status === "COMPLETED" && (
                      <Link
                        href={`/feedback/cycles/${cycleId}/report`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#dde5f5] text-[11px] font-semibold text-[#4a5a82] hover:border-[#0f1f3d] hover:text-[#0f1f3d] transition-colors"
                      >
                        View
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
