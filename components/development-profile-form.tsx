"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface DevProfileSkill {
  id: string;
  skill: string;
  action: string;
  status: "planned" | "inprog" | "done";
}

export interface DevProfile {
  id?: string;
  employee_id?: string;
  eip_issued?: boolean | null;
  eip_next_fy?: boolean | null;
  eip_set_by?: string | null;
  eip_set_at?: string | null;
  employee_ld_comments?: string | null;
  manager_ld_notes?: string | null;
  manager_notes_by?: string | null;
  manager_notes_at?: string | null;
  skills?: DevProfileSkill[];
  career_role?: string | null;
  career_timeframe?: string | null;
  career_expertise?: string | null;
  career_remarks?: string | null;
  secondment_interest?: boolean | null;
  willing_to_relocate?: boolean | null;
  last_updated_by?: string | null;
  last_updated_at?: string | null;
  created_at?: string | null;
}

export interface DevProfileCycle {
  id: string;
  fiscal_year: string;
  status: string;
  updated_at: string;
}

export function formatDate(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

function YesNoPills({
  value,
  onChange,
  disabled,
}: {
  value: boolean | null | undefined;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-2">
      {[true, false].map((opt) => (
        <button
          key={String(opt)}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && onChange(opt)}
          className={cn(
            "px-4 py-1.5 rounded-full border-[1.5px] text-[12px] font-semibold transition-all",
            value === opt ? "bg-[#0f1f3d] text-white border-[#0f1f3d]" : "bg-white text-[#8a97b8] border-[#dde5f5]",
            disabled && "opacity-60 cursor-not-allowed"
          )}
        >
          {opt ? "Yes" : "No"}
        </button>
      ))}
    </div>
  );
}

