"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { WorkplanSection } from "./WorkplanSection";
import { EvidenceBuilder } from "./EvidenceBuilder";
import { CoreCompetenciesSection } from "./CoreCompetenciesSection";
import { TechnicalCompetenciesSection } from "./TechnicalCompetenciesSection";
import { ProductivitySection } from "./ProductivitySection";
import { LeadershipSection } from "./LeadershipSection";
import { SummaryTab } from "./SummaryTab";
import { SignoffsTab } from "./SignoffsTab";
import { HRActionsTab } from "./HRActionsTab";
import { AuditTrailTab } from "./AuditTrailTab";
import { canEditField, type WorkflowRole } from "@/lib/appraisal-workflow";
import type { SummaryResult } from "@/lib/summary-calc";
import type { AppraisalStatus } from "@/types/appraisal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface AppraisalData {
  id: string;
  employee_id: string;
  manager_employee_id: string | null;
  cycle_id: string;
  status: string;
  is_management: boolean;
  employeeName: string;
  cycleName: string;
  cycleStartDate?: string;
  cycleEndDate?: string;
  approvals?: { role: string }[];
  signoffs?: { role: string; stage: string; signed_at?: string; comment?: string }[];
}

interface AppraisalTabsProps {
  appraisal: AppraisalData;
  cyclePhase: string;
  currentUserId: string | null;
  currentUserEmployeeId: string | null;
  isManager: boolean;
  isHR: boolean;
  isHOD?: boolean;
  showLeadership?: boolean;
  approvals?: { role: string }[];
  signoffs?: { role: string; stage: string; signed_at?: string; comment?: string }[];
  hrRecommendationsSaved?: boolean;
}

type TabValue = "workplan" | "core" | "technical" | "productivity" | "leadership" | "summary" | "signoffs" | "hractions" | "audit";

