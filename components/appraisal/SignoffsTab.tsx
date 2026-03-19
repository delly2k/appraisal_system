"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Check, Clock, Info, FileText, Download, XCircle, AlertCircle, Shield } from "lucide-react";
import { cn } from "@/utils/cn";
import type { AppraisalData, AppraisalAgreement } from "./AppraisalTabs";

export interface SignoffsTabProps {
  appraisalId: string;
  appraisal: AppraisalData;
  signoffs: { role: string; stage: string; signed_at?: string; comment?: string }[];
  isEmployee: boolean;
  isAppraisalManager: boolean;
  isHOD?: boolean;
  isHR?: boolean;
  /** Same as Summary tab: used so signoff score matches Summary (management track = leadership component). */
  showLeadership?: boolean;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return String(iso);
  }
}

function SignerOrderPill({ order, role, email }: { order: number; role: string; email: string | null }) {
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[8px] bg-white border border-[#dde5f5] text-[11px] font-semibold text-[#0f1f3d]">
      <span className="w-5 h-5 rounded-full bg-[#f0f4ff] flex items-center justify-center">{order}</span>
      {role} {email ? `· ${email}` : ""}
    </span>
  );
}

interface SignerRowProps {
  order: number;
  role: string;
  name: string;
  email: string | null;
  signedAt?: string | null;
  isCurrent: boolean;
}

function SignerRow({ order, role, name, email, signedAt, isCurrent }: SignerRowProps) {
  const signed = !!signedAt;
  const waiting = !signed && !isCurrent;
  const borderColor = signed ? "border-l-[#059669]" : isCurrent ? "border-l-[#d97706]" : "border-l-transparent";
  const bgStyle = signed
    ? "bg-gradient-to-r from-[#ecfdf5]/30 to-transparent"
    : isCurrent
      ? "bg-gradient-to-r from-[#fffbeb]/50 to-transparent"
      : "";

  return (
    <div
      className={cn(
        "flex items-center gap-4 px-5 py-4 border-l-[3px]",
        borderColor,
        bgStyle,
        waiting && "opacity-60"
      )}
    >
      <div
        className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0",
          signed && "bg-[#ecfdf5] border border-[#6ee7b7]",
          isCurrent && "bg-[#fffbeb] border border-[#fcd34d]",
          waiting && "bg-[#f0f4ff] border border-[#dde5f5]"
        )}
      >
        {signed ? (
          <Check className="w-4 h-4 text-[#059669]" />
        ) : isCurrent ? (
          <Clock className="w-4 h-4 text-[#d97706] animate-pulse" />
        ) : (
          <span className="text-[12px] font-bold text-[#8a97b8]">{order}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-[#0f1f3d] truncate">{name}</p>
        <p className="text-[10px] text-[#8a97b8]">{role} · {email ?? "—"}</p>
      </div>
      {signed && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ecfdf5] border border-[#6ee7b7] text-[10px] font-semibold text-[#065f46]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
          Signed
        </span>
      )}
      {isCurrent && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#fffbeb] border border-[#fcd34d] text-[10px] font-semibold text-[#92400e]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#d97706] animate-pulse" />
          Awaiting signature
        </span>
      )}
      {waiting && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#f8faff] border border-[#dde5f5] text-[10px] font-semibold text-[#8a97b8]">
          Waiting
        </span>
      )}
      <p className="text-[10px] text-[#8a97b8] flex-shrink-0 text-right min-w-[110px]">
        {signed ? formatDate(signedAt) : isCurrent ? `Signer ${order} of 3` : ""}
      </p>
    </div>
  );
}

const DOCUMENT_ITEMS = [
  "Cover page & employee details",
  "Workplan objectives & actuals",
  "Core competencies ratings",
  "Technical competencies",
  "Productivity & Leadership",
  "Summary score & HR recommendation",
  "Signature block (3 parties)",
  "Evidence attachments index",
];