function FieldGroup({
  label,
  questionRef,
  children,
}: {
  label: string;
  questionRef?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-bold uppercase tracking-[.07em] text-[#8a97b8]">
        {label}
        {questionRef && <span className="ml-1 text-[#8a97b8]/80">({questionRef})</span>}
      </p>
      {children}
    </div>
  );
}

const inp =
  "border-[1.5px] border-[#dde5f5] rounded-[8px] px-3 py-2 text-[13px] text-[#0f1f3d] outline-none transition-colors focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10 disabled:bg-[#f8faff] disabled:text-[#4a5a82] disabled:cursor-not-allowed w-full font-[DM_Sans]";

const STATUS_ORDER: ("planned" | "inprog" | "done")[] = ["planned", "inprog", "done"];
const STATUS_LABELS: Record<string, string> = { planned: "Planned", inprog: "In Progress", done: "Completed" };

export function DevelopmentProfileForm({
  userId,
  initialData,
}: {
  userId: string;
  initialData: {
    profile: DevProfile | null;
    cycles: DevProfileCycle[];
    employee: { full_name: string; division: string };
    isManager: boolean;
    activeAppraisal: { id: string; fiscal_year: string } | null;
  };
}) {
  const { profile, cycles, employee, isManager, activeAppraisal } = initialData;
  const isOwner = true;

  const [eipIssued, setEipIssued] = useState<boolean>(profile?.eip_issued ?? false);
  const [eipNextFy, setEipNextFy] = useState<boolean>(profile?.eip_next_fy ?? false);
  const [employeeLdComments, setEmployeeLdComments] = useState(profile?.employee_ld_comments ?? "");
  const [managerLdNotes, setManagerLdNotes] = useState(profile?.manager_ld_notes ?? "");
  const [skills, setSkills] = useState<DevProfileSkill[]>(
    Array.isArray(profile?.skills) ? profile.skills : []
  );
  const [careerRole, setCareerRole] = useState(profile?.career_role ?? "");
  const [careerTimeframe, setCareerTimeframe] = useState(profile?.career_timeframe ?? "");
  const [careerExpertise, setCareerExpertise] = useState(profile?.career_expertise ?? "");
  const [careerRemarks, setCareerRemarks] = useState(profile?.career_remarks ?? "");
  const [secondment, setSecondment] = useState<boolean | null>(profile?.secondment_interest ?? null);
  const [relocate, setRelocate] = useState<boolean | null>(profile?.willing_to_relocate ?? null);
  const [lastSaved, setLastSaved] = useState<string | null>(profile?.last_updated_at ?? null);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [savingManager, setSavingManager] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEipIssued(profile?.eip_issued ?? false);
    setEipNextFy(profile?.eip_next_fy ?? false);
    setEmployeeLdComments(profile?.employee_ld_comments ?? "");
    setManagerLdNotes(profile?.manager_ld_notes ?? "");
    setSkills(Array.isArray(profile?.skills) ? profile.skills : []);
    setCareerRole(profile?.career_role ?? "");
    setCareerTimeframe(profile?.career_timeframe ?? "");
    setCareerExpertise(profile?.career_expertise ?? "");
    setCareerRemarks(profile?.career_remarks ?? "");
    setSecondment(profile?.secondment_interest ?? null);
    setRelocate(profile?.willing_to_relocate ?? null);
    setLastSaved(profile?.last_updated_at ?? null);
  }, [profile]);

  const addSkill = useCallback(() => {
    setSkills((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        skill: "",
        action: "",
        status: "planned" as const,
      },
    ]);
  }, []);

  const updateSkill = useCallback((id: string, field: keyof DevProfileSkill, value: string | DevProfileSkill["status"]) => {
    setSkills((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  }, []);

  const cycleStatus = useCallback((id: string) => {
    setSkills((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const idx = STATUS_ORDER.indexOf(s.status);
        const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
        return { ...s, status: next };
      })
    );
  }, []);

  const removeSkill = useCallback((id: string) => {
    setSkills((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleEmployeeSave = useCallback(async () => {
    setError(null);
    setSavingEmployee(true);
    try {
      const res = await fetch(`/api/development-profile/${userId}/employee`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_ld_comments: employeeLdComments,
          skills,
          career_role: careerRole || null,
          career_timeframe: careerTimeframe || null,
          career_expertise: careerExpertise || null,
          career_remarks: careerRemarks || null,
          secondment_interest: secondment,
          willing_to_relocate: relocate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Save failed");
      setLastSaved(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingEmployee(false);
    }
  }, [
    userId,
    employeeLdComments,
    skills,
    careerRole,
    careerTimeframe,
    careerExpertise,
    careerRemarks,
    secondment,
    relocate,
  ]);

  const handleManagerSave = useCallback(async () => {
    setError(null);
    setSavingManager(true);
    try {
      const res = await fetch(`/api/development-profile/${userId}/manager`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eip_issued: eipIssued,
          eip_next_fy: eipNextFy,
          manager_ld_notes: managerLdNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Save failed");
      setLastSaved(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingManager(false);
    }
  }, [userId, eipIssued, eipNextFy, managerLdNotes]);

  const currentFiscalYear = typeof window !== "undefined" ? new Date().getFullYear() : new Date().getFullYear();
  const currentCycleId = cycles[0]?.id ?? null;

  return (
    <div className="flex flex-col gap-0">
      {activeAppraisal && isOwner && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-[8px] bg-[#eff6ff] border border-[#bfdbfe] mb-5">
          <span className="w-2 h-2 rounded-full bg-[#3b82f6] animate-pulse flex-shrink-0" />
          <p className="text-[12px] text-[#1d4ed8] font-medium flex-1">
            <strong>FY {activeAppraisal.fiscal_year} appraisal is active</strong> — Review and update your development goals before submitting your self-assessment.
          </p>
          <Link
            href={`/appraisals/${activeAppraisal.id}?tab=development`}
            className="text-[11px] font-bold text-[#1d4ed8] px-3 py-1.5 rounded-full border-[1.5px] border-[#93c5fd] bg-white hover:bg-[#1d4ed8] hover:text-white hover:border-[#1d4ed8] transition-all"
          >
            Open Appraisal →
          </Link>
        </div>
      )}

      <div className="flex gap-2.5 mb-5 overflow-x-auto pb-1">
        {cycles.map((cycle) => (
          <div
            key={cycle.id}
            className={cn(
              "flex flex-col gap-0.5 px-3.5 py-2.5 rounded-[8px] border-[1.5px] bg-white cursor-pointer transition-all flex-shrink-0 min-w-[130px]",
              cycle.id === currentCycleId ? "border-[#0d9488] bg-[#f0fdfa]" : "border-[#dde5f5] hover:border-[#3b82f6]"
            )}
          >
            <span className={cn("font-['Sora'] text-[12px] font-bold", cycle.id === currentCycleId ? "text-[#0d9488]" : "text-[#0f1f3d]")}>
              FY {cycle.fiscal_year}
            </span>
            <span className="text-[10px] text-[#8a97b8]">Updated {formatDate(cycle.updated_at)}</span>
            <span
              className={cn(
                "inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold",
                cycle.status === "COMPLETE" ? "bg-[#ecfdf5] text-[#065f46]" : "bg-[#dbeafe] text-[#1d4ed8]"
              )}
            >
              {cycle.status === "COMPLETE" ? "✓ Completed" : "● Active"}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-5 px-4 py-3 rounded-[8px] bg-[#fef2f2] border border-[#fecaca] text-[13px] text-[#b91c1c]">
          {error}
        </div>
      )}

      <div className="rounded-[14px] border border-[#dde5f5] shadow-[0_2px_12px_rgba(15,31,61,.07),0_0_1px_rgba(15,31,61,.1)] bg-white overflow-hidden mb-5">
        <div className="px-5 py-4 bg-[#f8faff] border-b border-[#dde5f5] flex items-center gap-3">
          <div className="w-10 h-10 rounded-[8px] bg-[#f0fdfa] border border-[#99f6e4] flex items-center justify-center text-[#0d9488]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="font-['Sora'] text-[16px] font-bold text-[#0f1f3d]">Employee Improvement Plan</h2>
            <p className="text-[11px] text-[#8a97b8]">Section C — Learning & Development · FY {currentFiscalYear}/{String(currentFiscalYear + 1).slice(-2)}</p>
          </div>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 gap-7 mb-5">
            <div className="flex flex-col gap-1.5">
              <p className="text-[10px] font-bold uppercase tracking-[.07em] text-[#8a97b8]">Has an EIP been issued for FY 25/26?</p>
              <p className="text-[11px] text-[#8a97b8] leading-relaxed">If applicable, please attach documentation.</p>
              <div className="flex gap-2 mt-1 items-center flex-wrap">
                {["Yes", "No"].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    disabled={!isManager}
                    onClick={() => isManager && setEipIssued(opt === "Yes")}
                    className={cn(
                      "px-4 py-1.5 rounded-full border-[1.5px] text-[12px] font-semibold transition-all",
                      (opt === "Yes" ? eipIssued : !eipIssued) ? "bg-[#0d9488] text-white border-[#0d9488]" : "bg-white text-[#8a97b8] border-[#dde5f5]",
                      !isManager && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    {opt}
                  </button>
                ))}
                {!isManager && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-[#8a97b8] ml-1">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Set by manager
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-[10px] font-bold uppercase tracking-[.07em] text-[#8a97b8]">EIP planned for next FY?</p>
              <div className="flex gap-2 mt-1 items-center flex-wrap">
                {["Yes", "No"].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    disabled={!isManager}
                    onClick={() => isManager && setEipNextFy(opt === "Yes")}
                    className={cn(
                      "px-4 py-1.5 rounded-full border-[1.5px] text-[12px] font-semibold transition-all",
                      (opt === "Yes" ? eipNextFy : !eipNextFy) ? "bg-[#0d9488] text-white border-[#0d9488]" : "bg-white text-[#8a97b8] border-[#dde5f5]",
                      !isManager && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    {opt}
                  </button>
                ))}
                {!isManager && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-[#8a97b8] ml-1">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Set by manager
                  </span>
                )}
              </div>
            </div>
          </div>
          <hr className="border-t border-[#dde5f5] my-5" />
          <div className="grid grid-cols-2 gap-5">
            <div className="flex flex-col gap-1.5">
              <p className="text-[10px] font-bold uppercase tracking-[.07em] text-[#8a97b8]">Employee — L&D Comments</p>
              <textarea
                value={employeeLdComments}
                onChange={(e) => setEmployeeLdComments(e.target.value)}
                disabled={!isOwner}
                rows={5}
                placeholder="Describe your development priorities and goals..."
                className={cn(
                  "w-full border-[1.5px] border-[#dde5f5] rounded-[8px] p-3 font-[DM_Sans] text-[13px] text-[#0f1f3d] resize-none outline-none transition-colors",
                  isOwner ? "focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10" : "bg-[#f8faff] text-[#4a5a82] cursor-not-allowed"
                )}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-[10px] font-bold uppercase tracking-[.07em] text-[#8a97b8] flex items-center gap-1.5">
                Manager — L&D Notes
                <span className="px-1.5 py-0.5 rounded bg-[#ede9fe] text-[#7c3aed] text-[8px] font-bold">MANAGER ONLY</span>
              </p>
              <textarea
                value={managerLdNotes}
                onChange={(e) => setManagerLdNotes(e.target.value)}
                disabled={!isManager}
                rows={5}
                placeholder={isManager ? "Add your L&D notes and recommendations..." : "Set by manager"}
                className={cn(
                  "w-full border-[1.5px] rounded-[8px] p-3 font-[DM_Sans] text-[13px] text-[#0f1f3d] resize-none outline-none transition-colors",
                  isManager ? "border-[#ddd6fe] focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/10" : "border-[#dde5f5] bg-[#f8faff] text-[#4a5a82] cursor-not-allowed"
                )}
              />
              {managerLdNotes && profile?.manager_notes_at && (
                <p className="text-[10px] text-[#8a97b8]">Updated {formatDate(profile.manager_notes_at)}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[14px] border border-[#dde5f5] shadow-[0_2px_12px_rgba(15,31,61,.07),0_0_1px_rgba(15,31,61,.1)] bg-white overflow-hidden mb-5">
        <div className="px-5 py-4 bg-[#f8faff] border-b border-[#dde5f5] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[8px] bg-[#eff6ff] border border-[#bfdbfe] flex items-center justify-center text-[#3b82f6]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <div>
              <h2 className="font-['Sora'] text-[16px] font-bold text-[#0f1f3d]">Skills & Competencies to Enhance</h2>
              <p className="text-[11px] text-[#8a97b8]">Track development actions and status</p>
            </div>
          </div>
          {isOwner && (
            <button
              type="button"
              onClick={addSkill}
              className="flex items-center gap-2 px-4 py-2 rounded-[8px] bg-[#0d9488] text-white font-['Sora'] text-[12px] font-semibold hover:bg-[#0f766e] transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Skill
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          {skills.length === 0 ? (
            <div className="p-10 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-[8px] bg-[#eef2fb] border border-[#dde5f5] flex items-center justify-center text-[#8a97b8] mb-3">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="font-['Sora'] text-[14px] font-semibold text-[#0f1f3d]">No skills added yet</p>
              <p className="text-[12px] text-[#8a97b8] mt-1">Click &apos;Add Skill&apos; to start tracking development goals.</p>
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#eef2fb] border-b border-[#dde5f5]">
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-[#8a97b8]">#</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-[#8a97b8]" style={{ width: "30%" }}>Skill / Competency</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-[#8a97b8]">Development Action / Remarks</th>
                  <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-[#8a97b8]" style={{ width: "11%" }}>Status</th>
                  <th className="px-3 py-2.5 w-10" />
                </tr>
              </thead>
              <tbody>
                {skills.map((skill, index) => (
                  <tr key={skill.id} className="border-b border-[#dde5f5] hover:bg-[#f8faff] transition-colors">
                    <td className="px-3 py-2.5">
                      <span className="w-[22px] h-[22px] rounded-[6px] bg-[#eef2fb] border border-[#dde5f5] inline-flex items-center justify-center text-[10px] font-bold text-[#8a97b8]">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-3 py-2.5" style={{ width: "30%" }}>
                      <input
                        type="text"
                        value={skill.skill}
                        disabled={!isOwner}
                        onChange={(e) => updateSkill(skill.id, "skill", e.target.value)}
                        placeholder="e.g. Project Management"
                        className="w-full border-none outline-none bg-transparent text-[13px] text-[#0f1f3d] disabled:text-[#4a5a82] placeholder:text-[#8a97b8]"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="text"
                        value={skill.action}
                        disabled={!isOwner}
                        onChange={(e) => updateSkill(skill.id, "action", e.target.value)}
                        placeholder="Training, certification, or action..."
                        className="w-full border-none outline-none bg-transparent text-[13px] text-[#0f1f3d] disabled:text-[#4a5a82] placeholder:text-[#8a97b8]"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-center" style={{ width: "11%" }}>
                      <button
                        type="button"
                        disabled={!isOwner}
                        onClick={() => cycleStatus(skill.id)}
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border-[1.5px] text-[10px] font-semibold transition-all",
                          skill.status === "planned" && "bg-[#eff6ff] border-[#93c5fd] text-[#1d4ed8]",
                          skill.status === "inprog" && "bg-[#fffbeb] border-[#fcd34d] text-[#92400e]",
                          skill.status === "done" && "bg-[#ecfdf5] border-[#6ee7b7] text-[#065f46]",
                          !isOwner && "cursor-default"
                        )}
                      >
                        {STATUS_LABELS[skill.status] ?? skill.status}
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => removeSkill(skill.id)}
                          className="text-[#8a97b8] hover:text-[#dc2626] hover:bg-[#fff1f2] p-1 rounded-[6px] transition-all"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {isOwner && skills.length > 0 && (
            <div className="px-5 py-3 border-t border-[#dde5f5]">
              <button type="button" onClick={addSkill} className="text-[12px] font-semibold text-[#3b82f6] hover:underline">
                Add another skill
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[14px] border border-[#dde5f5] shadow-[0_2px_12px_rgba(15,31,61,.07),0_0_1px_rgba(15,31,61,.1)] bg-white overflow-hidden mb-5">
        <div className="px-5 py-4 bg-[#f8faff] border-b border-[#dde5f5] flex items-center gap-3">
          <div className="w-10 h-10 rounded-[8px] bg-[#fffbeb] border border-[#fcd34d] flex items-center justify-center text-[#d97706]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <div>
            <h2 className="font-['Sora'] text-[16px] font-bold text-[#0f1f3d]">Career Aspirations</h2>
            <p className="text-[11px] text-[#8a97b8]">Role, expertise, secondment and relocation</p>
          </div>
        </div>
        <div className="p-5 flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4">
            <FieldGroup label="Type of role / area interested in" questionRef="Q4">
              <input
                className={inp}
                value={careerRole}
                onChange={(e) => setCareerRole(e.target.value)}
                disabled={!isOwner}
                placeholder="e.g. Senior Analyst, Head of Digital"
              />
            </FieldGroup>
            <FieldGroup label="Timeframe">
              <input
                className={inp}
                value={careerTimeframe}
                onChange={(e) => setCareerTimeframe(e.target.value)}
                disabled={!isOwner}
                placeholder="e.g. Within 2–3 years"
              />
            </FieldGroup>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FieldGroup label="Main areas of expertise relevant to desired move" questionRef="Q5">
              <input
                className={inp}
                value={careerExpertise}
                onChange={(e) => setCareerExpertise(e.target.value)}
                disabled={!isOwner}
                placeholder="e.g. Digital transformation, Risk management"
              />
            </FieldGroup>
            <FieldGroup label="Remarks">
              <input
                className={inp}
                value={careerRemarks}
                onChange={(e) => setCareerRemarks(e.target.value)}
                disabled={!isOwner}
                placeholder="Additional context..."
              />
            </FieldGroup>
          </div>
          <hr className="border-t border-[#dde5f5]" />
          <div className="grid grid-cols-2 gap-4">
            <FieldGroup label="Interested in secondment or loan opportunities?" questionRef="Q6">
              <YesNoPills value={secondment} onChange={(v) => setSecondment(v)} disabled={!isOwner} />
            </FieldGroup>
            <FieldGroup label="Willing to relocate if required?" questionRef="Q7">
              <YesNoPills value={relocate} onChange={(v) => setRelocate(v)} disabled={!isOwner} />
            </FieldGroup>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-3.5 bg-white border-t border-[#dde5f5] shadow-[0_-4px_16px_rgba(15,31,61,0.06)]">
        <span className="text-[11px] text-[#8a97b8] flex items-center gap-1.5">
          {lastSaved ? (
            <>
              <svg className="w-3 h-3 text-[#0d9488]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Saved {formatDate(lastSaved)}
            </>
          ) : (
            "Unsaved changes"
          )}
        </span>
        <div className="flex gap-3">
          {isManager && (
            <button
              type="button"
              onClick={handleManagerSave}
              disabled={savingManager}
              className="flex items-center gap-2 px-5 py-2 rounded-[8px] bg-[#ede9fe] text-[#7c3aed] border border-[#ddd6fe] font-['Sora'] text-[12px] font-semibold hover:bg-[#ddd6fe] transition-colors disabled:opacity-60"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              {savingManager ? "Saving…" : "Save Manager Notes"}
            </button>
          )}
          {isOwner && (
            <button
              type="button"
              onClick={handleEmployeeSave}
              disabled={savingEmployee}
              className="flex items-center gap-2 px-5 py-2 rounded-[8px] bg-[#0d9488] text-white font-['Sora'] text-[12px] font-semibold hover:bg-[#0f766e] transition-colors disabled:opacity-60"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              {savingEmployee ? "Saving…" : "Save Development Profile"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Client wrapper: fetches profile data then renders page header + DevelopmentProfileForm. */
export function DevelopmentProfileLoader({ userId }: { userId: string }) {
  const [data, setData] = useState<{
    profile: DevProfile | null;
    cycles: DevProfileCycle[];
    employee: { full_name: string; division: string };
    isManager: boolean;
    activeAppraisal: { id: string; fiscal_year: string } | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/development-profile/${userId}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json.error) {
          setErr(json.error);
          return;
        }
        setData({
          profile: json.profile ?? null,
          cycles: Array.isArray(json.cycles) ? json.cycles : [],
          employee: json.employee ?? { full_name: "Unknown", division: "—" },
          isManager: !!json.isManager,
          activeAppraisal: json.activeAppraisal ?? null,
        });
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId]);

  if (loading) {
    return <p className="text-[13px] text-[#8a97b8] py-6">Loading development profile…</p>;
  }
  if (err || !data) {
    return (
      <div className="rounded-[14px] border border-[#fecaca] bg-[#fef2f2] px-5 py-4 text-[13px] text-[#b91c1c]">
        {err ?? "Failed to load profile"}
      </div>
    );
  }

  const { profile, employee } = data;

  return (
    <div style={{ animation: "fadeUp 0.4s ease both" }}>
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.1em] text-[#8a97b8] mb-1">Employee Profile</p>
          <h1 className="font-['Sora'] text-[22px] font-extrabold text-[#0f1f3d]">Development Profile</h1>
          <p className="text-[13px] text-[#8a97b8] mt-1">
            {employee.full_name} · {employee.division} · Persistent across all appraisal cycles
          </p>
        </div>
        {profile?.last_updated_at && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f0fdfa] border border-[#99f6e4] text-[#0d9488] text-[11px] font-semibold">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Last updated {formatDate(profile.last_updated_at)}
          </span>
        )}
      </div>
      <DevelopmentProfileForm userId={userId} initialData={data} />
    </div>
  );
}
