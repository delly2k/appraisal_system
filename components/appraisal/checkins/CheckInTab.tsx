"use client";

import { useEffect, useState } from "react";
import type { CheckInWithResponses, CheckIn } from "@/types/checkins";
import { ActiveCheckInCard } from "./ActiveCheckInCard";
import { HistoryCheckInCard } from "./HistoryCheckInCard";
import { NewCheckInModal } from "./NewCheckInModal";

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

interface CheckInTabProps {
  appraisalId: string;
  isManager: boolean;
  isHR: boolean;
  isEmployee: boolean;
  onStatusChange?: () => void;
  testBypass?: boolean;
}

export function CheckInTab({
  appraisalId,
  isManager,
  isHR,
  isEmployee,
  onStatusChange,
  testBypass = false,
}: CheckInTabProps) {
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
      onStatusChange?.();
    } catch {
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
      <div className="py-6">
        <p className="text-[13px] text-[#8a97b8]">Loading check-ins…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-6">
        <p className="text-[13px] text-[#dc2626]">Failed to load check-ins.</p>
      </div>
    );
  }

  const { checkIns, appraisal, workplanItems, currentUser } = data;
  const currentEmployeeId = currentUser.employee_id ?? null;
  const isThisMyAppraisal = appraisal.employee_id === currentEmployeeId;
  const isIAmTheManager =
    appraisal.manager_employee_id != null &&
    appraisal.manager_employee_id === currentEmployeeId;
  const isIAmHR = (currentUser.roles ?? []).includes("hr");
  const workplanApproved = workplanItems.length > 0 || appraisal.status === "IN_PROGRESS";
  const activeCheckIns = checkIns.filter(
    (c) => c.status === "OPEN" || c.status === "EMPLOYEE_SUBMITTED"
  );
  const hasActiveCheckIn = activeCheckIns.length > 0;
  const activeCheckIn = activeCheckIns[0];
  const showManagerViewForBypass =
    testBypass && activeCheckIn?.status === "EMPLOYEE_SUBMITTED";
  // Priority: when testBypass and check-in is EMPLOYEE_SUBMITTED, show manager view so user can complete as manager. Else: employee ownership > manager > HR.
  const role: "MANAGER" | "EMPLOYEE" | "HR" = showManagerViewForBypass
    ? "MANAGER"
    : isThisMyAppraisal
      ? "EMPLOYEE"
      : isIAmTheManager || testBypass
        ? "MANAGER"
        : isIAmHR
          ? "HR"
          : "EMPLOYEE";
  const canCreateCheckin = isIAmTheManager || isIAmHR || testBypass;
  const pastCheckIns = checkIns.filter(
    (c) => c.status === "COMPLETE" || c.status === "MANAGER_REVIEWED" || c.status === "CANCELLED"
  );
  const completedCount = pastCheckIns.length;

  return (
    <div className="py-4">
      {!workplanApproved && (
        <div className="flex items-center gap-3 px-4 py-3 bg-[#fffbeb] border border-[#fcd34d] rounded-[10px] mb-4">
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

      {hasActiveCheckIn && (
        <ActiveCheckInCard
          appraisalId={appraisalId}
          checkIn={activeCheckIns[0]}
          appraisal={appraisal}
          currentUser={currentUser}
          role={role}
          onUpdate={load}
        />
      )}

      <div className="flex items-center justify-between mt-6 mb-3">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[.07em] text-[#8a97b8]">
            Past check-ins
          </p>
          {completedCount > 0 && (
            <span className="text-[10px] text-[#8a97b8]">· {completedCount}</span>
          )}
        </div>
        {canCreateCheckin && !hasActiveCheckIn && (
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
        {canCreateCheckin && hasActiveCheckIn && (
          <span className="text-[11px] text-[#8a97b8]">
            Complete the current check-in before starting a new one
          </span>
        )}
      </div>

      {pastCheckIns.length > 0 ? (
        <div className="space-y-2">
          {pastCheckIns.map((c) => (
            <HistoryCheckInCard key={c.id} checkIn={c} />
          ))}
        </div>
      ) : (
        !hasActiveCheckIn && (
          <div
            className="flex flex-col items-center py-12 gap-3 border border-[#dde5f5] rounded-[14px] bg-white"
            style={{ boxShadow: "0 2px 12px rgba(15,31,61,0.07)" }}
          >
            <div className="w-10 h-10 rounded-[12px] bg-[#f8faff] border border-[#dde5f5] flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8a97b8" strokeWidth="1.5">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
              </svg>
            </div>
            <p className="text-[13px] font-semibold text-[#0f1f3d]">No check-ins this year</p>
            <p className="text-[12px] text-[#8a97b8] text-center max-w-[280px]">
              {canCreateCheckin
                ? "Use the button above to initiate a check-in"
                : "Managers can initiate a check-in at any time during the in-progress stage"}
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
