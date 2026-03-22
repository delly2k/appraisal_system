import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { getParticipantFeedbackDashboard } from "@/lib/feedback-dashboard";
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

function formatDate(date: string | null) {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return date;
  }
}

// ----- Shared section header -----
function SectionHeader({
  icon,
  iconBg,
  iconBorder,
  title,
  subtitle,
  count,
  countStyle,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconBorder: string;
  title: string;
  subtitle: string;
  count?: number | null;
  countStyle?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div
        className={`w-9 h-9 rounded-[10px] flex items-center justify-center
                       flex-shrink-0 border ${iconBg} ${iconBorder}`}
      >
        {icon}
      </div>
      <div className="flex-1">
        <p className="font-['Sora'] text-[13px] font-bold text-[#0f1f3d]">{title}</p>
        <p className="text-[11px] text-[#8a97b8] mt-0.5">{subtitle}</p>
      </div>
      {count != null && countStyle && (
        <span
          className={`inline-flex items-center justify-center min-w-[20px] h-5
                          px-1.5 rounded-full text-[10px] font-bold border ${countStyle}`}
        >
          {count}
        </span>
      )}
    </div>
  );
}

// ----- Avatar stack -----
function AvatarStack({
  reviewers,
  totalAssigned,
}: {
  reviewers: { name: string; reviewType: string }[];
  totalAssigned?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex">
        {reviewers.slice(0, 5).map((r, i) => (
          <div
            key={i}
            title={`${r.name} (${capitalize(r.reviewType)})`}
            className="w-[26px] h-[26px] rounded-full flex items-center justify-center
                       text-[9px] font-semibold text-white border-2 border-white
                       flex-shrink-0"
            style={{
              background: AVATAR_COLORS[i % AVATAR_COLORS.length],
              marginLeft: i === 0 ? 0 : "-7px",
              zIndex: 10 - i,
            }}
          >
            {getInitials(r.name)}
          </div>
        ))}
        {reviewers.length > 5 && (
          <div
            className="w-[26px] h-[26px] rounded-full flex items-center justify-center
                       text-[9px] font-semibold border-2 border-white flex-shrink-0
                       bg-[#eef2fb] text-[#8a97b8]"
            style={{ marginLeft: "-7px" }}
          >
            +{reviewers.length - 5}
          </div>
        )}
      </div>
      {reviewers.length > 0 && (
        <span className="text-[10px] text-[#8a97b8]">
          {reviewers.length} {reviewers.length === 1 ? "reviewer" : "reviewers"}
        </span>
      )}
      {reviewers.length === 0 && (
        <span className="text-[11px] text-[#8a97b8]">
          {totalAssigned != null && totalAssigned > 0
            ? `${totalAssigned} assigned (not visible)`
            : "None assigned"}
        </span>
      )}
    </div>
  );
}

// ----- Badges -----
function CycleBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#eff6ff] border border-[#bfdbfe] text-[10px] font-semibold text-[#1d4ed8]">
      {label}
    </span>
  );
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
  };
  const s = map[status] ?? map.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold ${s.className}`}>
      <span className="w-[5px] h-[5px] rounded-full flex-shrink-0" style={{ background: s.dot }} />
      {s.label}
    </span>
  );
}

// ----- Icons (inline SVGs) -----
const Icon360 = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
    <circle cx="12" cy="12" r="4" />
    <path d="M16 8v5a3 3 0 006 0v-1a10 10 0 10-3.92 7.94" />
  </svg>
);
const Icon360Small = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
    <circle cx="12" cy="12" r="4" />
    <path d="M16 8v5a3 3 0 006 0v-1a10 10 0 10-3.92 7.94" />
  </svg>
);
const IconEdit = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);
const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a97b8" strokeWidth="2">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);
const ChevronRight = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

interface FeedbackCycle {
  id: string;
  cycle_name: string;
  description: string | null;
  linked_appraisal_cycle_id: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  created_at: string;
}

interface MyCycleRow {
  id: string;
  name: string;
  cycleLabel: string;
  type: string;
  dueDate: string | null;
  selfStatus: string;
  reviewers: Array<{ id: string; name: string; reviewType: string; status: string }>;
  reviewerProgress: { submitted: number; total: number };
  overall360Score: number | null;
  managerFeedbackSubmitted: boolean;
}

interface PendingReviewRow {
  id: string;
  cycleId: string;
  cycleLabel: string;
  participantName: string;
  department: string;
  reviewType: string;
  dueDate: string | null;
  status: string;
  otherReviewers: Array<{ name: string; reviewType: string }>;
}

interface ClosedCycleRow {
  id: string;
  name: string;
  cycleLabel: string;
  type: string;
  closedDate: string | null;
}

export default async function FeedbackPage() {
  const user = await getCurrentUser();
  if (!user?.id) {
    return (
      <div className="w-full px-7 py-6">
        <div className="bg-white border border-[#dde5f5] rounded-[14px] shadow-[0_2px_12px_rgba(15,31,61,0.07)] p-5">
          <p className="text-[13px] text-[#8a97b8]">Please sign in to view 360 Feedback.</p>
        </div>
      </div>
    );
  }

  const supabase = getSupabase();
  const { data: cycles, error } = await supabase
    .from("feedback_cycle")
    .select("id, cycle_name, description, linked_appraisal_cycle_id, start_date, end_date, status, created_at")
    .order("end_date", { ascending: false });

  const allCycles = (cycles ?? []) as FeedbackCycle[];
  const activeCycles = allCycles.filter((c) => c.status === "Active");
  if (user.employee_id) {
    for (const c of activeCycles) {
      await ensureParticipantIfLeader(c.id, user.employee_id, user.email);
    }
  }

  const participantCycles = await getParticipantFeedbackDashboard(user.employee_id ?? null);
  const participantActive = participantCycles.filter((c) => c.status === "Active");
  const participantClosed = participantCycles.filter((c) => c.status === "Closed");
  const draftCycles = allCycles.filter((c) => c.status === "Draft");

  // ----- My cycles: build rows with reviewers per cycle -----
  let myCycles: MyCycleRow[] = [];
  if (participantActive.length > 0 && user.employee_id) {
    const cycleIds = participantActive.map((c) => c.cycle_id);
    const { data: cycleVisibility } = await supabase
      .from("feedback_cycle")
      .select("id, peer_feedback_visible_to_reviewee, direct_report_feedback_visible_to_reviewee")
      .in("id", cycleIds);
    const visibilityByCycleId = new Map(
      (cycleVisibility ?? []).map((c) => [
        c.id,
        {
          peerVisible: c.peer_feedback_visible_to_reviewee !== false,
          directReportVisible: c.direct_report_feedback_visible_to_reviewee !== false,
        },
      ])
    );

    const { data: reviewerRows } = await supabase
      .from("feedback_reviewer")
      .select("id, cycle_id, reviewer_employee_id, reviewer_type, status")
      .eq("participant_employee_id", user.employee_id)
      .in("cycle_id", cycleIds);

    const reviewerIds = [...new Set((reviewerRows ?? []).map((r) => r.reviewer_employee_id))];
    const { data: employees } = await supabase
      .from("employees")
      .select("employee_id, full_name")
      .in("employee_id", reviewerIds);
    const nameById = new Map((employees ?? []).map((e) => [e.employee_id, e.full_name ?? null]));

    const reviewersByCycle = new Map<string, typeof reviewerRows>();
    for (const r of reviewerRows ?? []) {
      const list = reviewersByCycle.get(r.cycle_id) ?? [];
      list.push(r);
      reviewersByCycle.set(r.cycle_id, list);
    }

    myCycles = participantActive.map((c) => {
      const vis = visibilityByCycleId.get(c.cycle_id) ?? { peerVisible: true, directReportVisible: true };
      const revs = reviewersByCycle.get(c.cycle_id) ?? [];
      const allReviewers = revs.map((r) => ({
        id: r.id,
        name: nameById.get(r.reviewer_employee_id) ?? r.reviewer_employee_id,
        reviewType: (r.reviewer_type as string) ?? "—",
        status: r.status === "Submitted" ? "SUBMITTED" : "PENDING",
      }));
      const reviewers = allReviewers.filter((r) => {
        if (r.reviewType === "PEER") return vis.peerVisible;
        if (r.reviewType === "DIRECT_REPORT") return vis.directReportVisible;
        return true;
      });
      const othersOnly = allReviewers.filter((r) => r.reviewType !== "SELF");
      const reviewerProgress = {
        submitted: othersOnly.filter((r) => r.status === "SUBMITTED" || r.status === "COMPLETED").length,
        total: othersOnly.length,
      };
      const selfStatus = c.self_status === "Submitted" ? "SUBMITTED" : "PENDING";
      return {
        id: c.cycle_id,
        name: c.cycle_name,
        cycleLabel: c.cycle_name,
        type: "ANNUAL",
        dueDate: c.end_date,
        selfStatus,
        reviewers,
        reviewerProgress,
        overall360Score: c.overall_360_score ?? null,
        managerFeedbackSubmitted: !!c.manager_feedback_submitted,
      };
    });
  }

  // ----- Pending reviews + department + otherReviewers -----
  let pendingReviews: PendingReviewRow[] = [];
  if (user.employee_id && activeCycles.length > 0) {
    const activeCycleIds = activeCycles.map((c) => c.id);
    const { data: myReviewerRows } = await supabase
      .from("feedback_reviewer")
      .select("id, cycle_id, participant_employee_id, reviewer_type, status")
      .eq("reviewer_employee_id", user.employee_id)
      .in("cycle_id", activeCycleIds)
      .neq("status", "Submitted");

    if (myReviewerRows?.length) {
      const cycleIds = [...new Set(myReviewerRows.map((r) => r.cycle_id))];
      const participantIds = [...new Set(myReviewerRows.map((r) => r.participant_employee_id))];
      const { data: cycleRows } = await supabase
        .from("feedback_cycle")
        .select("id, cycle_name, end_date")
        .in("id", cycleIds);
      const { data: employees } = await supabase
        .from("employees")
        .select("employee_id, full_name, department_name")
        .in("employee_id", participantIds);

      const cycleById = new Map((cycleRows ?? []).map((c) => [c.id, c]));
      const empById = new Map((employees ?? []).map((e) => [e.employee_id, e]));

      // Other reviewers per (cycle_id, participant_employee_id): same cycle+participant, reviewer != me
      const uniquePairs = Array.from(
        new Map(myReviewerRows.map((r) => [`${r.cycle_id}:${r.participant_employee_id}`, r])).values()
      );
      const otherByKey = new Map<string, Array<{ name: string; reviewType: string }>>();
      for (const r of uniquePairs) {
        const key = `${r.cycle_id}:${r.participant_employee_id}`;
        const { data: others } = await supabase
          .from("feedback_reviewer")
          .select("reviewer_employee_id, reviewer_type")
          .eq("cycle_id", r.cycle_id)
          .eq("participant_employee_id", r.participant_employee_id)
          .neq("reviewer_employee_id", user.employee_id!);
        const otherIds = [...new Set((others ?? []).map((o) => o.reviewer_employee_id))];
        const { data: otherEmps } = otherIds.length
          ? await supabase.from("employees").select("employee_id, full_name").in("employee_id", otherIds)
          : { data: [] };
        const otherNames = new Map((otherEmps ?? []).map((e) => [e.employee_id, e.full_name ?? null]));
        otherByKey.set(
          key,
          (others ?? []).map((o) => ({
            name: otherNames.get(o.reviewer_employee_id) ?? o.reviewer_employee_id,
            reviewType: (o.reviewer_type as string) ?? "—",
          }))
        );
      }

      pendingReviews = myReviewerRows.map((r) => {
        const cycle = cycleById.get(r.cycle_id);
        const emp = empById.get(r.participant_employee_id);
        const key = `${r.cycle_id}:${r.participant_employee_id}`;
        return {
          id: r.id,
          cycleId: r.cycle_id,
          cycleLabel: cycle?.cycle_name ?? "—",
          participantName: emp?.full_name ?? r.participant_employee_id,
          department: emp?.department_name ?? "—",
          reviewType: (r.reviewer_type as string) ?? "—",
          dueDate: cycle?.end_date ?? null,
          status: "PENDING",
          otherReviewers: otherByKey.get(key) ?? [],
        };
      });
    }
  }

  // ----- Closed cycles (participant only) -----
  const closedCycles: ClosedCycleRow[] = participantClosed.map((c) => ({
    id: c.cycle_id,
    name: c.cycle_name,
    cycleLabel: c.cycle_name,
    type: "ANNUAL",
    closedDate: c.end_date,
  }));

  return (
    <div className="w-full px-7 py-6 space-y-6">
      <div className="mb-6">
        <h1 className="font-['Sora'] text-[20px] font-bold text-[#0f1f3d]">My 360 feedback</h1>
        <p className="text-[12px] text-[#8a97b8] mt-1">
          Track your cycle progress and complete feedback assigned to you
        </p>
      </div>

      {error && (
        <div className="rounded-[14px] border border-[#fecaca] bg-[#fef2f2] px-5 py-4 text-[13px] text-[#b91c1c]">
          {error.message}
        </div>
      )}

      {/* Section 1 — My cycles table */}
      <div className="mb-5">
        <SectionHeader
          icon={<Icon360 />}
          iconBg="bg-[#f5f3ff]"
          iconBorder="border-[#ddd6fe]"
          title="My cycles"
          subtitle="Your own appraisals — see who is reviewing you and their progress"
          count={myCycles.length}
          countStyle="bg-[#f5f3ff] border-[#ddd6fe] text-[#6d28d9]"
        />
        <div className="bg-white border border-[#dde5f5] rounded-[14px] shadow-[0_2px_12px_rgba(15,31,61,0.07)] overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#f8faff]">
                {["Cycle", "Period", "Type", "Reviewers assigned", "Reviewer progress", "Overall score", "My status", ""].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[.06em] text-[#8a97b8] whitespace-nowrap border-b border-[#dde5f5]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {myCycles.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[12px] text-[#8a97b8]">
                    No active cycles — when you are added to a cycle it will appear here
                  </td>
                </tr>
              ) : (
                myCycles.map((cycle) => {
                  const { submitted, total } = cycle.reviewerProgress;
                  const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;
                  const reviewersForStack = cycle.reviewers
                    .filter((r) => r.reviewType !== "SELF")
                    .map((r) => ({ name: r.name, reviewType: r.reviewType }));

                  return (
                    <tr
                      key={cycle.id}
                      className="border-t border-[#dde5f5] hover:bg-[#f8faff] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-[8px] bg-[#f5f3ff] border border-[#ddd6fe] flex items-center justify-center flex-shrink-0">
                            <Icon360Small />
                          </div>
                          <div>
                            <p className="text-[12px] font-semibold text-[#0f1f3d]">{cycle.name}</p>
                            <p className="text-[10px] text-[#8a97b8]">Due {formatDate(cycle.dueDate)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <CycleBadge label={cycle.cycleLabel} />
                      </td>
                      <td className="px-4 py-3">
                        <TypeBadge type={cycle.type} />
                      </td>
                      <td className="px-4 py-3">
                        <AvatarStack reviewers={reviewersForStack} totalAssigned={cycle.reviewerProgress.total} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-[3px] rounded-full bg-[#dde5f5] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#0d9488]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-[#8a97b8]">
                            {submitted}/{total}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-[12px] font-semibold text-[#0f1f3d]">
                            {cycle.overall360Score != null ? cycle.overall360Score.toFixed(2) : "—"}
                          </span>
                          <span className="text-[10px] text-[#8a97b8]">
                            {cycle.managerFeedbackSubmitted ? "Manager feedback included" : "Awaiting manager feedback"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={cycle.selfStatus} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/feedback/cycles/${cycle.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#dde5f5] text-[11px] font-semibold text-[#4a5a82] hover:border-[#0f1f3d] hover:text-[#0f1f3d] transition-colors"
                        >
                          Open
                          <ChevronRight />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2 — Reviews I need to complete */}
      <div className="mb-5">
        <SectionHeader
          icon={<IconEdit />}
          iconBg="bg-[#eff6ff]"
          iconBorder="border-[#bfdbfe]"
          title="Reviews I need to complete"
          subtitle="Feedback you have been asked to give"
          count={pendingReviews.length}
          countStyle="bg-[#fffbeb] border-[#fcd34d] text-[#92400e]"
        />
        <div className="bg-white border border-[#dde5f5] rounded-[14px] shadow-[0_2px_12px_rgba(15,31,61,0.07)] overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#f8faff]">
                {["Employee", "Cycle", "Review type", "Also reviewing", "Due date", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[.06em] text-[#8a97b8] whitespace-nowrap border-b border-[#dde5f5]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pendingReviews.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[12px] text-[#8a97b8]">
                    No pending reviews — you&apos;re all caught up
                  </td>
                </tr>
              ) : (
                pendingReviews.map((review, idx) => (
                  <tr
                    key={review.id}
                    className="border-t border-[#dde5f5] hover:bg-[#f8faff] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0"
                          style={{ background: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}
                        >
                          {getInitials(review.participantName)}
                        </div>
                        <div>
                          <p className="text-[12px] font-semibold text-[#0f1f3d]">{review.participantName}</p>
                          <p className="text-[10px] text-[#8a97b8]">{review.department}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <CycleBadge label={review.cycleLabel} />
                    </td>
                    <td className="px-4 py-3">
                      <TypeBadge type={review.reviewType} />
                    </td>
                    <td className="px-4 py-3">
                      <AvatarStack reviewers={review.otherReviewers} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[12px] text-[#4a5a82]">{formatDate(review.dueDate)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={review.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/feedback/cycles/${review.cycleId}/review/${review.id}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[8px] bg-[#0d9488] text-white text-[11px] font-semibold hover:bg-[#0f766e] transition-colors"
                      >
                        Start review
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3 — Completed cycles */}
      <div className="mb-5">
        <SectionHeader
          icon={<IconCheck />}
          iconBg="bg-[#f8faff]"
          iconBorder="border-[#dde5f5]"
          title="Completed cycles"
          subtitle="Your closed feedback reports"
        />
        <div className="bg-white border border-[#dde5f5] rounded-[14px] shadow-[0_2px_12px_rgba(15,31,61,0.07)] overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#f8faff]">
                {["Cycle", "Period", "Type", "Closed", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[.06em] text-[#8a97b8] whitespace-nowrap border-b border-[#dde5f5]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {closedCycles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[12px] text-[#8a97b8]">
                    No completed cycles yet — reports will appear here once cycles close
                  </td>
                </tr>
              ) : (
                closedCycles.map((cycle) => (
                  <tr
                    key={cycle.id}
                    className="border-t border-[#dde5f5] hover:bg-[#f8faff] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="text-[12px] font-semibold text-[#0f1f3d]">{cycle.name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <CycleBadge label={cycle.cycleLabel} />
                    </td>
                    <td className="px-4 py-3">
                      <TypeBadge type={cycle.type} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[12px] text-[#4a5a82]">{formatDate(cycle.closedDate)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status="COMPLETED" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/feedback/cycles/${cycle.id}/report`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#dde5f5] text-[11px] font-semibold text-[#4a5a82] hover:border-[#0f1f3d] hover:text-[#0f1f3d] transition-colors"
                      >
                        View report
                        <ChevronRight />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {draftCycles.length > 0 && (
        <p className="text-[12px] text-[#8a97b8]">
          {draftCycles.length} draft cycle(s) will appear here once activated by HR.
        </p>
      )}
    </div>
  );
}
