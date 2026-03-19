"use client";

import React, { useState } from "react";
import type { CheckInWithResponses, CheckInResponse, ObjectiveStatus } from "@/types/checkins";

const CARD_STYLE = { borderRadius: 14, boxShadow: "0 2px 12px rgba(15,31,61,0.07)" };
const STATUS_STYLES: Record<string, { bg: string; border: string; text: string; dot: string; label: string }> = {
  ON_TRACK: { bg: "#ecfdf5", border: "#6ee7b7", text: "#065f46", dot: "#059669", label: "On track" },
  AT_RISK: { bg: "#fffbeb", border: "#fcd34d", text: "#92400e", dot: "#d97706", label: "At risk" },
  BEHIND: { bg: "#fff1f2", border: "#fecaca", text: "#dc2626", dot: "#ef4444", label: "Behind" },
  COMPLETE: { bg: "#ecfdf5", border: "#6ee7b7", text: "#065f46", dot: "#059669", label: "Complete" },
};

function formatDate(s: string | null): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return s;
  }
}

function formatType(t: string): string {
  if (t === "MIDYEAR") return "Mid-year";
  if (t === "QUARTERLY") return "Quarterly";
  return "Ad hoc";
}

type WorkplanItemForProgress = {
  id: string;
  major_task?: string;
  key_output?: string;
  metric_target: number | null;
  metric_type: string | null;
  weight?: number;
};

type CheckInResponseDraft = {
  employee_status?: ObjectiveStatus | null;
  progress_pct?: number | null;
  progress_actual?: number | null;
  completion_date?: string | null;
  apply_date_to_annual?: boolean;
  boolean_complete?: boolean | null;
  employee_comment?: string | null;
  mgr_status_override?: ObjectiveStatus | null;
  mgr_comment?: string | null;
};

function toProgressPct(
  draft: CheckInResponseDraft,
  item: WorkplanItemForProgress
): number | null {
  const type = (item.metric_type ?? "NUMBER").toUpperCase();
  if (type === "NUMBER" && draft.progress_actual != null && (item.metric_target ?? 0) > 0) {
    return Math.round((draft.progress_actual / (item.metric_target ?? 1)) * 100);
  }
  if (type === "PERCENTAGE") return draft.progress_pct ?? null;
  if (type === "BOOLEAN") return draft.boolean_complete === true ? 100 : draft.boolean_complete === false ? 0 : null;
  if (type === "DATE") return draft.completion_date ? 100 : null;
  return draft.progress_pct ?? null;
}

