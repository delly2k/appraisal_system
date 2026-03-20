"use client";

import { useEffect, useState, useCallback } from "react";
import { CompletionBar } from "./CompletionBar";
import type { CompletionReport } from "@/lib/appraisal-completion";
import type { AppraisalStatus } from "@/types/appraisal";
import type { WorkflowRole } from "@/lib/appraisal-workflow";

interface CompletionBarWrapperProps {
  appraisalId: string;
  status: AppraisalStatus;
  userRole: WorkflowRole;
  showLeadership: boolean;
  isEmployee: boolean;
  isManager: boolean;
  isHR: boolean;
  approvals?: { role: string }[];
  signoffs?: { role: string; stage: string }[];
}

export function CompletionBarWrapper({
  appraisalId,
  status,
  userRole,
  showLeadership,
  isEmployee,
  isManager,
  isHR,
  approvals = [],
  signoffs = [],
}: CompletionBarWrapperProps) {
  const [report, setReport] = useState<CompletionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCompletion = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/appraisals/${appraisalId}/completion?showLeadership=${showLeadership ? "true" : "false"}`
      );
      const data = await res.json();
      if (res.ok && data?.sections) {
        setReport(data as CompletionReport);
      } else {
        setReport(null);
      }
    } catch {
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [appraisalId, showLeadership]);

  useEffect(() => {
    fetchCompletion();
  }, [fetchCompletion]);

  useEffect(() => {
    const handler = () => { fetchCompletion(); };
    window.addEventListener("appraisal-completion-invalidate", handler);
    return () => window.removeEventListener("appraisal-completion-invalidate", handler);
  }, [fetchCompletion]);

  const handlePhaseSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      if (status === "DRAFT") {
        const res = await fetch(`/api/appraisals/${appraisalId}/submit-for-approval`, { method: "POST" });
        const data = await res.json();
        if (res.ok) window.location.reload();
        else alert(data.error || "Failed to submit");
      } else if (status === "PENDING_APPROVAL") {
        const role = isEmployee ? "EMPLOYEE" : isManager ? "MANAGER" : null;
        if (!role) return;
        const res = await fetch(`/api/appraisals/${appraisalId}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        });
        const data = await res.json();
        if (res.ok) window.location.reload();
        else alert(data.error || "Failed to approve");
      } else if (status === "SELF_ASSESSMENT") {
        const res = await fetch(`/api/appraisals/${appraisalId}/submit-self-assessment`, { method: "POST" });
        const data = await res.json();
        if (res.ok) window.location.reload();
        else alert(data.error || "Failed");
      } else if (status === "MANAGER_REVIEW") {
        window.dispatchEvent(new CustomEvent("appraisal-navigate-to-tab", { detail: { tabKey: "signoffs" } }));
        return;
      } else if (status === "PENDING_SIGNOFF") {
        const role = isEmployee ? "EMPLOYEE" : isManager ? "MANAGER" : null;
        if (!role) return;
        const res = await fetch(`/api/appraisals/${appraisalId}/signoff`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role, stage: "PENDING_SIGNOFF" }),
        });
        const data = await res.json();
        if (res.ok) window.location.reload();
        else alert(data.error || "Failed");
      } else if (status === "HR_REVIEW") {
        const res = await fetch(`/api/appraisals/${appraisalId}/complete`, { method: "POST" });
        const data = await res.json();
        if (res.ok) window.location.reload();
        else alert(data.error || "Failed");
      } else {
        alert("No action available for this status");
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setIsSubmitting(false);
    }
  }, [appraisalId, status, isEmployee, isManager]);

  // Hide progress bar until assessment stages (In progress uses tab "Start self-assessment" button only)
  if (status === "DRAFT" || status === "PENDING_APPROVAL" || status === "IN_PROGRESS" || status === "COMPLETE") return null;

  // Show progress bar for SELF_ASSESSMENT through HR_REVIEW; use empty report while loading or on error
  const displayReport: CompletionReport =
    report ?? {
      sections: [],
      completedFields: 0,
      totalFields: 0,
      canSubmit: false,
      blockers: [],
    };

  return (
    <CompletionBar
      report={displayReport}
      status={status}
      userRole={userRole}
      onSubmit={handlePhaseSubmit}
      isSubmitting={isSubmitting}
    />
  );
}
