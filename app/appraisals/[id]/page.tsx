import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";
import { getReportingStructureFromDynamics, getReportingStructure } from "@/lib/reporting-structure";
import { resolveDepartmentHeadSystemUserId } from "@/lib/hrmis-approval-auth";
import { resolveManagerAccessForAppraisal } from "@/lib/appraisal-manager-access";
import type { AppraisalStatus } from "@/types/appraisal";
import { AppraisalTabs, AppraisalData, type AppraisalAgreement } from "@/components/appraisal/AppraisalTabs";
import { CompletionBarWrapperClient } from "@/components/appraisal/CompletionBarWrapperClient";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase URL and key required");
  return createClient(url, key);
}

async function getAppraisalDetail(
  appraisalId: string
): Promise<(AppraisalData & { review_type?: string; cyclePhase: string }) | null> {
  const supabase = getSupabase();

  const { data: appraisal, error: appError } = await supabase
    .from("appraisals")
    .select("id, employee_id, manager_employee_id, division_id, cycle_id, status, is_management, review_type")
    .eq("id", appraisalId)
    .single();

  if (appError || !appraisal) return null;

  const { data: emp } = await supabase
    .from("employees")
    .select("full_name, email")
    .eq("employee_id", appraisal.employee_id)
    .single();

  const { data: cycle } = await supabase
    .from("appraisal_cycles")
    .select("*")
    .eq("id", appraisal.cycle_id)
    .single();

  const status = (appraisal.status as string) ?? "DRAFT";
  const needApprovals = status === "PENDING_APPROVAL";
  const needSignoffs = status === "PENDING_SIGNOFF" || status === "HR_REVIEW" || status === "COMPLETE";

  let approvals: { role: string }[] = [];
  let signoffs: { role: string; stage: string }[] = [];
  if (needApprovals) {
    const { data: a } = await supabase.from("appraisal_approvals").select("role").eq("appraisal_id", appraisal.id);
    approvals = a ?? [];
  }
  if (needSignoffs) {
    const { data: s } = await supabase
      .from("appraisal_signoffs")
      .select("role, stage, signed_at, comment")
      .eq("appraisal_id", appraisal.id);
    signoffs = (s ?? []).map((row: { role: string; stage: string; signed_at?: string; comment?: string | null }) => ({
      role: row.role,
      stage: row.stage,
      signed_at: row.signed_at ?? undefined,
      comment: row.comment ?? undefined,
    }));
  }

  let agreement: AppraisalAgreement | null = null;
  let managerName = "—";
  let managerEmail: string | null = null;
  let employeeEmail: string | null = emp?.email ?? null;
  let hrOfficerName = "—";
  let hrOfficerEmail: string | null = null;

  const needAgreement =
    status === "MANAGER_REVIEW" ||
    status === "PENDING_SIGNOFF" ||
    status === "HR_REVIEW" ||
    status === "COMPLETE";
  if (needAgreement) {
    const { data: agg } = await supabase
      .from("appraisal_agreements")
      .select("*")
      .eq("appraisal_id", appraisal.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (agg) agreement = agg as AppraisalAgreement;

    if (appraisal.manager_employee_id) {
      const { data: mgrRow } = await supabase
        .from("employees")
        .select("full_name, email")
        .eq("employee_id", appraisal.manager_employee_id)
        .single();
      if (mgrRow) {
        managerName = mgrRow.full_name ?? "—";
        managerEmail = mgrRow.email ?? null;
      }
    }
    const { data: hrRow } = await supabase
      .from("app_users")
      .select("employee_id, email, display_name")
      .in("role", ["hr", "admin"])
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (hrRow) {
      hrOfficerEmail = hrRow.email ?? null;
      hrOfficerName = hrRow.display_name ?? hrRow.email ?? "—";
      if (hrRow.employee_id) {
        const { data: hrEmp } = await supabase
          .from("employees")
          .select("full_name")
          .eq("employee_id", hrRow.employee_id)
          .single();
        if (hrEmp?.full_name) hrOfficerName = hrEmp.full_name;
      }
    }
  }

  const cycleData = cycle as Record<string, unknown> | null;
  return {
    id: appraisal.id,
    employee_id: appraisal.employee_id,
    manager_employee_id: appraisal.manager_employee_id ?? null,
    cycle_id: appraisal.cycle_id,
    status,
    is_management: appraisal.is_management ?? false,
    employeeName: emp?.full_name ?? "—",
    employeeEmail,
    managerName,
    managerEmail,
    hrOfficerName,
    hrOfficerEmail,
    cycleName: cycle?.name ?? "—",
    cycleStartDate: cycleData?.start_date != null ? String(cycleData.start_date) : undefined,
    cycleEndDate: cycleData?.end_date != null ? String(cycleData.end_date) : undefined,
    review_type: appraisal.review_type ?? undefined,
    cyclePhase: cycleData?.phase != null ? String(cycleData.phase) : "",
    approvals,
    signoffs,
    agreement,
  };
}

function canAccessAppraisal(
  user: { roles?: string[]; employee_id?: string | null; division_id?: string | null } | null,
  appraisal: { employee_id: string; manager_employee_id: string | null; division_id?: string | null },
  hrmisEmployeeId: string | null,
  hasManagerAccess: boolean
): boolean {
  if (!user) return false;
  const roles = user.roles ?? [];
  const empId = hrmisEmployeeId ?? user.employee_id ?? null;
  const divId = user.division_id ?? null;

  if (roles.includes("hr") || roles.includes("admin")) return true;
  if (appraisal.employee_id === empId) return true;
  if (appraisal.manager_employee_id === empId) return true;
  if (hasManagerAccess) return true;
  if (roles.includes("gm") && divId && appraisal.division_id === divId) return true;

  return false;
}

const statusConfig: Record<string, { bg: string; text: string; border: string; dot: string; label: string }> = {
  DRAFT: { bg: "#f1f5f9", text: "#64748b", border: "#e2e8f0", dot: "#94a3b8", label: "Draft" },
  PENDING_APPROVAL: { bg: "#fffbeb", text: "#92400e", border: "#fde68a", dot: "#f59e0b", label: "Pending Approval" },
  IN_PROGRESS: { bg: "#f0fdfa", text: "#0f766e", border: "#99f6e4", dot: "#0d9488", label: "In progress" },
  SELF_ASSESSMENT: { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe", dot: "#3b82f6", label: "Self Assessment" },
  SUBMITTED: { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0", dot: "#22c55e", label: "Submitted" },
  MANAGER_REVIEW: { bg: "#f3e8ff", text: "#6d28d9", border: "#ddd6fe", dot: "#7c3aed", label: "Manager Review" },
  PENDING_SIGNOFF: { bg: "#fffbeb", text: "#92400e", border: "#fde68a", dot: "#f59e0b", label: "Pending Sign-off" },
  HR_REVIEW: { bg: "#f0fdfa", text: "#0f766e", border: "#99f6e4", dot: "#0d9488", label: "HR Review" },
  COMPLETE: { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0", dot: "#22c55e", label: "Complete" },
};

const WORKFLOW_STEPS = [
  { status: "DRAFT", label: "Draft", short: "1" },
  { status: "PENDING_APPROVAL", label: "Approval", short: "2" },
  { status: "IN_PROGRESS", label: "In progress", short: "3" },
  { status: "SELF_ASSESSMENT", label: "Self Assessment", short: "4" },
  { status: "MANAGER_REVIEW", label: "Manager Review", short: "5" },
  { status: "PENDING_SIGNOFF", label: "Sign-off", short: "6" },
  { status: "HR_REVIEW", label: "HR Review", short: "7" },
  { status: "COMPLETE", label: "Complete", short: "8" },
] as const;

function formatReviewType(type?: string): string {
  if (!type) return "Review";
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) + " Review";
}

const DocumentIcon = () => (
  <svg style={{ width: 22, height: 22 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg style={{ width: 14, height: 14 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

export default async function AppraisalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: appraisalId } = await params;
  const [user, appraisal] = await Promise.all([
    getCurrentUser(),
    getAppraisalDetail(appraisalId),
  ]);

  let currentUserStructure;
  try {
    currentUserStructure = await getReportingStructureFromDynamics(null, user?.email ?? null);
  } catch {
    currentUserStructure = await getReportingStructure(user?.employee_id ?? null);
  }
  const currentUserEmployeeId = currentUserStructure.currentUserSystemUserId ?? currentUserStructure.employee_id ?? user?.employee_id ?? null;

  // Troubleshooting: employee id resolution (server log — check terminal)
  console.log("[Appraisal page] employee id resolution", {
    appraisalEmployeeId: appraisal?.employee_id,
    currentUserSystemUserId: currentUserStructure.currentUserSystemUserId,
    currentUserXrmEmployeeId: currentUserStructure.employee_id,
    userEmployeeId: user?.employee_id,
    resolvedCurrentUserEmployeeId: currentUserEmployeeId,
    match: appraisal ? currentUserEmployeeId === appraisal.employee_id : null,
  });

  if (!appraisal) {
    notFound();
  }

  const supabase = getSupabase();
  const managerAccess = await resolveManagerAccessForAppraisal({
    supabase,
    appraisalId: appraisal.id,
    appraisalEmployeeId: appraisal.employee_id,
    appraisalManagerEmployeeId: appraisal.manager_employee_id,
    currentEmployeeId: currentUserEmployeeId,
  });
  if (!canAccessAppraisal(user, appraisal, currentUserEmployeeId, managerAccess.hasManagerAccess)) {
    notFound();
  }

  const roles = user?.roles ?? [];
  const isManager = managerAccess.hasManagerAccess || roles.includes("manager");
  const isHR = roles.includes("hr") || roles.includes("admin");
  const hodSystemUserId = await resolveDepartmentHeadSystemUserId(appraisal.employee_id);
  const isHOD =
    (hodSystemUserId != null && hodSystemUserId === currentUserEmployeeId) ||
    roles.includes("gm") ||
    roles.includes("admin");

  let structure;
  try {
    structure = await getReportingStructureFromDynamics(appraisal.employee_id, user?.email ?? null);
  } catch {
    structure = await getReportingStructure(appraisal.employee_id);
  }
  const hasDirectReports = (structure.directReports?.length ?? 0) > 0;
  const showLeadership = appraisal.is_management || hasDirectReports;

  let hrRecommendationsSaved = false;
  if (appraisal.status === "HR_REVIEW" && isHR) {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("appraisal_hr_recommendations")
      .select("id")
      .eq("appraisal_id", appraisal.id)
      .maybeSingle();
    hrRecommendationsSaved = !!data;
  }

  const status = statusConfig[appraisal.status] ?? statusConfig.DRAFT;
  const effectiveStatus = appraisal.status === "SUBMITTED" ? "MANAGER_REVIEW" : appraisal.status;
  const currentStepIndex = WORKFLOW_STEPS.findIndex((s) => s.status === effectiveStatus);
  const safeStepIndex = currentStepIndex >= 0 ? currentStepIndex : 0;

  return (
    <div style={{ animation: "fadeUp 0.4s ease both" }}>
      {/* Back link */}
      <Link
        href="/appraisals"
        className="back-link"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "13px",
          fontWeight: 500,
          color: "#4a5a82",
          textDecoration: "none",
          marginBottom: "20px",
          transition: "color 0.15s",
        }}
      >
        <ArrowLeftIcon />
        Back to Appraisals
      </Link>

      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "28px",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {/* Icon tile */}
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #eff6ff, #dbeafe)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              color: "#3b82f6",
            }}
          >
            <DocumentIcon />
          </div>

          <div>
            <h1
              style={{
                fontFamily: "Sora, sans-serif",
                fontSize: "24px",
                fontWeight: 700,
                color: "#0f1f3d",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                margin: 0,
              }}
            >
              {appraisal.employeeName}
            </h1>
            <p style={{ fontSize: "13.5px", color: "#8a97b8", margin: "4px 0 0 0" }}>
              {appraisal.cycleName} · {formatReviewType(appraisal.review_type)}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 14px",
              borderRadius: "20px",
              fontSize: "12px",
              fontWeight: 600,
              background: status.bg,
              color: status.text,
              border: `1px solid ${status.border}`,
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: status.dot,
                display: "inline-block",
              }}
            />
            {status.label}
          </span>
        </div>
      </div>

      {/* Stepper + tabs: full-width section */}
      <div className="w-full px-6 py-4 border-b border-slate-100">
        {/* Progress stepper — full width, steps and connectors evenly spaced */}
        <div className="w-full flex items-center justify-between mb-6 py-3 px-4 rounded-lg bg-[#f8faff] border border-[#e2e8f0]">
          {WORKFLOW_STEPS.map((step, i) => {
            const isCompleted = i < safeStepIndex;
            const isCurrent = i === safeStepIndex;
            return (
              <span key={step.status} className="contents">
                <div className="flex-1 flex items-center justify-center gap-1.5">
                  <span
                    className="shrink-0 w-[22px] h-[22px] rounded-full inline-flex items-center justify-center text-xs font-medium text-white"
                    style={{
                      background: isCompleted ? "#3b82f6" : isCurrent ? "#1e3a5f" : "#e2e8f0",
                      color: isCompleted || isCurrent ? "white" : "#94a3b8",
                      boxShadow: isCurrent ? "0 0 0 2px rgba(59,130,246,0.3)" : "none",
                    }}
                  >
                    {isCompleted ? "✓" : step.short}
                  </span>
                  <span className="whitespace-nowrap text-xs font-medium" style={{ color: isCompleted ? "#3b82f6" : isCurrent ? "#0f1f3d" : "#94a3b8" }}>
                    {step.label}
                  </span>
                </div>
                {i < WORKFLOW_STEPS.length - 1 && (
                  <div className="flex-1 flex items-center justify-center text-slate-300 text-xs">→</div>
                )}
              </span>
            );
          })}
        </div>

        <CompletionBarWrapperClient
          appraisalId={appraisal.id}
          status={appraisal.status as AppraisalStatus}
          userRole={isHR ? "HR" : roles.includes("gm") ? "HOD" : appraisal.manager_employee_id === currentUserEmployeeId ? "MANAGER" : currentUserEmployeeId === appraisal.employee_id ? "EMPLOYEE" : "MANAGER"}
          showLeadership={showLeadership}
          isEmployee={currentUserEmployeeId === appraisal.employee_id}
          isManager={appraisal.manager_employee_id === currentUserEmployeeId}
          isHR={isHR}
          approvals={appraisal.approvals}
          signoffs={appraisal.signoffs}
        />

        <AppraisalTabs
        appraisal={appraisal}
        cyclePhase={appraisal.cyclePhase}
        currentUserId={user?.id ?? null}
        currentUserEmployeeId={currentUserEmployeeId}
        isManager={isManager}
        isDelegated={managerAccess.isDelegated}
        isPrimaryManager={managerAccess.isPrimaryManager}
        delegatedByName={appraisal.managerName ?? null}
        isHR={isHR}
        isHOD={isHOD}
        showLeadership={showLeadership}
        approvals={appraisal.approvals}
        signoffs={appraisal.signoffs}
        hrRecommendationsSaved={hrRecommendationsSaved}
      />
      </div>
    </div>
  );
}
