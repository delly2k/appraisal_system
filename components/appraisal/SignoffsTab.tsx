"use client";

import { useState, useEffect } from "react";
import { PenLine, Check, ShieldCheck } from "lucide-react";
import { cn } from "@/utils/cn";
import type { AppraisalData } from "./AppraisalTabs";

export interface SignoffRecord {
  role: string;
  stage: string;
  signed_at?: string;
  comment?: string;
}

export interface SignoffsTabProps {
  appraisalId: string;
  appraisal: AppraisalData;
  signoffs: SignoffRecord[];
  isEmployee: boolean;
  isAppraisalManager: boolean;
  isHOD?: boolean;
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return iso;
  }
}

function SignedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
      <Check className="w-3 h-3" /> Signed
    </span>
  );
}

export function SignoffsTab({
  appraisalId,
  appraisal,
  signoffs,
  isEmployee,
  isAppraisalManager,
  isHOD = false,
}: SignoffsTabProps) {
  const [managerComment, setManagerComment] = useState("");
  const [employeeComment, setEmployeeComment] = useState("");
  const [disagreementNote, setDisagreementNote] = useState("");
  const [hodComment, setHodComment] = useState("");
  const [managerSignoffSubmitting, setManagerSignoffSubmitting] = useState(false);
  const [employeeSignoffSubmitting, setEmployeeSignoffSubmitting] = useState(false);
  const [hodSignoffSubmitting, setHodSignoffSubmitting] = useState(false);

  const status = (appraisal.status ?? "DRAFT") as string;
  const signedManager = signoffs.some((s) => s.role === "MANAGER");
  const signedEmployee = signoffs.some((s) => s.role === "EMPLOYEE");
  const hodSignoff = signoffs.find((s) => s.role === "HOD" && s.stage === "HOD_REVIEW");
  const hodSigned = !!hodSignoff;
  const managerSignoff = signoffs.find((s) => s.role === "MANAGER");
  const employeeSignoff = signoffs.find((s) => s.role === "EMPLOYEE");
  const canManagerSign = status === "PENDING_SIGNOFF" && isAppraisalManager && !signedManager;
  const canEmployeeSign = status === "PENDING_SIGNOFF" && isEmployee && !signedEmployee;
  const canHodSign = status === "HOD_REVIEW" && isHOD && !hodSigned;
  const showDisagreement = status === "PENDING_SIGNOFF" && isEmployee;
  const hodName = "HOD / Reviewing Manager";

  useEffect(() => {
    if (managerSignoff?.comment != null) setManagerComment(managerSignoff.comment);
  }, [managerSignoff?.comment]);

  useEffect(() => {
    if (employeeSignoff?.comment != null) setEmployeeComment(employeeSignoff.comment);
  }, [employeeSignoff?.comment]);

  useEffect(() => {
    if (hodSignoff?.comment != null) setHodComment(hodSignoff.comment);
  }, [hodSignoff?.comment]);

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
      else alert(data.error || "Failed to sign off");
    } finally {
      setHodSignoffSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Section D — Manager Comments & Sign-off */}
      <div
        className={cn(
          "border rounded-[14px] overflow-hidden",
          signedManager ? "border-emerald-200" : "border-[#dde5f5]"
        )}
      >
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#f8faff] border-b border-[#dde5f5]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[8px] bg-[#ede9fe] border border-[#ddd6fe] flex items-center justify-center">
              <PenLine className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <p className="font-['Sora'] text-[13px] font-bold">Section D — Manager Sign-off</p>
              <p className="text-[11px] text-[#8a97b8]">
                {signedManager && managerSignoff?.signed_at
                  ? `Signed ${formatDate(managerSignoff.signed_at)}`
                  : "Awaiting manager signature"}
              </p>
            </div>
          </div>
          {signedManager && <SignedBadge />}
        </div>
        <div className="p-5 flex flex-col gap-4">
          <textarea
            value={managerComment}
            onChange={(e) => setManagerComment(e.target.value)}
            disabled={!canManagerSign}
            placeholder="Rating manager's comments..."
            className="w-full border border-[#dde5f5] rounded-[8px] p-3 text-[13px] min-h-[100px] resize-none focus:outline-none focus:border-violet-400 disabled:bg-[#f8faff] disabled:text-[#8a97b8]"
          />
          {canManagerSign && (
            <button
              type="button"
              onClick={async () => {
                setManagerSignoffSubmitting(true);
                try {
                  const res = await fetch(`/api/appraisals/${appraisalId}/signoff`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ role: "MANAGER", stage: "PENDING_SIGNOFF", comment: managerComment || undefined }),
                  });
                  const data = await res.json();
                  if (res.ok) window.location.reload();
                  else alert(data.error || "Failed to sign off");
                } finally {
                  setManagerSignoffSubmitting(false);
                }
              }}
              disabled={managerSignoffSubmitting}
              className="self-end flex items-center gap-2 px-5 py-2 rounded-[8px] bg-[#0f1f3d] text-white text-[12px] font-semibold disabled:opacity-70"
            >
              <PenLine className="w-3.5 h-3.5" />
              Sign & Submit
            </button>
          )}
          {signedManager && managerSignoff?.signed_at && (
            <div className="flex items-center gap-3 text-[12px] text-[#4a5a82]">
              <span>Signed: <strong>Manager</strong></span>
              <span>·</span>
              <span>{formatDate(managerSignoff.signed_at)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Section E — Employee Comments & Sign-off */}
      <div
        className={cn(
          "border rounded-[14px] overflow-hidden",
          signedEmployee ? "border-emerald-200" : "border-[#dde5f5]"
        )}
      >
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#f8faff] border-b border-[#dde5f5]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[8px] bg-[#ede9fe] border border-[#ddd6fe] flex items-center justify-center">
              <PenLine className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <p className="font-['Sora'] text-[13px] font-bold">Section E — Employee Sign-off</p>
              <p className="text-[11px] text-[#8a97b8]">
                {signedEmployee && employeeSignoff?.signed_at
                  ? `Signed ${formatDate(employeeSignoff.signed_at)}`
                  : "Awaiting employee signature"}
              </p>
            </div>
          </div>
          {signedEmployee && <SignedBadge />}
        </div>
        <div className="p-5 flex flex-col gap-4">
          <textarea
            value={employeeComment}
            onChange={(e) => setEmployeeComment(e.target.value)}
            disabled={!canEmployeeSign}
            placeholder="Employee comments..."
            className="w-full border border-[#dde5f5] rounded-[8px] p-3 text-[13px] min-h-[100px] resize-none focus:outline-none focus:border-violet-400 disabled:bg-[#f8faff] disabled:text-[#8a97b8]"
          />
          {showDisagreement && (
            <div className="border border-amber-200 bg-amber-50 rounded-[8px] p-3">
              <p className="text-[11px] font-bold text-amber-700 mb-1.5">Reason for disagreement</p>
              <textarea
                value={disagreementNote}
                onChange={(e) => setDisagreementNote(e.target.value)}
                className="w-full bg-transparent text-[12px] text-amber-900 resize-none outline-none min-h-[60px]"
                placeholder="Please explain your disagreement with the rating..."
              />
            </div>
          )}
          {canEmployeeSign && (
            <button
              type="button"
              onClick={async () => {
                setEmployeeSignoffSubmitting(true);
                try {
                  const comment = [employeeComment, disagreementNote].filter(Boolean).join("\n\n") || undefined;
                  const res = await fetch(`/api/appraisals/${appraisalId}/signoff`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ role: "EMPLOYEE", stage: "PENDING_SIGNOFF", comment }),
                  });
                  const data = await res.json();
                  if (res.ok) window.location.reload();
                  else alert(data.error || "Failed to sign off");
                } finally {
                  setEmployeeSignoffSubmitting(false);
                }
              }}
              disabled={employeeSignoffSubmitting}
              className="self-end flex items-center gap-2 px-5 py-2 rounded-[8px] bg-[#0f1f3d] text-white text-[12px] font-semibold disabled:opacity-70"
            >
              <PenLine className="w-3.5 h-3.5" />
              Sign & Submit
            </button>
          )}
          {signedEmployee && employeeSignoff?.signed_at && (
            <div className="flex items-center gap-3 text-[12px] text-[#4a5a82]">
              <span>Signed: <strong>{appraisal.employeeName}</strong></span>
              <span>·</span>
              <span>{formatDate(employeeSignoff.signed_at)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Section F — HOD Sign-off */}
      <div
        className={cn(
          "border rounded-[14px] overflow-hidden",
          hodSigned ? "border-emerald-200" : "border-[#dde5f5]"
        )}
      >
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#f8faff] border-b border-[#dde5f5]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[8px] bg-[#fdf2f8] border border-[#fbcfe8] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-pink-600" />
            </div>
            <div>
              <p className="font-['Sora'] text-[13px] font-bold">Section F — HOD / Reviewing Manager</p>
              <p className="text-[11px] text-[#8a97b8]">
                {hodSigned ? `Signed ${formatDate(hodSignoff.signed_at)}` : "Awaiting HOD signature"}
              </p>
            </div>
          </div>
          {hodSigned && <SignedBadge />}
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
              <ShieldCheck className="w-3.5 h-3.5" />
              HOD Sign-off
            </button>
          )}
          {hodSigned && hodSignoff?.signed_at && (
            <div className="flex items-center gap-3 text-[12px] text-[#4a5a82]">
              <span>Signed: <strong>{hodName}</strong></span>
              <span>·</span>
              <span>{formatDate(hodSignoff.signed_at)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
