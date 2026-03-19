"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import type { CheckInWithResponses, CheckIn } from "@/types/checkins";
import { CheckInCard } from "@/components/appraisal/checkins/CheckInCard";
import { NewCheckInModal } from "@/components/appraisal/checkins/NewCheckInModal";

const STAGE_STYLES: Record<string, { label: string; bg: string; border: string; text: string; dot: string }> = {
  DRAFT: { label: "Draft", bg: "#f8faff", border: "#dde5f5", text: "#4a5a82", dot: "#8a97b8" },
  PENDING_APPROVAL: { label: "Workplan review", bg: "#fffbeb", border: "#fcd34d", text: "#92400e", dot: "#d97706" },
  WORKPLAN_SUBMITTED: { label: "Workplan review", bg: "#fffbeb", border: "#fcd34d", text: "#92400e", dot: "#d97706" },
  SELF_ASSESSMENT: { label: "Self assessment", bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8", dot: "#3b82f6" },
  SUBMITTED: { label: "Submitted", bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8", dot: "#3b82f6" },
  MANAGER_REVIEW: { label: "Manager review", bg: "#f5f3ff", border: "#ddd6fe", text: "#6d28d9", dot: "#7c3aed" },
  PENDING_SIGNOFF: { label: "Pending sign-off", bg: "#fffbeb", border: "#fcd34d", text: "#92400e", dot: "#d97706" },
  HOD_REVIEW: { label: "HOD review", bg: "#fff7ed", border: "#fed7aa", text: "#9a3412", dot: "#ea580c" },
  HR_REVIEW: { label: "HR review", bg: "#fdf4ff", border: "#e9d5ff", text: "#6d28d9", dot: "#7c3aed" },
  COMPLETE: { label: "Complete", bg: "#ecfdf5", border: "#6ee7b7", text: "#065f46", dot: "#059669" },
};

function formatDate(dateStr: string | null): string {
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

function formatType(t: string): string {
  if (t === "MIDYEAR") return "Mid-year";
  if (t === "QUARTERLY") return "Quarterly";
  return "Ad hoc";
}

interface PageData {
  checkIns: CheckInWithResponses[];
  appraisal: {
    id: string;
    employee_id: string;
    manager_employee_id: string | null;
    employeeName: string;
    cycleLabel: string;
    status: string;
  };
  workplanItems: Array<{
    id: string;
    major_task: string;
    corporate_objective: string;
    division_objective: string;
    key_output: string;
    weight: number;
    metric_target: number | null;
  }>;
  currentUser: { employee_id: string | null; roles: string[] };
}

export default function CheckInsPage() {
  const router = useRouter();
  const params = useParams();
  const appraisalId = params.id as string;
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/appraisals/${appraisalId}/checkins`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setData(json);
    } catch (e) {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [appraisalId]);

  if (loading && !data) {
    return (
      <div className="max-w-7xl mx-auto py-6 px-4">
        <p className="text-[13px] text-[#8a97b8]">Loading check-ins…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto py-6 px-4">
        <p className="text-[13px] text-[#dc2626]">Failed to load check-ins.</p>
        <button
          type="button"
          onClick={() => router.push(`/appraisals/${appraisalId}`)}
          className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#3b82f6] hover:text-[#1d4ed8] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to appraisal
        </button>
      </div>
    );
  }

  const { checkIns, appraisal, workplanItems, currentUser } = data;
  const isManager = appraisal.manager_employee_id === currentUser.employee_id;
  const isHR = currentUser.roles.includes("hr") || currentUser.roles.includes("admin");
  const isEmployee = appraisal.employee_id === currentUser.employee_id;
  const role: "EMPLOYEE" | "MANAGER" | "HR" = isHR ? "HR" : isManager ? "MANAGER" : "EMPLOYEE";
  const canCreateCheckin = isManager || isHR;

  const workplanApproved = workplanItems.length > 0;
  const activeCheckIns = checkIns.filter(
    (c) => c.status === "OPEN" || c.status === "EMPLOYEE_SUBMITTED"
  );
  const hasOpenCheckin = activeCheckIns.length > 0;
  const pastCheckIns = checkIns.filter(
    (c) => c.status === "COMPLETE" || c.status === "MANAGER_REVIEWED" || c.status === "CANCELLED"
  );

  const stageStyle = STAGE_STYLES[appraisal.status] ?? STAGE_STYLES.DRAFT;

  return (
    <div className="max-w-7xl mx-auto py-6 px-4" style={{ fontFamily: "DM Sans, sans-serif" }}>
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#3b82f6] hover:text-[#1d4ed8] transition-colors mb-5"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to appraisal
      </button>

      {/* Appraisal context card */}
      <div
        className="bg-white border border-[#dde5f5] rounded-[14px] overflow-hidden mb-5"
        style={{ boxShadow: "0 2px 12px rgba(15,31,61,0.07)" }}
      >
        <div className="flex items-center gap-3 px-5 py-4 bg-[#f8faff] border-b border-[#dde5f5] flex-wrap">
          <div className="w-9 h-9 rounded-[10px] bg-[#eef2fb] border border-[#dde5f5] flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4a5a82" strokeWidth="2">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-['Sora'] text-[14px] font-bold text-[#0f1f3d]">{appraisal.employeeName}</p>
            <p className="text-[11px] text-[#8a97b8] mt-0.5">{appraisal.cycleLabel} · Annual Review</p>
          </div>
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold"
            style={{
              background: stageStyle.bg,
              borderColor: stageStyle.border,
              color: stageStyle.text,
            }}
          >
            <span className="w-[5px] h-[5px] rounded-full flex-shrink-0" style={{ background: stageStyle.dot }} />
            {stageStyle.label}
          </span>
          <div className="w-px h-5 bg-[#dde5f5]" />
          <span className="text-[11px] text-[#8a97b8]">Progress tracking · Not scored</span>
        </div>
        {!workplanApproved && (
          <div className="flex items-center gap-3 px-5 py-3.5 bg-[#fffbeb] border-t border-[#fcd34d]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-[12px] text-[#92400e]">
              Check-ins are available once the workplan has been approved by the manager.
            </p>
          </div>
        )}
      </div>

      {/* Active check-in card */}
      {activeCheckIns.length > 0 && (
        <div
          className="bg-white border-2 border-[#0d9488] rounded-[14px] overflow-hidden mb-5"
          style={{ boxShadow: "0 2px 12px rgba(15,31,61,0.07)" }}
        >
          <div className="flex items-center gap-3 px-5 py-3.5 bg-[#f0fdfa] border-b border-[#99f6e4]">
            <div className="w-8 h-8 rounded-[8px] bg-[#ecfdf5] border border-[#6ee7b7] flex items-center justify-center flex-shrink-0">
              {activeCheckIns[0].status === "EMPLOYEE_SUBMITTED" ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[#0f766e]">{activeCheckIns[0].title}</p>
              <p className="text-[11px] text-[#0d9488] mt-0.5">
                {formatType(activeCheckIns[0].check_in_type)} · Due {formatDate(activeCheckIns[0].due_date)}
              </p>
            </div>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold"
              style={
                activeCheckIns[0].status === "OPEN"
                  ? { background: "#fffbeb", borderColor: "#fcd34d", color: "#92400e" }
                  : { background: "#eff6ff", borderColor: "#bfdbfe", color: "#1d4ed8" }
              }
            >
              {activeCheckIns[0].status === "OPEN" ? "Open" : "Submitted"}
            </span>
          </div>
          <CheckInCard
            appraisalId={appraisalId}
            checkIn={activeCheckIns[0]}
            role={role}
            onUpdate={load}
            embedded
          />
        </div>
      )}

      {/* Past check-ins section */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#8a97b8]">
            Past check-ins
          </p>
          {pastCheckIns.length > 0 && (
            <span className="text-[10px] text-[#8a97b8]">· {pastCheckIns.length}</span>
          )}
        </div>
        {canCreateCheckin && workplanApproved && !hasOpenCheckin && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[8px] bg-[#0f1f3d] text-white text-[11px] font-semibold hover:bg-[#1a3260] transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New check-in
          </button>
        )}
        {canCreateCheckin && workplanApproved && hasOpenCheckin && (
          <span className="text-[11px] text-[#8a97b8]">
            Complete the current check-in before starting a new one
          </span>
        )}
        {canCreateCheckin && !workplanApproved && (
          <span className="text-[11px] text-[#8a97b8]">Available after workplan is approved</span>
        )}
      </div>

      {pastCheckIns.length > 0 ? (
        <div className="space-y-2">
          {pastCheckIns.map((c) => (
            <CheckInCard
              key={c.id}
              appraisalId={appraisalId}
              checkIn={c}
              role={role}
              onUpdate={load}
            />
          ))}
        </div>
      ) : (
        !hasOpenCheckin && (
          <div
            className="bg-white border border-[#dde5f5] rounded-[14px] flex flex-col items-center justify-center py-12 gap-3"
            style={{ boxShadow: "0 2px 12px rgba(15,31,61,0.07)" }}
          >
            <div className="w-12 h-12 rounded-[14px] bg-[#f8faff] border border-[#dde5f5] flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8a97b8" strokeWidth="1.5">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
              </svg>
            </div>
            <p className="text-[13px] font-semibold text-[#0f1f3d] font-['Sora']">No check-ins yet this year</p>
            <p className="text-[12px] text-[#8a97b8] text-center max-w-[280px]">
              {workplanApproved
                ? "Your manager can initiate a check-in at any time"
                : "Check-ins are available once your workplan is approved"}
            </p>
          </div>
        )
      )}

      {showModal && (
        <NewCheckInModal
          appraisalId={appraisalId}
          employeeName={appraisal.employeeName}
          cycleLabel={appraisal.cycleLabel}
          workplanItems={workplanItems}
          onCreated={(checkIn: CheckIn) => {
            load();
            setShowModal(false);
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