export function SignoffsTab({
  appraisalId,
  appraisal,
  signoffs,
  isEmployee,
  isAppraisalManager,
  isHOD = false,
  isHR = false,
  showLeadership = false,
}: SignoffsTabProps) {
  const status = (appraisal.status ?? "DRAFT") as string;
  const [statusData, setStatusData] = useState<{
    agreement: AppraisalAgreement | null;
    signers: { employee: { full_name: string; email: string | null }; manager: { full_name: string; email: string | null }; hrOfficer: { full_name: string; email: string | null } };
    scores: { workplan: number; competency: number; overall: number; ratingLabel: string };
  } | null>(null);
  const [managerComments, setManagerComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    setPortalTarget(document.getElementById("manager-review-actions"));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/appraisals/${appraisalId}/signoff/status?showLeadership=${showLeadership ? "true" : "false"}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setStatusData(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [appraisalId, showLeadership]);

  const agreement = (statusData?.agreement ?? appraisal.agreement) as AppraisalAgreement | undefined | null;
  const employee = statusData?.signers?.employee ?? { full_name: appraisal.employeeName, email: appraisal.employeeEmail ?? null };
  const manager = statusData?.signers?.manager ?? { full_name: appraisal.managerName ?? "—", email: appraisal.managerEmail ?? null };
  const hrOfficer = statusData?.signers?.hrOfficer ?? { full_name: appraisal.hrOfficerName ?? "—", email: appraisal.hrOfficerEmail ?? null };
  const scores = statusData?.scores ?? { workplan: 0, competency: 0, overall: 0, ratingLabel: "—" };

  const uiState = (() => {
    if (status === "MANAGER_REVIEW") return "READY_TO_SUBMIT";
    if (status === "PENDING_SIGNOFF") {
      if (agreement?.status === "DECLINED") return "DECLINED";
      if (agreement?.status === "CANCELLED" || agreement?.status === "EXPIRED") return "CANCELLED";
      return "IN_PROGRESS";
    }
    if (agreement?.status === "SIGNED") return "COMPLETE";
    return "READY_TO_SUBMIT";
  })();

  const canSubmit = (isAppraisalManager || isHR) && status === "MANAGER_REVIEW";
  const signaturesCollected = agreement
    ? [agreement.employee_signed_at, agreement.manager_signed_at, agreement.hr_signed_at].filter(Boolean).length
    : 0;
  const isCurrentSignersTurn =
    uiState === "IN_PROGRESS" &&
    agreement &&
    ((!agreement.employee_signed_at && isEmployee) ||
      (agreement.employee_signed_at && !agreement.manager_signed_at && isAppraisalManager) ||
      (agreement.manager_signed_at && !agreement.hr_signed_at && isHR));
  const canCancel = uiState === "IN_PROGRESS" && (isAppraisalManager || isHR);
  const expiryDate = agreement?.created_at
    ? new Date(new Date(agreement.created_at).getTime() + 30 * 24 * 60 * 60 * 1000)
    : null;
  const daysRemaining = expiryDate ? Math.max(0, Math.ceil((expiryDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000))) : 0;

  const handleSubmitForSignoff = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/appraisals/${appraisalId}/signoff/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managerComments: managerComments || undefined }),
      });
      const data = await res.json();
      if (res.ok) window.location.reload();
      else alert(data.error ?? "Failed to submit for sign-off");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async (type: "draft" | "signed") => {
    const res = await fetch(`/api/appraisals/${appraisalId}/signoff/download?type=${type}`);
    const data = await res.json();
    if (data?.url) window.open(data.url, "_blank");
    else alert(type === "draft" ? "Draft PDF not available" : "Signed PDF not available");
  };

  const handleResendEmail = async () => {
    setResending(true);
    try {
      const res = await fetch(`/api/appraisals/${appraisalId}/signoff/resend`, { method: "POST" });
      const data = await res.json();
      if (res.ok) alert("Reminder sent. Check your email.");
      else alert(data.error ?? "Failed to send reminder");
    } finally {
      setResending(false);
    }
  };

  const handleCancelSignoff = async () => {
    setCancelling(true);
    try {
      const res = await fetch(`/api/appraisals/${appraisalId}/signoff/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason || "Cancelled by reviewer" }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowCancelModal(false);
        window.location.reload();
      } else alert(data.error ?? "Failed to cancel");
    } finally {
      setCancelling(false);
    }
  };

  const hodSignoff = signoffs.find((s) => s.role === "HOD" && s.stage === "HOD_REVIEW");
  const canHodSign = status === "HOD_REVIEW" && isHOD && !hodSignoff;
  const [hodComment, setHodComment] = useState("");
  const [hodSignoffSubmitting, setHodSignoffSubmitting] = useState(false);
  const handleHodSignoff = async () => {
    setHodSignoffSubmitting(true);
    try {
      const res = await fetch(`/api/appraisals/${appraisalId}/signoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "HOD", stage: "HOD_REVIEW", comment: hodComment || undefined }),
      });
      const data = await res.json();
      if (res.ok) window.location.reload();
      else alert(data.error ?? "Failed to sign off");
    } finally {
      setHodSignoffSubmitting(false);
    }
  };

  const generatePdfButton = uiState === "READY_TO_SUBMIT" && (isAppraisalManager || isHR) ? (
    <button
      type="button"
      onClick={handleSubmitForSignoff}
      disabled={submitting || !canSubmit}
      className="inline-flex items-center gap-2 px-6 py-3 rounded-[10px] bg-[#0f1f3d] text-white text-[12px] font-semibold hover:bg-[#1a3260] disabled:opacity-50 transition-colors"
    >
      {submitting ? (
        <>
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Generating PDF & sending…
        </>
      ) : (
        <>
          <Shield className="w-4 h-4" />
          Generate PDF & send via Adobe Sign →
        </>
      )}
    </button>
  ) : null;

  const renderGenerateButtonInBar = portalTarget && generatePdfButton && typeof document !== "undefined";

  return (
    <div className="flex flex-col gap-6">
      {renderGenerateButtonInBar && createPortal(generatePdfButton, portalTarget)}
      {/* State A — Ready to submit */}
      {uiState === "READY_TO_SUBMIT" && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Overall score", value: scores.overall.toFixed(1), color: "#0d9488" },
              { label: "Workplan pts", value: scores.workplan.toFixed(1), color: "#0f1f3d" },
              { label: "Competencies", value: scores.competency.toFixed(1), color: "#0f1f3d" },
              { label: "Rating", value: scores.ratingLabel, color: "#3b82f6" },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-[#f8faff] border border-[#dde5f5] rounded-[10px] p-4 text-center"
                style={{ boxShadow: "0 2px 12px rgba(15,31,61,0.07)" }}
              >
                <p className="font-['Sora'] text-[22px] font-bold" style={{ color: s.color }}>
                  {s.value}
                </p>
                <p className="text-[10px] uppercase tracking-[.06em] text-[#8a97b8] mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-white border border-[#dde5f5] rounded-[14px] overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(15,31,61,0.07)" }}>
            <div className="flex items-center justify-between gap-3 px-5 py-4 bg-[#f8faff] border-b border-[#dde5f5]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[9px] bg-[#eef2fb] border border-[#dde5f5] flex items-center justify-center">
                  <Shield className="w-4 h-4 text-[#1a56cc]" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[#0f1f3d]">Sign-off via Adobe Sign</p>
                  <p className="text-[10px] text-[#8a97b8] mt-0.5">
                    Signatures collected in sequence — employee first, then manager, then HR
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#e8f0fe] border border-[#b3d1fa] text-[11px] font-semibold text-[#1a56cc]">
                Adobe Sign
              </span>
            </div>
            <div className="px-5 py-4">
              <div className="flex items-center gap-3 mb-5">
                <SignerOrderPill order={1} role="Employee" email={employee.email} />
                <div className="flex-1 h-px bg-[#dde5f5]" />
                <SignerOrderPill order={2} role="Manager" email={manager.email} />
                <div className="flex-1 h-px bg-[#dde5f5]" />
                <SignerOrderPill order={3} role="HR Officer" email={hrOfficer.email} />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#8a97b8] mb-3">Document will include</p>
              <div className="grid grid-cols-2 gap-y-1.5 gap-x-4">
                {DOCUMENT_ITEMS.map((item) => (
                  <div key={item} className="flex items-center gap-2 text-[11px] text-[#4a5a82]">
                    <Check className="w-[11px] h-[11px] text-[#059669] flex-shrink-0" strokeWidth={2.5} />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#dde5f5] rounded-[14px] overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(15,31,61,0.07)" }}>
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#f8faff] border-b border-[#dde5f5]">
              <p className="text-[13px] font-semibold text-[#0f1f3d]">Manager comments</p>
              <span className="text-[10px] text-[#8a97b8]">Optional — included in the signed document</span>
            </div>
            <div className="p-5">
              <textarea
                value={managerComments}
                onChange={(e) => setManagerComments(e.target.value)}
                rows={4}
                placeholder="Add overall comments to be included in the signed appraisal..."
                className="w-full border border-[#dde5f5] rounded-[8px] px-3 py-2.5 text-[12px] resize-none outline-none leading-relaxed focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10"
              />
            </div>
          </div>

          {!renderGenerateButtonInBar && (
            <div className="flex justify-end">
              {generatePdfButton}
            </div>
          )}
        </div>
      )}

      {/* State B/C — In progress */}
      {uiState === "IN_PROGRESS" && agreement && (
        <div className="space-y-3">
          <div className="bg-white border border-[#dde5f5] rounded-[14px] overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(15,31,61,0.07)" }}>
            <div className="flex items-center justify-between gap-3 px-5 py-4 bg-[#f8faff] border-b border-[#dde5f5]">
              <div>
                <p className="text-[13px] font-semibold text-[#0f1f3d]">
                  Sign-off in progress · {signaturesCollected} of 3 signed
                </p>
                <p className="text-[10px] text-[#8a97b8] mt-0.5">
                  Adobe Sign · Sent {formatDate(agreement.created_at)} · Expires {formatDate(expiryDate?.toISOString())} · Weekly reminders active
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {[agreement.employee_signed_at, agreement.manager_signed_at, agreement.hr_signed_at].map((t, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-2.5 h-2.5 rounded-full transition-colors",
                      t ? "bg-[#059669]" : i === signaturesCollected ? "bg-[#d97706] animate-pulse" : "bg-[#dde5f5]"
                    )}
                  />
                ))}
              </div>
            </div>
            <SignerRow order={1} role="Employee" name={employee.full_name} email={employee.email} signedAt={agreement.employee_signed_at} isCurrent={!agreement.employee_signed_at} />
            <div className="h-px bg-[#dde5f5]" />
            <SignerRow order={2} role="Manager" name={manager.full_name} email={manager.email} signedAt={agreement.manager_signed_at} isCurrent={!!agreement.employee_signed_at && !agreement.manager_signed_at} />
            <div className="h-px bg-[#dde5f5]" />
            <SignerRow order={3} role="HR Officer" name={hrOfficer.full_name} email={hrOfficer.email} signedAt={agreement.hr_signed_at} isCurrent={!!agreement.manager_signed_at && !agreement.hr_signed_at} />
          </div>

          {isCurrentSignersTurn && (
            <div className="flex items-start gap-3 px-4 py-3.5 bg-[#fffbeb] border border-[#fcd34d] rounded-[10px]">
              <Info className="w-4 h-4 text-[#d97706] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-[12px] font-semibold text-[#92400e]">It&apos;s your turn to sign</p>
                <p className="text-[11px] text-[#d97706] mt-0.5">
                  Check your email for a message from Adobe Sign. The link expires in {daysRemaining} days.
                </p>
              </div>
              <button
                type="button"
                onClick={handleResendEmail}
                disabled={resending}
                className="flex-shrink-0 text-[11px] font-semibold text-[#92400e] border border-[#fcd34d] bg-white px-3 py-1.5 rounded-[7px] hover:bg-[#fffbeb] transition-colors disabled:opacity-50"
              >
                {resending ? "Sending…" : "Resend email"}
              </button>
            </div>
          )}

          <div className="flex items-center gap-3 px-4 py-3.5 bg-white border border-[#dde5f5] rounded-[10px]">
            <div className="w-9 h-9 rounded-[9px] bg-[#fff1f2] border border-[#fecaca] flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-[#0f1f3d] truncate">
                FY2026_Appraisal_{employee.full_name.replace(/\s/g, "_")}.pdf
              </p>
              <p className="text-[10px] text-[#8a97b8] mt-0.5">
                Generated {formatDate(agreement.created_at)} · {signaturesCollected} of 3 signatures collected
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleDownload("draft")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#dde5f5] text-[11px] font-semibold text-[#4a5a82] hover:border-[#0f1f3d] hover:text-[#0f1f3d] transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download draft
            </button>
          </div>

          {canCancel && (
            <div className="flex justify-end">
              <button type="button" onClick={() => setShowCancelModal(true)} className="text-[11px] text-[#dc2626] hover:underline">
                Cancel sign-off
              </button>
            </div>
          )}
        </div>
      )}

      {/* State D — Complete */}
      {uiState === "COMPLETE" && agreement && (
        <div className="space-y-3">
          <div className="flex items-center gap-4 px-5 py-4 bg-[#ecfdf5] border border-[#6ee7b7] rounded-[14px]">
            <div className="w-11 h-11 rounded-full bg-white border-[1.5px] border-[#6ee7b7] flex items-center justify-center flex-shrink-0">
              <Check className="w-5 h-5 text-[#059669]" strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-['Sora'] text-[14px] font-bold text-[#065f46]">Sign-off complete</p>
              <p className="text-[11px] text-[#0d9488] mt-0.5">
                All three signatures collected · {formatDate(agreement.hr_signed_at)} · Appraisal advancing to HOD Review
              </p>
            </div>
          </div>

          <div className="bg-white border border-[#dde5f5] rounded-[14px] overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(15,31,61,0.07)" }}>
            <div className="px-5 py-3.5 bg-[#f8faff] border-b border-[#dde5f5] flex items-center justify-between">
              <p className="text-[13px] font-semibold text-[#0f1f3d]">Signatures collected</p>
              <div className="flex gap-1.5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="w-2.5 h-2.5 rounded-full bg-[#059669]" />
                ))}
              </div>
            </div>
            <SignerRow order={1} role="Employee" name={employee.full_name} email={employee.email} signedAt={agreement.employee_signed_at} isCurrent={false} />
            <div className="h-px bg-[#dde5f5]" />
            <SignerRow order={2} role="Manager" name={manager.full_name} email={manager.email} signedAt={agreement.manager_signed_at} isCurrent={false} />
            <div className="h-px bg-[#dde5f5]" />
            <SignerRow order={3} role="HR Officer" name={hrOfficer.full_name} email={hrOfficer.email} signedAt={agreement.hr_signed_at} isCurrent={false} />
          </div>

          <div className="bg-white border border-[#dde5f5] rounded-[14px] overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(15,31,61,0.07)" }}>
            <div className="flex items-center justify-between gap-4 px-5 py-4 bg-[#f0fdfa] border-b border-[#99f6e4]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[10px] bg-[#fff1f2] border border-[#fecaca] flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[#0f1f3d]">Signed appraisal document</p>
                  <p className="text-[10px] text-[#0d9488] mt-0.5">
                    All signatures collected · Legally binding · {formatDate(agreement.hr_signed_at)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDownload("signed")}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[8px] bg-[#0f1f3d] text-white text-[12px] font-semibold hover:bg-[#1a3260] transition-colors flex-shrink-0"
              >
                <Download className="w-4 h-4" />
                Download signed PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* State E — Declined */}
      {uiState === "DECLINED" && agreement && (
        <div className="space-y-3">
          <div className="flex items-start gap-4 px-5 py-4 bg-[#fff1f2] border border-[#fecaca] rounded-[14px]">
            <div className="w-10 h-10 rounded-full bg-white border-[1.5px] border-[#fecaca] flex items-center justify-center flex-shrink-0">
              <XCircle className="w-5 h-5 text-[#dc2626]" />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-bold text-[#dc2626]">Sign-off declined</p>
              <p className="text-[12px] text-[#dc2626] mt-1.5">
                <strong>{agreement.declined_by_email}</strong> declined to sign on {formatDate(agreement.declined_at)}
              </p>
              {agreement.decline_reason && (
                <div className="mt-3 px-3 py-2.5 bg-white border border-[#fecaca] rounded-[8px]">
                  <p className="text-[9px] font-bold text-[#dc2626] uppercase tracking-[.07em] mb-1.5">Reason given</p>
                  <p className="text-[12px] text-[#0f1f3d] leading-relaxed">&quot;{agreement.decline_reason}&quot;</p>
                </div>
              )}
            </div>
          </div>
          <div className="px-5 py-4 bg-[#f8faff] border border-[#dde5f5] rounded-[12px] text-center">
            <p className="text-[12px] text-[#4a5a82]">
              The appraisal has been returned to <strong className="text-[#0f1f3d]">Manager Review</strong>.
            </p>
            <p className="text-[11px] text-[#8a97b8] mt-1">
              Review the feedback above, make any necessary changes, and resubmit for sign-off.
            </p>
          </div>
        </div>
      )}

      {/* State F — Cancelled or Expired */}
      {uiState === "CANCELLED" && (
        <div className="px-5 py-10 bg-[#f8faff] border border-[#dde5f5] rounded-[14px] text-center">
          <div className="w-12 h-12 rounded-[14px] bg-white border border-[#dde5f5] flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-[#8a97b8]" />
          </div>
          <p className="text-[13px] font-semibold text-[#0f1f3d] mb-1.5">
            Sign-off {agreement?.status === "EXPIRED" ? "expired" : "cancelled"}
          </p>
          <p className="text-[12px] text-[#8a97b8] leading-relaxed">
            {agreement?.status === "EXPIRED"
              ? "The 30-day signing window expired. The appraisal has been returned to Manager Review."
              : `Cancelled on ${formatDate(agreement?.updated_at)}. The appraisal has been returned to Manager Review.`}
          </p>
        </div>
      )}

      {/* Section F — HOD Sign-off (unchanged) */}
      <div className={cn("border rounded-[14px] overflow-hidden", hodSignoff ? "border-emerald-200" : "border-[#dde5f5]")} style={{ boxShadow: "0 2px 12px rgba(15,31,61,0.07)" }}>
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#f8faff] border-b border-[#dde5f5]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[8px] bg-[#fdf2f8] border border-[#fbcfe8] flex items-center justify-center">
              <Check className="w-4 h-4 text-pink-600" />
            </div>
            <div>
              <p className="font-['Sora'] text-[13px] font-bold">Section F — HOD / Reviewing Manager</p>
              <p className="text-[11px] text-[#8a97b8]">{hodSignoff ? `Signed ${formatDate(hodSignoff.signed_at)}` : "Awaiting HOD signature"}</p>
            </div>
          </div>
          {hodSignoff && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
              <Check className="w-3 h-3" /> Signed
            </span>
          )}
        </div>
        <div className="p-5 flex flex-col gap-4">
          <textarea
            value={hodComment}
            onChange={(e) => setHodComment(e.target.value)}
            disabled={!canHodSign}
            placeholder="Reviewing manager's overall comments..."
            className="w-full border border-[#dde5f5] rounded-[8px] p-3 text-[13px] min-h-[100px] resize-none focus:outline-none focus:border-pink-400 disabled:bg-[#f8faff] disabled:text-[#8a97b8]"
          />
          {canHodSign && (
            <button
              type="button"
              onClick={handleHodSignoff}
              disabled={hodSignoffSubmitting}
              className="self-end flex items-center gap-2 px-5 py-2 rounded-[8px] bg-[#0f1f3d] text-white text-[12px] font-semibold disabled:opacity-70"
            >
              <Check className="w-3.5 h-3.5" />
              HOD Sign-off
            </button>
          )}
        </div>
      </div>

      {/* Cancel modal */}
      {showCancelModal && (
        <div className="mt-4 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.38)", borderRadius: 14, padding: 24, minHeight: 280 }}>
          <div className="bg-white rounded-[14px] border border-[#dde5f5] w-full max-w-[440px] overflow-hidden">
            <div className="px-5 py-4 bg-[#f8faff] border-b border-[#dde5f5]">
              <p className="text-[13px] font-semibold text-[#0f1f3d]">Cancel sign-off?</p>
              <p className="text-[11px] text-[#8a97b8] mt-0.5">This will recall the Adobe Sign agreement</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-[12px] text-[#4a5a82] mb-3 leading-relaxed">
                The agreement will be recalled and the appraisal returned to Manager Review. All signers will be notified by email.
              </p>
              <label className="text-[10px] font-bold uppercase tracking-[.07em] text-[#8a97b8] block mb-1.5">Reason (optional)</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                placeholder="e.g. Workplan targets need revision before sign-off..."
                className="w-full border border-[#dde5f5] rounded-[8px] px-3 py-2.5 text-[12px] resize-none outline-none focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10"
              />
            </div>
            <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-[#dde5f5]">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 rounded-[8px] border border-[#dde5f5] text-[12px] font-semibold text-[#4a5a82] hover:border-[#0f1f3d] transition-colors"
              >
                Keep sign-off
              </button>
              <button
                type="button"
                onClick={handleCancelSignoff}
                disabled={cancelling}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-[8px] bg-[#fff1f2] text-[#dc2626] border border-[#fecaca] text-[12px] font-semibold hover:bg-[#ffe4e6] disabled:opacity-50 transition-colors"
              >
                {cancelling ? "Cancelling…" : "Cancel sign-off"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