const ClipboardIcon = () => (
  <svg style={{ width: 15, height: 15 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </svg>
);

const AwardIcon = () => (
  <svg style={{ width: 15, height: 15 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="8" r="6" />
    <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
  </svg>
);

const WrenchIcon = () => (
  <svg style={{ width: 15, height: 15 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

const TrendingUpIcon = () => (
  <svg style={{ width: 15, height: 15 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const UsersIcon = () => (
  <svg style={{ width: 15, height: 15 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const FileTextIcon = () => (
  <svg style={{ width: 15, height: 15 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const SendIcon = () => (
  <svg style={{ width: 15, height: 15 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const PenLineIcon = () => (
  <svg style={{ width: 15, height: 15 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 19l7-7 3 3-7 7-3-3z" />
    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
    <path d="M2 2l7.586 7.586" />
    <path d="M11 11l2 2" />
  </svg>
);

const HRActionsIcon = () => (
  <svg style={{ width: 15, height: 15 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
    <path d="M10 9H8" />
  </svg>
);

const HistoryIcon = () => (
  <svg style={{ width: 15, height: 15 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

interface Tab {
  id: TabValue;
  label: string;
  icon: React.ReactNode;
}

function ApprovalSignoffPanel({
  variant,
  appraisalId,
  statusLabel,
  subLabel,
  badges,
  actionButtonLabel,
  showActionButton,
  onAction,
  requestChangesLabel,
  onRequestChanges,
  bypassMode,
  primaryActionLabel,
  primaryActionEnabled,
  onPrimaryAction,
  secondaryActionLabel,
  secondaryActionEnabled,
  onSecondaryAction,
}: {
  variant: "approval" | "signoff";
  appraisalId: string;
  statusLabel: string;
  subLabel: string;
  badges: { label: string; done: boolean }[];
  actionButtonLabel: string;
  showActionButton: boolean;
  onAction: () => void | Promise<void>;
  requestChangesLabel?: string;
  onRequestChanges?: () => void | Promise<void>;
  bypassMode?: boolean;
  primaryActionLabel?: string;
  primaryActionEnabled?: boolean;
  onPrimaryAction?: () => void | Promise<void>;
  secondaryActionLabel?: string;
  secondaryActionEnabled?: boolean;
  onSecondaryAction?: () => void | Promise<void>;
}) {
  const buttonStyle = {
    padding: "9px 20px",
    borderRadius: "8px",
    border: "none",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer" as const,
  };
  const primaryBtnStyle = {
    ...buttonStyle,
    background: "linear-gradient(135deg, #059669, #047857)",
    color: "white",
    boxShadow: "0 2px 8px rgba(5,150,105,0.35)",
  };
  const secondaryBtnStyle = {
    ...buttonStyle,
    background: "linear-gradient(135deg, #059669, #047857)",
    color: "white",
    boxShadow: "0 2px 8px rgba(5,150,105,0.35)",
  };
  const disabledBtnStyle = { ...buttonStyle, background: "#e2e8f0", color: "#94a3b8", cursor: "not-allowed" as const };

  const renderActionButtons = () => {
    if (bypassMode && primaryActionLabel != null && secondaryActionLabel != null && onPrimaryAction && onSecondaryAction) {
      return (
        <>
          <button
            type="button"
            onClick={() => onPrimaryAction()}
            disabled={!primaryActionEnabled}
            style={primaryActionEnabled ? primaryBtnStyle : disabledBtnStyle}
          >
            {primaryActionLabel}
          </button>
          <button
            type="button"
            onClick={() => onSecondaryAction()}
            disabled={!secondaryActionEnabled}
            style={secondaryActionEnabled ? secondaryBtnStyle : disabledBtnStyle}
          >
            {secondaryActionLabel}
          </button>
        </>
      );
    }
    if (showActionButton) {
      return (
        <button type="button" onClick={() => onAction()} style={primaryBtnStyle}>
          {actionButtonLabel}
        </button>
      );
    }
    return null;
  };

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #fffbeb, #fef3c7)",
        border: "1px solid #fde68a",
        borderRadius: "12px",
        padding: "20px 24px",
        marginBottom: "20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div>
          <div style={{ fontFamily: "Sora", fontSize: "15px", fontWeight: 600, color: "#92400e" }}>
            {statusLabel}
          </div>
          <div style={{ fontSize: "12.5px", color: "#b45309", marginTop: "3px" }}>{subLabel}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {badges.map((b) => (
          <span
            key={b.label}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              borderRadius: "20px",
              background: b.done ? "#f0fdf4" : "#fff1f2",
              border: `1px solid ${b.done ? "#bbf7d0" : "#fecdd3"}`,
              fontSize: "12px",
              fontWeight: 600,
              color: b.done ? "#166534" : "#9f1239",
            }}
          >
            {b.done ? "✓" : "○"} {b.label}
          </span>
        ))}
        {renderActionButtons()}
        {variant === "approval" && onRequestChanges && (
          <button
            type="button"
            onClick={() => onRequestChanges()}
            style={{
              padding: "9px 18px",
              borderRadius: "8px",
              background: "#fff1f2",
              border: "1px solid #fecdd3",
              fontSize: "13px",
              fontWeight: 600,
              color: "#e11d48",
              cursor: "pointer",
            }}
          >
            {requestChangesLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export function AppraisalTabs({
  appraisal,
  cyclePhase,
  currentUserId,
  currentUserEmployeeId,
  isManager,
  isHR,
  isHOD = false,
  showLeadership: showLeadershipProp,
  approvals = [],
  signoffs = [],
  hrRecommendationsSaved = false,
}: AppraisalTabsProps) {
  const [activeTab, setActiveTab] = useState<TabValue>("workplan");
  const [dirtyTabs, setDirtyTabs] = useState<Set<string>>(new Set());
  const router = useRouter();

  const markDirty = useCallback((tab: string) => {
    setDirtyTabs((prev) => new Set(prev).add(tab));
  }, []);
  const markClean = useCallback((tab: string) => {
    setDirtyTabs((prev) => {
      const next = new Set(prev);
      next.delete(tab);
      return next;
    });
  }, []);
  const hasAnyUnsaved = dirtyTabs.size > 0;

  const handleTabChange = useCallback(
    (newTab: string) => {
      if (newTab === activeTab) return;
      if (hasAnyUnsaved) {
        const ok = window.confirm("You have unsaved changes. Switch tabs without saving?");
        if (!ok) return;
      }
      setActiveTab(newTab as TabValue);
    },
    [activeTab, hasAnyUnsaved]
  );

  const safeNavigate = useCallback(
    (href: string) => {
      if (hasAnyUnsaved) {
        const ok = window.confirm("You have unsaved changes. Leave without saving?");
        if (!ok) return;
      }
      router.push(href);
    },
    [hasAnyUnsaved, router]
  );
  const [submitSelfAssessmentSubmitting, setSubmitSelfAssessmentSubmitting] = useState(false);
  const [selfAssessmentCanSubmit, setSelfAssessmentCanSubmit] = useState<boolean | null>(null);
  const [canSubmitForApproval, setCanSubmitForApproval] = useState<boolean | null>(null);
  const [submitForApprovalSubmitting, setSubmitForApprovalSubmitting] = useState(false);
  const [requestChangesModalOpen, setRequestChangesModalOpen] = useState(false);
  const [requestChangesReason, setRequestChangesReason] = useState("");
  const [requestChangesSubmitting, setRequestChangesSubmitting] = useState(false);
  const [managerReviewRecallModalOpen, setManagerReviewRecallModalOpen] = useState(false);
  const [managerReviewSubmitting, setManagerReviewSubmitting] = useState(false);
  const [managerReviewCanSubmit, setManagerReviewCanSubmit] = useState<boolean | null>(null);
  const [summaryTotalPoints, setSummaryTotalPoints] = useState<number>(0);

  const handleSummaryResult = useCallback((result: SummaryResult) => {
    setSummaryTotalPoints(result.totalPoints);
  }, []);

  const isEmployee = currentUserEmployeeId === appraisal.employee_id;
  const isAppraisalManager = currentUserEmployeeId === appraisal.manager_employee_id;
  const showLeadership = showLeadershipProp ?? appraisal.is_management;
  const testBypass = process.env.NEXT_PUBLIC_ALLOW_APPRAISAL_TEST_BYPASS === "true";

  // Troubleshooting: employee / Self Assessment editability
  console.log("[AppraisalTabs] employee check", {
    currentUserEmployeeId,
    appraisalEmployeeId: appraisal.employee_id,
    match: currentUserEmployeeId === appraisal.employee_id,
    isEmployee,
    currentUserLength: currentUserEmployeeId?.length,
    appraisalLength: appraisal.employee_id?.length,
    currentUserJson: JSON.stringify(currentUserEmployeeId),
    appraisalJson: JSON.stringify(appraisal.employee_id),
  });

  const status = ((appraisal.status ?? "DRAFT") as string).toUpperCase() as AppraisalStatus;
  const userRole: WorkflowRole = isHR ? "HR" : isAppraisalManager ? "MANAGER" : isEmployee ? "EMPLOYEE" : "MANAGER";

  // When employee can submit self-assessment, fetch completion to enable/disable the Submit button
  const showSelfAssessmentSubmit = status === "SELF_ASSESSMENT" && isEmployee;
  useEffect(() => {
    if (!showSelfAssessmentSubmit || !appraisal.id) {
      setSelfAssessmentCanSubmit(null);
      return;
    }
    let cancelled = false;
    const fetchCompletion = () => {
      fetch(`/api/appraisals/${appraisal.id}/completion?showLeadership=${showLeadership ? "true" : "false"}`)
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (!cancelled && data && typeof data.canSubmit === "boolean") {
            setSelfAssessmentCanSubmit(data.canSubmit);
          } else if (!cancelled) {
            setSelfAssessmentCanSubmit(false);
          }
        })
        .catch(() => { if (!cancelled) setSelfAssessmentCanSubmit(false); });
    };
    fetchCompletion();
    const onInvalidate = () => fetchCompletion();
    window.addEventListener("appraisal-completion-invalidate", onInvalidate);
    return () => {
      cancelled = true;
      window.removeEventListener("appraisal-completion-invalidate", onInvalidate);
    };
  }, [showSelfAssessmentSubmit, appraisal.id, showLeadership]);

  // Listen for completion panel blocker clicks to navigate to tab
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ tabKey: string }>).detail;
      if (detail?.tabKey) handleTabChange(detail.tabKey);
    };
    window.addEventListener("appraisal-navigate-to-tab", handler);
    return () => window.removeEventListener("appraisal-navigate-to-tab", handler);
  }, [handleTabChange]);

  // When DRAFT and employee/manager, fetch full completion so Submit for Approval requires all sections
  const showSubmitForApproval = status === "DRAFT" && (isEmployee || isAppraisalManager);
  useEffect(() => {
    if (!showSubmitForApproval || !appraisal.id) {
      setCanSubmitForApproval(null);
      return;
    }
    let cancelled = false;
    const fetchCanSubmit = () => {
      fetch(`/api/appraisals/${appraisal.id}/completion?showLeadership=${showLeadership ? "true" : "false"}`, { cache: "no-store" })
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (!cancelled && data && typeof data.canSubmit === "boolean") {
            setCanSubmitForApproval(data.canSubmit);
          } else {
            setCanSubmitForApproval(false);
          }
        })
        .catch(() => { if (!cancelled) setCanSubmitForApproval(false); });
    };
    fetchCanSubmit();
    const onInvalidate = () => fetchCanSubmit();
    window.addEventListener("appraisal-completion-invalidate", onInvalidate);
    return () => {
      cancelled = true;
      window.removeEventListener("appraisal-completion-invalidate", onInvalidate);
    };
  }, [showSubmitForApproval, appraisal.id, showLeadership]);

  // When manager can submit review, fetch completion so Recall/Submit bar can enable/disable the Submit button
  const showManagerReviewActions = status === "MANAGER_REVIEW" && (isAppraisalManager || testBypass);
  useEffect(() => {
    if (!showManagerReviewActions || !appraisal.id) {
      setManagerReviewCanSubmit(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/appraisals/${appraisal.id}/completion?showLeadership=${showLeadership ? "true" : "false"}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!cancelled && data && typeof data.canSubmit === "boolean") {
          setManagerReviewCanSubmit(data.canSubmit);
        } else {
          setManagerReviewCanSubmit(false);
        }
      })
      .catch(() => { if (!cancelled) setManagerReviewCanSubmit(false); });
    const onInvalidate = () => fetch(`/api/appraisals/${appraisal.id}/completion?showLeadership=${showLeadership ? "true" : "false"}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data && typeof data.canSubmit === "boolean") setManagerReviewCanSubmit(data.canSubmit);
      });
    window.addEventListener("appraisal-completion-invalidate", onInvalidate);
    return () => {
      cancelled = true;
      window.removeEventListener("appraisal-completion-invalidate", onInvalidate);
    };
  }, [showManagerReviewActions, appraisal.id, showLeadership]);

  const canEditSelfRatings =
    (status === "SELF_ASSESSMENT" && isEmployee) ||
    canEditField("self_rating", status, userRole) ||
    canEditField("self_comments", status, userRole);
  const canEditManagerRatings = canEditField("manager_rating", status, userRole) || canEditField("manager_comments", status, userRole);
  const effectiveCanEditManagerRatings = canEditManagerRatings || (testBypass && status === "MANAGER_REVIEW");

  const tabs: Tab[] = [
    { id: "workplan", label: "Workplan", icon: <ClipboardIcon /> },
    { id: "core", label: "Core Competencies", icon: <AwardIcon /> },
    { id: "technical", label: "Technical", icon: <WrenchIcon /> },
    { id: "productivity", label: "Productivity", icon: <TrendingUpIcon /> },
    ...(showLeadership ? [{ id: "leadership" as const, label: "Leadership", icon: <UsersIcon /> }] : []),
    { id: "summary", label: "Summary", icon: <FileTextIcon /> },
    ...((status === "PENDING_SIGNOFF" || status === "HOD_REVIEW" || status === "HR_REVIEW" || status === "COMPLETE") ? [{ id: "signoffs" as const, label: "Sign-offs", icon: <PenLineIcon /> }] : []),
    ...(isHR ? [{ id: "hractions" as const, label: "HR Actions", icon: <HRActionsIcon /> }] : []),
    { id: "audit", label: "Audit trail", icon: <HistoryIcon /> },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "workplan":
        return (
          <>
            {status === "SELF_ASSESSMENT" && appraisal.cycleStartDate && appraisal.cycleEndDate && (
              <EvidenceBuilder
                appraisalId={appraisal.id}
                employeeId={appraisal.employee_id}
                reviewStart={appraisal.cycleStartDate}
                reviewEnd={appraisal.cycleEndDate}
                status={appraisal.status}
              />
            )}
            <WorkplanSection
              appraisalId={appraisal.id}
              appraisalStatus={appraisal.status}
              cyclePhase={cyclePhase}
              isEmployee={isEmployee}
              isManager={isAppraisalManager}
              isHR={isHR}
              onDirtyChange={(dirty) => (dirty ? markDirty("workplan") : markClean("workplan"))}
            />
          </>
        );
      case "core":
        return (
          <CoreCompetenciesSection
            appraisalId={appraisal.id}
            canEditSelfRatings={canEditSelfRatings}
            canEditManagerRatings={effectiveCanEditManagerRatings}
            canEditWeights={status === "DRAFT"}
            onDirtyChange={(dirty) => (dirty ? markDirty("core") : markClean("core"))}
          />
        );
      case "technical":
        return (
          <TechnicalCompetenciesSection
            appraisalId={appraisal.id}
            canEditSetup={status === "DRAFT" && (isEmployee || isAppraisalManager || isHR)}
            canDeleteCompetencies={status === "DRAFT" && (isEmployee || isAppraisalManager || isHR)}
            canEditSelfRatings={canEditSelfRatings}
            canEditManagerRatings={effectiveCanEditManagerRatings}
            onDirtyChange={(dirty) => (dirty ? markDirty("technical") : markClean("technical"))}
          />
        );
      case "productivity":
        return (
          <ProductivitySection
            appraisalId={appraisal.id}
            canEditSelfRatings={canEditSelfRatings}
            canEditManagerRatings={effectiveCanEditManagerRatings}
            canEditWeights={status === "DRAFT"}
            onDirtyChange={(dirty) => (dirty ? markDirty("productivity") : markClean("productivity"))}
          />
        );
      case "leadership":
        return showLeadership ? (
          <LeadershipSection
            appraisalId={appraisal.id}
            canEditSelfRatings={canEditSelfRatings}
            canEditManagerRatings={effectiveCanEditManagerRatings}
            canEditWeights={status === "DRAFT"}
            onDirtyChange={(dirty) => (dirty ? markDirty("leadership") : markClean("leadership"))}
          />
        ) : null;
      case "summary":
        return (
          <SummaryTab
            appraisalId={appraisal.id}
            appraisal={appraisal}
            showLeadership={showLeadership}
            isHR={isHR}
            isManager={isAppraisalManager}
            isEmployee={isEmployee}
            currentUserEmployeeId={currentUserEmployeeId}
            onSummaryResult={handleSummaryResult}
          />
        );
      case "signoffs":
        return (
          <SignoffsTab
            appraisalId={appraisal.id}
            appraisal={appraisal}
            signoffs={signoffs}
            isEmployee={isEmployee}
            isAppraisalManager={isAppraisalManager}
            isHOD={isHOD}
          />
        );
      case "hractions":
        return (
          <HRActionsTab
            appraisalId={appraisal.id}
            status={status}
            isHR={isHR}
          />
        );
      case "audit":
        return <AuditTrailTab appraisalId={appraisal.id} />;
      default:
        return null;
    }
  };

  const isPendingApproval = status === "PENDING_APPROVAL";
  const isPendingSignoff = status === "PENDING_SIGNOFF";
  const approvedEmployee = approvals.some((a) => a.role === "EMPLOYEE");
  const approvedManager = approvals.some((a) => a.role === "MANAGER");
  const signedEmployee = signoffs.some((s) => s.role === "EMPLOYEE");
  const signedManager = signoffs.some((s) => s.role === "MANAGER");
  const signedHOD = signoffs.some((s) => s.role === "HOD" && s.stage === "HOD_REVIEW");
  const allSignoffsComplete = signedManager && signedEmployee && signedHOD;
  const managerSignoff = signoffs.find((s) => s.role === "MANAGER");
  const employeeSignoff = signoffs.find((s) => s.role === "EMPLOYEE");
  const canManagerSign = status === "PENDING_SIGNOFF" && isAppraisalManager && !signedManager;
  const canEmployeeSign = status === "PENDING_SIGNOFF" && isEmployee && !signedEmployee;
  const currentUserRoleForApproval: "EMPLOYEE" | "MANAGER" | null = isEmployee ? "EMPLOYEE" : isAppraisalManager ? "MANAGER" : null;
  const currentUserHasNotApproved = currentUserRoleForApproval && !approvals.some((a) => a.role === currentUserRoleForApproval);
  const currentUserHasNotSigned = currentUserRoleForApproval && !signoffs.some((s) => s.role === currentUserRoleForApproval);

  return (
    <div>
      {/* Approval panel (PENDING_APPROVAL) */}
      {isPendingApproval && (
        <ApprovalSignoffPanel
          variant="approval"
          appraisalId={appraisal.id}
          statusLabel="Awaiting Workplan Approval"
          subLabel={`${approvedEmployee ? "Employee ✓" : "Employee ○"} · ${approvedManager ? "Manager ✓" : "Manager ○"} — both must approve to proceed`}
          badges={[
            { label: "Employee", done: approvedEmployee },
            { label: "Manager", done: approvedManager },
          ]}
          actionButtonLabel="Approve Workplan"
          showActionButton={!testBypass && !!currentUserHasNotApproved}
          onAction={async () => {
            if (!currentUserRoleForApproval) return;
            const res = await fetch(`/api/appraisals/${appraisal.id}/approve`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ role: currentUserRoleForApproval }),
            });
            const data = await res.json();
            if (res.ok) window.location.reload();
            else alert(data.error || "Failed to approve");
          }}
          requestChangesLabel="Request Changes"
          onRequestChanges={() => setRequestChangesModalOpen(true)}
          bypassMode={testBypass}
          primaryActionLabel={testBypass ? "Approve as Employee" : undefined}
          primaryActionEnabled={testBypass ? !approvedEmployee : undefined}
          onPrimaryAction={testBypass ? async () => {
            const res = await fetch(`/api/appraisals/${appraisal.id}/approve`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ role: "EMPLOYEE" }),
            });
            const data = await res.json();
            if (res.ok) window.location.reload();
            else alert(data.error || "Failed to approve");
          } : undefined}
          secondaryActionLabel={testBypass ? "Approve as Manager" : undefined}
          secondaryActionEnabled={testBypass ? !!approvedEmployee && !approvedManager : undefined}
          onSecondaryAction={testBypass ? async () => {
            const res = await fetch(`/api/appraisals/${appraisal.id}/approve`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ role: "MANAGER" }),
            });
            const data = await res.json();
            if (res.ok) window.location.reload();
            else alert(data.error || "Failed to approve");
          } : undefined}
        />
      )}

      {/* Request Changes modal (replaces browser prompt) */}
      <Dialog open={requestChangesModalOpen} onOpenChange={(open) => { if (!open) { setRequestChangesModalOpen(false); setRequestChangesReason(""); } }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Request Changes</DialogTitle>
            <DialogDescription>Provide a reason for requesting revision. The employee will return the workplan to draft.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="request-changes-reason">Reason for revision (optional)</Label>
              <Input
                id="request-changes-reason"
                value={requestChangesReason}
                onChange={(e) => setRequestChangesReason(e.target.value)}
                placeholder="Enter reason..."
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setRequestChangesModalOpen(false); setRequestChangesReason(""); }}
              disabled={requestChangesSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setRequestChangesSubmitting(true);
                try {
                  const res = await fetch(`/api/appraisals/${appraisal.id}/request-changes`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ reason: requestChangesReason ?? "" }),
                  });
                  if (res.ok) {
                    setRequestChangesModalOpen(false);
                    setRequestChangesReason("");
                    window.location.reload();
                  } else {
                    const data = await res.json();
                    alert(data.error || "Failed");
                  }
                } finally {
                  setRequestChangesSubmitting(false);
                }
              }}
              disabled={requestChangesSubmitting}
            >
              {requestChangesSubmitting ? "Submitting…" : "OK"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* HR: Mark as Complete (HR_REVIEW) */}
      {status === "HR_REVIEW" && isHR && (
        <div
          style={{
            background: "linear-gradient(135deg, #f0fdfa, #ccfbf1)",
            border: "1px solid #99f6e4",
            borderRadius: "12px",
            padding: "16px 24px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#0f766e" }}>
            HR Review — Review the appraisal and close when complete.
          </div>
          <button
            type="button"
            onClick={async () => {
              const res = await fetch(`/api/appraisals/${appraisal.id}/complete`, { method: "POST" });
              const data = await res.json();
              if (res.ok) window.location.reload();
              else alert(data.error || "Failed");
            }}
            style={{
              padding: "9px 20px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #0d9488, #0f766e)",
              border: "none",
              fontSize: "13px",
              fontWeight: 600,
              color: "white",
              cursor: "pointer",
            }}
          >
            Mark as Complete
          </button>
        </div>
      )}

      {/* Sign-off panel (PENDING_SIGNOFF) */}
      {isPendingSignoff && (
        <ApprovalSignoffPanel
          variant="signoff"
          appraisalId={appraisal.id}
          statusLabel="Awaiting Sign-off"
          subLabel={`${signedEmployee ? "Employee ✓" : "Employee ○"} · ${signedManager ? "Manager ✓" : "Manager ○"} — both must sign to proceed`}
          badges={[
            { label: "Employee", done: signedEmployee },
            { label: "Manager", done: signedManager },
          ]}
          actionButtonLabel="Sign Off"
          showActionButton={!testBypass && !!currentUserHasNotSigned}
          onAction={async () => {
            if (!currentUserRoleForApproval) return;
            const res = await fetch(`/api/appraisals/${appraisal.id}/signoff`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ role: currentUserRoleForApproval, stage: "PENDING_SIGNOFF" }),
            });
            const data = await res.json();
            if (res.ok) window.location.reload();
            else alert(data.error || "Failed to sign off");
          }}
          bypassMode={testBypass}
          primaryActionLabel={testBypass ? "Sign off as Employee" : undefined}
          primaryActionEnabled={testBypass ? !signedEmployee : undefined}
          onPrimaryAction={testBypass ? async () => {
            const res = await fetch(`/api/appraisals/${appraisal.id}/signoff`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ role: "EMPLOYEE", stage: "PENDING_SIGNOFF" }),
            });
            const data = await res.json();
            if (res.ok) window.location.reload();
            else alert(data.error || "Failed to sign off");
          } : undefined}
          secondaryActionLabel={testBypass ? "Sign off as Manager" : undefined}
          secondaryActionEnabled={testBypass ? !!signedEmployee && !signedManager : undefined}
          onSecondaryAction={testBypass ? async () => {
            const res = await fetch(`/api/appraisals/${appraisal.id}/signoff`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ role: "MANAGER", stage: "PENDING_SIGNOFF" }),
            });
            const data = await res.json();
            if (res.ok) window.location.reload();
            else alert(data.error || "Failed to sign off");
          } : undefined}
        />
      )}

      {/* Tab bar — full width, aligned with stepper */}
      <div className="w-full flex items-center gap-0.5 mb-6 overflow-x-auto overflow-y-hidden bg-white border-b border-[#dde5f5]">
        {hasAnyUnsaved && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#fffbeb] border border-[#fcd34d] ml-2 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d97706]" />
            <span className="text-[10px] font-semibold text-[#92400e]">Unsaved changes</span>
          </div>
        )}
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "14px 16px",
              fontSize: "13px",
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? "#3b82f6" : "#8a97b8",
              background: "none",
              border: "none",
              cursor: "pointer",
              borderBottom: activeTab === tab.id ? "2px solid #3b82f6" : "2px solid transparent",
              marginBottom: "-1px",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.color = "#4a5a82";
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.color = "#8a97b8";
              }
            }}
          >
            {tab.icon}
            {tab.id === "summary" && (
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: summaryTotalPoints > 0 ? "rgb(16 185 129)" : "rgb(156 163 175)" }}
                aria-hidden
              />
            )}
            {tab.id === "signoffs" && (
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  backgroundColor:
                    status !== "PENDING_SIGNOFF" && status !== "HOD_REVIEW" && status !== "HR_REVIEW" && status !== "COMPLETE"
                      ? "rgb(156 163 175)"
                      : allSignoffsComplete
                        ? "rgb(16 185 129)"
                        : "rgb(245 158 11)",
                }}
                aria-hidden
              />
            )}
            {tab.id === "hractions" && (
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  backgroundColor: hrRecommendationsSaved ? "rgb(16 185 129)" : "rgb(245 158 11)",
                }}
                aria-hidden
              />
            )}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Submit for Approval — below tabs, visible on all tabs when DRAFT (employee or manager) */}
      {showSubmitForApproval && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={async () => {
              setSubmitForApprovalSubmitting(true);
              try {
                const res = await fetch(`/api/appraisals/${appraisal.id}/submit-for-approval`, { method: "POST" });
                const data = await res.json();
                if (!res.ok) {
                  if (res.status === 422 && Array.isArray(data.blockers) && data.blockers.length > 0) {
                    window.dispatchEvent(new CustomEvent("appraisal-completion-invalidate"));
                    const msg = [data.error || "Cannot submit for approval — not all sections are complete.", "", ...data.blockers].join("\n");
                    throw new Error(msg);
                  }
                  throw new Error(data.error || "Failed to submit for approval");
                }
                window.location.reload();
              } catch (e) {
                alert(e instanceof Error ? e.message : "Failed to submit for approval");
              } finally {
                setSubmitForApprovalSubmitting(false);
              }
            }}
            disabled={submitForApprovalSubmitting || !canSubmitForApproval}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "9px 20px",
              borderRadius: "8px",
              background: !submitForApprovalSubmitting && canSubmitForApproval === true ? "linear-gradient(135deg, #059669, #047857)" : "#e2e8f0",
              border: "none",
              fontSize: "13px",
              fontWeight: 600,
              color: !submitForApprovalSubmitting && canSubmitForApproval === true ? "white" : "#94a3b8",
              cursor: !submitForApprovalSubmitting && canSubmitForApproval === true ? "pointer" : "not-allowed",
              boxShadow: !submitForApprovalSubmitting && canSubmitForApproval === true ? "0 2px 8px rgba(5,150,105,0.35)" : "none",
              transition: "all 0.16s",
            }}
          >
            <SendIcon /> {submitForApprovalSubmitting ? "Submitting…" : "Submit for Approval"}
          </button>
        </div>
      )}

      {/* Submit Self-Assessment — below tabs, visible on all tabs when in SELF_ASSESSMENT */}
      {status === "SELF_ASSESSMENT" && isEmployee && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={async () => {
              setSubmitSelfAssessmentSubmitting(true);
              try {
                const res = await fetch(`/api/appraisals/${appraisal.id}/submit-self-assessment`, { method: "POST" });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Failed");
                window.location.reload();
              } catch (e) {
                alert(e instanceof Error ? e.message : "Failed to submit");
              } finally {
                setSubmitSelfAssessmentSubmitting(false);
              }
            }}
            disabled={submitSelfAssessmentSubmitting || selfAssessmentCanSubmit !== true}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "9px 20px",
              borderRadius: "8px",
              background: !submitSelfAssessmentSubmitting && selfAssessmentCanSubmit === true ? "linear-gradient(135deg, #059669, #047857)" : "#e2e8f0",
              border: "none",
              fontSize: "13px",
              fontWeight: 600,
              color: !submitSelfAssessmentSubmitting && selfAssessmentCanSubmit === true ? "white" : "#94a3b8",
              cursor: !submitSelfAssessmentSubmitting && selfAssessmentCanSubmit === true ? "pointer" : "not-allowed",
            }}
          >
            <SendIcon /> {submitSelfAssessmentSubmitting ? "Submitting…" : "Submit Self-Assessment"}
          </button>
        </div>
      )}

      {/* Recall Submission + Submit Manager Review — below tabs, visible on all tabs when in MANAGER_REVIEW */}
      {status === "MANAGER_REVIEW" && (isEmployee || isAppraisalManager || testBypass) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
          {(status === "MANAGER_REVIEW" || status === "SUBMITTED") && isEmployee && (
            <button
              type="button"
              onClick={() => setManagerReviewRecallModalOpen(true)}
              disabled={managerReviewSubmitting}
              style={{
                display: "inline-flex", alignItems: "center", gap: "7px",
                padding: "9px 18px", borderRadius: "8px",
                background: "#fff1f2", border: "1px solid #fecdd3",
                fontSize: "13px", fontWeight: 600, color: "#e11d48", cursor: "pointer",
              }}
            >
              Recall Submission
            </button>
          )}
          {status === "MANAGER_REVIEW" && (isAppraisalManager || testBypass) && (
            <button
              type="button"
              onClick={async () => {
                setManagerReviewSubmitting(true);
                try {
                  const res = await fetch(`/api/appraisals/${appraisal.id}/submit-manager-review`, { method: "POST" });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "Failed");
                  window.location.reload();
                } catch {
                  setManagerReviewSubmitting(false);
                }
              }}
              disabled={managerReviewSubmitting || managerReviewCanSubmit !== true}
              style={{
                display: "inline-flex", alignItems: "center", gap: "7px",
                padding: "9px 20px", borderRadius: "8px",
                background: !managerReviewSubmitting && managerReviewCanSubmit === true ? "linear-gradient(135deg, #059669, #047857)" : "#e2e8f0",
                border: "none", fontSize: "13px", fontWeight: 600,
                color: !managerReviewSubmitting && managerReviewCanSubmit === true ? "white" : "#94a3b8",
                cursor: !managerReviewSubmitting && managerReviewCanSubmit === true ? "pointer" : "not-allowed",
              }}
            >
              <SendIcon /> {managerReviewSubmitting ? "Submitting…" : "Submit Manager Review"}
            </button>
          )}
        </div>
      )}

      {/* Tab content with animation */}
      <div
        key={activeTab}
        className="w-full"
        style={{ animation: "fadeUp 0.3s ease both" }}
      >
        {renderContent()}
      </div>

      {/* Recall Submission confirmation modal — portaled so overlay covers full screen */}
      {managerReviewRecallModalOpen && typeof document !== "undefined" && createPortal(
        <div style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}>
          <div style={{ background: "white", borderRadius: "14px", width: "100%", maxWidth: "400px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #dde5f5" }}>
              <h3 style={{ fontFamily: "Sora, sans-serif", fontSize: "18px", fontWeight: 600, color: "#0f1f3d", margin: 0 }}>Recall submission?</h3>
              <p style={{ fontSize: "13px", color: "#8a97b8", marginTop: "8px", marginBottom: 0 }}>You can edit and resubmit.</p>
            </div>
            <div style={{ padding: "16px 24px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setManagerReviewRecallModalOpen(false)}
                style={{
                  padding: "9px 20px",
                  borderRadius: "8px",
                  background: "white",
                  border: "1px solid #dde5f5",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#4a5a82",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setManagerReviewRecallModalOpen(false);
                  setManagerReviewSubmitting(true);
                  try {
                    const res = await fetch(`/api/appraisals/${appraisal.id}/recall`, { method: "POST" });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || "Failed");
                    window.location.reload();
                  } finally {
                    setManagerReviewSubmitting(false);
                  }
                }}
                disabled={managerReviewSubmitting}
                style={{
                  padding: "9px 20px",
                  borderRadius: "8px",
                  background: "#2563eb",
                  border: "none",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "white",
                  cursor: "pointer",
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