function renderProgressInput(
  item: WorkplanItemForProgress,
  draft: CheckInResponseDraft,
  onChange: (fields: Partial<CheckInResponseDraft>) => void
): React.ReactNode {
  const type = (item.metric_type ?? "NUMBER").toUpperCase();

  if (type === "NUMBER") {
    const target = item.metric_target ?? 0;
    return (
      <div>
        <p className="text-[9px] font-bold uppercase tracking-[.08em] text-[#8a97b8] mb-2">
          Actual value
          <span className="ml-2 normal-case tracking-normal font-normal text-[#8a97b8]">
            Target: {target}
          </span>
        </p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={0}
            value={draft.progress_actual ?? ""}
            onChange={(e) =>
              onChange({
                progress_actual: e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
            placeholder="0"
            className="w-[90px] border border-[#dde5f5] rounded-[8px] px-3 py-2 text-[13px] font-semibold text-[#0f1f3d] text-center focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10 outline-none bg-white"
          />
          <span className="text-[12px] text-[#8a97b8]">of {target}</span>
          {draft.progress_actual != null && target > 0 && (
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f0fdfa] border border-[#99f6e4] text-[11px] font-bold text-[#0d9488]">
              {Math.min(100, Math.round((Number(draft.progress_actual) / target) * 100))}% complete
            </span>
          )}
        </div>
      </div>
    );
  }

  if (type === "PERCENTAGE") {
    const progress = draft.progress_pct ?? 0;
    return (
      <div style={{ marginBottom: 12 }}>
        <p className="text-[9px] font-bold uppercase tracking-[.07em] text-[#8a97b8] mb-2">
          Progress — <span className="text-[#0d9488]">{progress}%</span>
        </p>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={progress}
            onChange={(e) => onChange({ progress_pct: Number(e.target.value) })}
            className="w-[180px] flex-shrink-0 h-2 rounded-full appearance-none bg-[#dde5f5] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#0d9488]"
            style={{ accentColor: "#0d9488" }}
          />
          <div className="w-[120px] h-[4px] rounded-full bg-[#dde5f5] overflow-hidden flex-shrink-0">
            <div
              className="h-full rounded-full bg-[#0d9488] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[12px] font-semibold text-[#0d9488] w-[36px] flex-shrink-0 tabular-nums">
            {progress}%
          </span>
        </div>
      </div>
    );
  }

  if (type === "DATE") {
    return (
      <div style={{ marginBottom: 12 }}>
        <p className="text-[9px] font-bold uppercase tracking-[.07em] text-[#8a97b8] mb-2">
          Completion date
          {item.metric_target != null && (
            <span className="ml-2 font-normal normal-case tracking-normal text-[#8a97b8]">
              Target: {item.metric_target}
            </span>
          )}
        </p>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={draft.completion_date ?? ""}
            onChange={(e) => onChange({ completion_date: e.target.value || undefined })}
            className="border border-[#dde5f5] rounded-[8px] px-3 py-2 text-[12px] text-[#0f1f3d] focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10 outline-none"
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.apply_date_to_annual ?? false}
              onChange={(e) => onChange({ apply_date_to_annual: e.target.checked })}
              className="w-3.5 h-3.5 accent-[#0d9488]"
            />
            <span className="text-[11px] text-[#8a97b8]">Apply to annual appraisal</span>
          </label>
        </div>
      </div>
    );
  }

  if (type === "BOOLEAN") {
    return (
      <div style={{ marginBottom: 12 }}>
        <p className="text-[9px] font-bold uppercase tracking-[.07em] text-[#8a97b8] mb-2">
          Completion
        </p>
        <div className="flex gap-2">
          {(["Done", "Not done"] as const).map((opt) => {
            const isDone = opt === "Done";
            const selected = draft.boolean_complete === isDone;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange({ boolean_complete: isDone })}
                className={`px-4 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${
                  selected && isDone
                    ? "bg-[#ecfdf5] border-[#6ee7b7] text-[#065f46]"
                    : selected && !isDone
                      ? "bg-[#fff1f2] border-[#fecaca] text-[#dc2626]"
                      : "bg-white border-[#dde5f5] text-[#8a97b8]"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}

interface ActiveCheckInCardProps {
  appraisalId: string;
  checkIn: CheckInWithResponses;
  appraisal: { employeeName: string; employee_id: string; manager_employee_id: string | null };
  currentUser: { employee_id: string | null; roles: string[] };
  role: "MANAGER" | "EMPLOYEE" | "HR";
  onUpdate: () => void;
}

export function ActiveCheckInCard({
  appraisalId,
  checkIn,
  appraisal,
  currentUser,
  role,
  onUpdate,
}: ActiveCheckInCardProps) {
  const [localResponses, setLocalResponses] = useState<Record<string, Partial<CheckInResponseDraft>>>({});
  const [managerOverallNotes, setManagerOverallNotes] = useState(checkIn.manager_overall_notes ?? "");
  const [loading, setLoading] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const responses = checkIn.responses ?? [];
  const status = checkIn.status as string;
  const isManager = role === "MANAGER" || role === "HR";
  const isEmployee = role === "EMPLOYEE";

  const getResponse = (r: CheckInResponse): CheckInResponseDraft & { employee_comment?: string | null } => {
    const local = localResponses[r.workplan_item_id];
    return {
      employee_status: (local?.employee_status ?? r.employee_status) as ObjectiveStatus | null,
      progress_pct: local?.progress_pct ?? r.progress_pct ?? 0,
      progress_actual: local?.progress_actual,
      completion_date: local?.completion_date,
      apply_date_to_annual: local?.apply_date_to_annual ?? false,
      boolean_complete: local?.boolean_complete,
      employee_comment: local?.employee_comment ?? r.employee_comment,
      mgr_status_override: (local?.mgr_status_override ?? r.mgr_status_override) as ObjectiveStatus | null,
      mgr_comment: local?.mgr_comment ?? r.mgr_comment,
    };
  };

  const patch = async (body: Record<string, unknown>) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/appraisals/${appraisalId}/checkins/${checkIn.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Request failed");
      onUpdate();
      setConfirmSubmit(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const buildResponsesPayload = () =>
    responses.map((r) => {
      const curr = getResponse(r);
      const wp = r.workplan_item;
      const item: WorkplanItemForProgress = wp
        ? {
            id: wp.id,
            major_task: wp.major_task,
            key_output: wp.key_output,
            metric_target: wp.metric_target ?? null,
            metric_type: wp.metric_type ?? null,
            weight: wp.weight,
          }
        : { id: r.workplan_item_id, metric_target: null, metric_type: null };
      const progress_pct = toProgressPct(curr, item);
      return {
        workplan_item_id: r.workplan_item_id,
        employee_status: curr.employee_status,
        progress_pct: progress_pct != null ? Math.min(100, Math.max(0, progress_pct)) : null,
        employee_comment: curr.employee_comment ?? null,
        mgr_status_override: curr.mgr_status_override,
        mgr_comment: curr.mgr_comment ?? null,
        ...(curr.completion_date != null && { completion_date: curr.completion_date }),
        ...(curr.apply_date_to_annual && { apply_date_to_annual: true }),
      };
    });

  // State A: OPEN, MANAGER
  if (status === "OPEN" && isManager) {
    const borderStyle = { border: "1.5px solid #0d9488" };
    return (
      <div className="rounded-[14px] overflow-hidden bg-white" style={{ ...CARD_STYLE, ...borderStyle }}>
        <div className="flex items-center gap-3 px-5 py-3.5 bg-[#f0fdfa] border-b border-[#99f6e4]">
          <div className="w-8 h-8 rounded-[8px] bg-[#f0fdfa] border border-[#99f6e4] flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[#0f766e]">{checkIn.title}</p>
            <p className="text-[11px] text-[#0d9488] mt-0.5">
              {formatType(checkIn.check_in_type)} · Due {formatDate(checkIn.due_date)} · Initiated by you
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold bg-[#fffbeb] border-[#fcd34d] text-[#92400e]">
            Awaiting employee
          </span>
        </div>
        <div className="px-5 py-4 bg-[#fffbeb] border-b border-[#fcd34d]">
          <p className="text-[12px] text-[#92400e]">
            Waiting for {appraisal.employeeName} to complete their check-in. You can add your response once they submit.
          </p>
        </div>
        <div className="p-5 space-y-4">
          {responses.map((r) => {
            const wp = r.workplan_item;
            return (
              <div key={r.id} className="pb-4 border-b border-[#dde5f5] last:border-0 last:pb-0">
                <p className="text-[12px] font-semibold text-[#0f1f3d]">{wp?.major_task ?? "Objective"}</p>
                <p className="text-[11px] text-[#8a97b8] mt-0.5">
                  {wp?.key_output ?? "—"} · Target: {wp?.metric_target ?? "—"} · Weight: {wp?.weight ?? 0}%
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {wp?.metric_type?.toUpperCase() === "NUMBER" && wp?.metric_target != null ? (
                    <span className="inline-flex px-2 py-1 rounded text-[10px] bg-[#f8faff] border border-[#dde5f5] text-[#4a5a82]">
                      Actual: — / {wp.metric_target}
                    </span>
                  ) : (
                    <span className="inline-flex px-2 py-1 rounded text-[10px] bg-[#f8faff] border border-[#dde5f5] text-[#4a5a82]">Progress: —</span>
                  )}
                  <span className="inline-flex px-2 py-1 rounded text-[10px] bg-[#f8faff] border border-[#dde5f5] text-[#4a5a82]">Status: awaiting input</span>
                  <span className="inline-flex px-2 py-1 rounded text-[10px] bg-[#f8faff] border border-[#dde5f5] text-[#4a5a82]">Comment: —</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-t border-[#dde5f5] bg-[#f8faff]">
          <button
            type="button"
            onClick={() => {
              if (confirm("Cancel this check-in? This cannot be undone.")) patch({ action: "CANCEL" });
            }}
            disabled={loading}
            className="px-4 py-2 rounded-[8px] border border-[#dc2626] text-[12px] font-semibold text-[#dc2626] hover:bg-[#fef2f2] transition-colors disabled:opacity-50"
          >
            Cancel check-in
          </button>
          <button
            type="button"
            disabled
            title="Available after employee submits"
            className="px-4 py-2 rounded-[8px] bg-[#e2e8f0] text-[12px] font-semibold text-[#94a3b8] cursor-not-allowed"
          >
            Add manager response
          </button>
        </div>
      </div>
    );
  }

  // State B: OPEN, EMPLOYEE
  if (status === "OPEN" && isEmployee) {
    const STATUS_LABELS: Record<string, string> = {
      ON_TRACK: "On track",
      AT_RISK: "At risk",
      BEHIND: "Behind",
      COMPLETE: "Complete",
    };
    const statusPillStyles = (s: string, selected: boolean) => {
      const base = "bg-white border-[#dde5f5] text-[#8a97b8]";
      if (!selected) {
        const hover: Record<string, string> = {
          ON_TRACK: "hover:border-[#6ee7b7] hover:text-[#065f46]",
          AT_RISK: "hover:border-[#fcd34d] hover:text-[#92400e]",
          BEHIND: "hover:border-[#fecaca] hover:text-[#dc2626]",
          COMPLETE: "hover:border-[#6ee7b7] hover:text-[#065f46]",
        };
        return `${base} ${hover[s] ?? ""}`;
      }
      const sel: Record<string, string> = {
        ON_TRACK: "bg-[#ecfdf5] border-[#6ee7b7] text-[#065f46]",
        AT_RISK: "bg-[#fffbeb] border-[#fcd34d] text-[#92400e]",
        BEHIND: "bg-[#fff1f2] border-[#fecaca] text-[#dc2626]",
        COMPLETE: "bg-[#ecfdf5] border-[#6ee7b7] text-[#065f46]",
      };
      return sel[s] ?? base;
    };
    return (
      <div className="bg-white rounded-[14px] overflow-hidden mb-4 border border-[#dde5f5] shadow-[0_2px_12px_rgba(15,31,61,0.07)] border-l-4 border-l-[#d97706]">
        <div className="flex items-center justify-between gap-3 px-5 py-4 bg-[#fffbeb] border-b border-[#fcd34d]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[9px] bg-white border border-[#fcd34d] flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div>
              <p className="font-['Sora'] text-[13px] font-bold text-[#92400e]">{checkIn.title}</p>
              <p className="text-[11px] text-[#d97706] mt-0.5">
                {formatType(checkIn.check_in_type)} · Due {formatDate(checkIn.due_date)} · Your manager is waiting for your input
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#fcd34d] text-[10px] font-bold text-[#92400e] whitespace-nowrap flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d97706]" />
            Action required
          </span>
        </div>
        {checkIn.note_to_employee && (
          <div className="flex items-start gap-3 mx-5 mt-4 px-4 py-3 bg-[#fffbeb] border border-[#fcd34d] rounded-[10px]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" className="flex-shrink-0 mt-0.5">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <div>
              <p className="text-[10px] font-bold text-[#92400e] uppercase tracking-[.07em] mb-1">Note from your manager</p>
              <p className="text-[12px] text-[#92400e] leading-relaxed">{checkIn.note_to_employee}</p>
            </div>
          </div>
        )}
        <div className="p-5">
          {responses.map((r, i) => {
            const wp = r.workplan_item;
            const curr = getResponse(r);
            const updateDraft = (fields: Partial<CheckInResponseDraft>) =>
              setLocalResponses((prev) => ({
                ...prev,
                [r.workplan_item_id]: { ...prev[r.workplan_item_id], ...fields },
              }));
            const itemForProgress: WorkplanItemForProgress = wp
              ? { id: wp.id, major_task: wp.major_task, key_output: wp.key_output, metric_target: wp.metric_target ?? null, metric_type: wp.metric_type ?? null, weight: wp.weight }
              : { id: r.workplan_item_id, metric_target: null, metric_type: "PERCENTAGE" };
            return (
              <div
                key={r.id}
                className={`rounded-[10px] border border-[#dde5f5] bg-[#f8faff] p-4 ${i > 0 ? "mt-3" : ""}`}
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <p className="font-['Sora'] text-[13px] font-bold text-[#0f1f3d]">{wp?.major_task ?? "Objective"}</p>
                    <p className="text-[11px] text-[#8a97b8] mt-0.5">
                      {wp?.key_output ?? "—"}
                      {wp?.metric_target != null && ` · Target: ${wp.metric_target}`}
                      · Weight: {wp?.weight ?? 0}%
                    </p>
                  </div>
                  {curr.employee_status && (
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold flex-shrink-0"
                      style={{
                        background: STATUS_STYLES[curr.employee_status]?.bg ?? "#f8faff",
                        border: `1px solid ${STATUS_STYLES[curr.employee_status]?.border ?? "#dde5f5"}`,
                        color: STATUS_STYLES[curr.employee_status]?.text ?? "#4a5a82",
                      }}
                    >
                      {STATUS_STYLES[curr.employee_status]?.label ?? curr.employee_status}
                    </span>
                  )}
                </div>
                <div className="border-t border-[#dde5f5] mb-4" />
                <div className="mb-4">
                  <p className="text-[9px] font-bold uppercase tracking-[.08em] text-[#8a97b8] mb-2">How are you tracking?</p>
                  <div className="flex gap-2 flex-wrap">
                    {(["ON_TRACK", "AT_RISK", "BEHIND", "COMPLETE"] as const).map((s) => {
                      const selected = curr.employee_status === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => updateDraft({ employee_status: s })}
                          className={`px-4 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${statusPillStyles(s, selected)}`}
                        >
                          {STATUS_LABELS[s]}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="mb-4 bg-white rounded-[8px] border border-[#dde5f5] p-3">
                  {renderProgressInput(itemForProgress, curr, updateDraft)}
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[.08em] text-[#8a97b8] mb-2">Your comment</p>
                  <textarea
                    rows={3}
                    value={curr.employee_comment ?? ""}
                    onChange={(e) => updateDraft({ employee_comment: e.target.value || null })}
                    placeholder="Describe your progress, any blockers, or context for your manager..."
                    className="w-full border border-[#dde5f5] rounded-[8px] px-3 py-2.5 text-[12px] text-[#0f1f3d] bg-white resize-none outline-none placeholder:text-[#c4cde0] leading-relaxed focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10 transition-colors"
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-[#dde5f5] bg-[#f8faff]">
          <button
            type="button"
            onClick={() => patch({ action: "EMPLOYEE_SAVE_DRAFT", responses: buildResponsesPayload() })}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[8px] border border-[#dde5f5] text-[12px] font-semibold text-[#4a5a82] bg-white hover:border-[#0f1f3d] hover:text-[#0f1f3d] disabled:opacity-50 transition-colors"
          >
            {loading ? "Saving…" : "Save draft"}
          </button>
          {!confirmSubmit ? (
            <button
              type="button"
              onClick={() => setConfirmSubmit(true)}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-[8px] bg-[#0d9488] text-white text-[12px] font-semibold hover:bg-[#0f766e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Submit to manager
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#4a5a82]">Once submitted you cannot edit.</span>
              <button
                type="button"
                onClick={() => setConfirmSubmit(false)}
                className="px-3 py-1.5 rounded text-[11px] border border-[#dde5f5] text-[#4a5a82]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => patch({ action: "EMPLOYEE_SUBMIT", responses: buildResponsesPayload() })}
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-[8px] bg-[#0d9488] text-white text-[12px] font-semibold hover:bg-[#0f766e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Submitting…
                  </>
                ) : (
                  "Confirm submit"
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // State C: EMPLOYEE_SUBMITTED, MANAGER
  if (status === "EMPLOYEE_SUBMITTED" && isManager) {
    const borderStyle = { border: "1.5px solid #0d9488" };
    return (
      <div className="rounded-[14px] overflow-hidden bg-white" style={{ ...CARD_STYLE, ...borderStyle }}>
        <div className="flex items-center gap-3 px-5 py-3.5 bg-[#f0fdfa] border-b border-[#99f6e4]">
          <div className="w-8 h-8 rounded-[8px] bg-[#f0fdfa] border border-[#99f6e4] flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[#0f766e]">{checkIn.title}</p>
            <p className="text-[11px] text-[#0d9488] mt-0.5">
              Employee submitted {checkIn.employee_submitted_at ? formatDate(checkIn.employee_submitted_at) : ""} · Add your response
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold bg-[#eff6ff] border-[#bfdbfe] text-[#1d4ed8]">
            Employee submitted
          </span>
        </div>
        <div className="px-5 py-3 bg-[#f0fdfa] border-b border-[#99f6e4]">
          <p className="text-[12px] text-[#0f766e]">
            {appraisal.employeeName} has submitted their check-in — review and add your response below
          </p>
        </div>
        <div className="p-5 space-y-6">
          {responses.map((r) => {
            const wp = r.workplan_item;
            const curr = getResponse(r);
            const empStatus = r.employee_status;
            const empStyle = empStatus ? STATUS_STYLES[empStatus] : { bg: "#f8faff", border: "#dde5f5", text: "#4a5a82", label: "—" };
            return (
              <div key={r.id} className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6 border-b border-[#dde5f5] last:border-0 last:pb-0">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.07em] text-[#8a97b8] mb-1.5">Employee</p>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <span
                        className="inline-flex px-2 py-1 rounded text-[10px] font-semibold"
                        style={{ background: empStyle.bg, border: `1px solid ${empStyle.border}`, color: empStyle.text }}
                      >
                        {empStyle.label}
                      </span>
                      <span className="inline-flex px-2 py-1 rounded text-[10px] font-semibold bg-[#eff6ff] border border-[#bfdbfe] text-[#1d4ed8]">
                        {r.progress_pct ?? 0}%
                      </span>
                    </div>
                    <div className="rounded-[8px] border border-[#dde5f5] bg-[#f8faff] p-3">
                      <p className="text-[11px] text-[#0f1f3d] whitespace-pre-wrap">{r.employee_comment || "—"}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.07em] text-[#8a97b8] mb-1.5">Your response</p>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setLocalResponses((prev) => ({
                            ...prev,
                            [r.workplan_item_id]: { ...prev[r.workplan_item_id], mgr_status_override: null },
                          }))
                        }
                        className="px-2.5 py-1 rounded text-[10px] font-semibold transition-colors"
                        style={{
                          background: curr.mgr_status_override == null ? "#ecfdf5" : "#f8faff",
                          border: `1px solid ${curr.mgr_status_override == null ? "#6ee7b7" : "#dde5f5"}`,
                          color: curr.mgr_status_override == null ? "#065f46" : "#4a5a82",
                        }}
                      >
                        Agree
                      </button>
                      {(["AT_RISK", "BEHIND"] as const).map((s) => {
                        const style = STATUS_STYLES[s];
                        const selected = curr.mgr_status_override === s;
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() =>
                              setLocalResponses((prev) => ({
                                ...prev,
                                [r.workplan_item_id]: { ...prev[r.workplan_item_id], mgr_status_override: s },
                              }))
                            }
                            className="px-2.5 py-1 rounded text-[10px] font-semibold transition-colors"
                            style={{
                              background: selected ? style.bg : "#f8faff",
                              border: `1px solid ${selected ? style.border : "#dde5f5"}`,
                              color: selected ? style.text : "#4a5a82",
                            }}
                          >
                            {style.label}
                          </button>
                        );
                      })}
                    </div>
                    <textarea
                      value={curr.mgr_comment ?? ""}
                      onChange={(e) =>
                        setLocalResponses((prev) => ({
                          ...prev,
                          [r.workplan_item_id]: { ...prev[r.workplan_item_id], mgr_comment: e.target.value || null },
                        }))
                      }
                      placeholder="Add your comments or guidance..."
                      rows={2}
                      className="w-full px-3 py-2 rounded-[8px] border border-[#dde5f5] text-[12px] text-[#0f1f3d] focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10 outline-none resize-y"
                    />
                  </div>
                </div>
                <p className="text-[12px] font-semibold text-[#0f1f3d] md:col-span-2">{wp?.major_task ?? "Objective"}</p>
              </div>
            );
          })}
          <div className="pt-2">
            <p className="text-[10px] font-bold uppercase tracking-[.07em] text-[#8a97b8] mb-1.5">Overall notes for employee</p>
            <textarea
              value={managerOverallNotes}
              onChange={(e) => setManagerOverallNotes(e.target.value)}
              placeholder="Summary comments visible to the employee after you complete this check-in..."
              rows={3}
              className="w-full px-3 py-2 rounded-[8px] border border-[#dde5f5] text-[12px] text-[#0f1f3d] focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10 outline-none resize-y"
            />
          </div>
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-t border-[#dde5f5] bg-[#f8faff]">
          <button
            type="button"
            onClick={() =>
              patch({
                action: "MANAGER_RESPOND",
                saveOnly: true,
                responses: buildResponsesPayload(),
                manager_overall_notes: managerOverallNotes || null,
              })
            }
            disabled={loading}
            className="px-4 py-2 rounded-[8px] border border-[#dde5f5] text-[12px] font-semibold text-[#4a5a82] hover:border-[#0f1f3d] hover:text-[#0f1f3d] transition-colors disabled:opacity-50"
          >
            Save draft
          </button>
          <button
            type="button"
            onClick={() =>
              patch({
                action: "MANAGER_COMPLETE",
                responses: buildResponsesPayload(),
                manager_overall_notes: managerOverallNotes || null,
              })
            }
            disabled={loading}
            className="px-4 py-2 rounded-[8px] bg-[#0d9488] text-white text-[12px] font-semibold hover:bg-[#0f766e] transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {loading ? "Completing…" : "Complete check-in ✓"}
          </button>
        </div>
      </div>
    );
  }

  // State D: EMPLOYEE_SUBMITTED, EMPLOYEE (read-only)
  if (status === "EMPLOYEE_SUBMITTED" && isEmployee) {
    return (
      <div className="rounded-[14px] overflow-hidden bg-white border border-[#dde5f5]" style={CARD_STYLE}>
        <div className="flex items-center gap-3 px-5 py-3.5 bg-[#f8faff] border-b border-[#dde5f5]">
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[#0f1f3d]">{checkIn.title}</p>
            <p className="text-[11px] text-[#8a97b8] mt-0.5">
              {formatType(checkIn.check_in_type)} · Due {formatDate(checkIn.due_date)}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold bg-[#eff6ff] border-[#bfdbfe] text-[#1d4ed8]">
            Submitted — awaiting manager review
          </span>
        </div>
        <div className="p-5 space-y-4">
          {responses.map((r) => {
            const wp = r.workplan_item;
            const empStatus = r.employee_status;
            const empStyle = empStatus ? STATUS_STYLES[empStatus] : { bg: "#f8faff", border: "#dde5f5", text: "#4a5a82", label: "—" };
            return (
              <div key={r.id} className="pb-4 border-b border-[#dde5f5] last:border-0 last:pb-0">
                <p className="text-[12px] font-semibold text-[#0f1f3d]">{wp?.major_task ?? "Objective"}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span
                    className="inline-flex px-2 py-1 rounded text-[10px] font-semibold"
                    style={{ background: empStyle.bg, border: `1px solid ${empStyle.border}`, color: empStyle.text }}
                  >
                    {empStyle.label}
                  </span>
                  <span className="inline-flex px-2 py-1 rounded text-[10px] font-semibold bg-[#eff6ff] border border-[#bfdbfe] text-[#1d4ed8]">
                    {r.progress_pct ?? 0}%
                  </span>
                </div>
                <div className="mt-2 rounded-[8px] border border-[#dde5f5] bg-[#f8faff] p-3">
                  <p className="text-[11px] text-[#0f1f3d] whitespace-pre-wrap">{r.employee_comment || "—"}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}
