"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { CheckIn, CheckInType } from "@/types/checkins";
import type { WorkplanItemForCheckIn } from "@/types/checkins";

interface NewCheckInModalProps {
  appraisalId: string;
  employeeName: string;
  cycleLabel: string;
  workplanItems: WorkplanItemForCheckIn[];
  onCreated: (checkIn: CheckIn) => void;
  onClose: () => void;
}

function defaultTitle(type: CheckInType, cycleLabel: string): string {
  if (type === "MIDYEAR") return `Mid-year check-in ${cycleLabel}`;
  if (type === "QUARTERLY") {
    const now = new Date();
    const q = Math.floor(now.getMonth() / 3) + 1;
    return `Q${q} check-in ${cycleLabel}`;
  }
  return "";
}

export function NewCheckInModal({
  appraisalId,
  employeeName,
  cycleLabel,
  workplanItems,
  onCreated,
  onClose,
}: NewCheckInModalProps) {
  const [checkInType, setCheckInType] = useState<CheckInType>("MIDYEAR");
  const [title, setTitle] = useState(() => defaultTitle("MIDYEAR", cycleLabel));
  const [dueDate, setDueDate] = useState("");
  const [noteToEmployee, setNoteToEmployee] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTypeChange = (type: CheckInType) => {
    setCheckInType(type);
    setTitle(defaultTitle(type, cycleLabel));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (workplanItems.length === 0) {
      setError("No approved workplan found — check-in cannot be created");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/appraisals/${appraisalId}/checkins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          check_in_type: checkInType,
          due_date: dueDate.trim() || null,
          note_to_employee: noteToEmployee.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to create check-in");
      onCreated(data.checkIn);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create check-in");
    } finally {
      setSubmitting(false);
    }
  };

  const overlay = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[16px] border border-[#dde5f5] w-[540px] overflow-hidden"
        style={{ boxShadow: "0 8px 32px rgba(15,31,61,0.16)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#dde5f5] bg-[#f8faff]">
          <div className="w-8 h-8 rounded-[10px] bg-[#f0fdfa] border border-[#99f6e4] flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-[#0f1f3d] font-['Sora']">New check-in</p>
            <p className="text-[11px] text-[#8a97b8]">
              {employeeName} · {cycleLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#8a97b8] hover:text-[#0f1f3d] text-[18px] leading-none p-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-5 space-y-4" style={{ fontFamily: "DM Sans, sans-serif" }}>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[.07em] text-[#8a97b8] mb-1.5">
              Check-in type
            </label>
            <div className="flex gap-2 flex-wrap">
              {(["MIDYEAR", "QUARTERLY", "ADHOC"] as CheckInType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTypeChange(t)}
                  className="px-3 py-2 rounded-[8px] border text-[12px] font-semibold transition-colors"
                  style={{
                    background: checkInType === t ? "#0f1f3d" : "#f8faff",
                    borderColor: checkInType === t ? "#0f1f3d" : "#dde5f5",
                    color: checkInType === t ? "white" : "#4a5a82",
                  }}
                >
                  {t === "MIDYEAR" ? "Mid-year" : t === "QUARTERLY" ? "Quarterly" : "Ad hoc"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[.07em] text-[#8a97b8] mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Mid-year check-in 2025/2026"
              className="w-full px-3 py-2.5 rounded-[8px] border border-[#dde5f5] text-[12px] text-[#0f1f3d] focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10 outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[.07em] text-[#8a97b8] mb-1.5">
              Due date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-[8px] border border-[#dde5f5] text-[12px] text-[#0f1f3d] focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10 outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[.07em] text-[#8a97b8] mb-1.5">
              Note to employee
            </label>
            <textarea
              value={noteToEmployee}
              onChange={(e) => setNoteToEmployee(e.target.value)}
              placeholder="e.g. Please focus on the Cyber Security Policy progress and flag any blockers..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-[8px] border border-[#dde5f5] text-[12px] text-[#0f1f3d] resize-y focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10 outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[.07em] text-[#8a97b8] mb-1.5">
              Objectives that will be included
            </label>
            <div
              className="rounded-[10px] border p-3 max-h-40 overflow-y-auto"
              style={{ background: "#f0fdfa", borderColor: "#99f6e4" }}
            >
              {workplanItems.length === 0 ? (
                <p className="text-[12px] text-[#92400e]">No approved workplan found — check-in cannot be created</p>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2" className="flex-shrink-0">
                        <path d="M9 11l3 3L22 4" />
                        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                      </svg>
                      <span className="text-[11px] font-semibold text-[#0f766e]">Auto-populated from approved workplan</span>
                    </div>
                    <span className="text-[10px] text-[#0f766e] font-semibold">{workplanItems.length} objective(s)</span>
                  </div>
                  <ul className="space-y-2">
                    {workplanItems.map((wi) => (
                      <li key={wi.id} className="flex items-start gap-2 text-[12px] text-[#0f1f3d]">
                        <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: "#059669" }} />
                        <span>{wi.major_task || wi.key_output || "Objective"}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#dde5f5]">
          {error && (
            <p className="text-[12px] text-[#dc2626] mr-auto self-center" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-[8px] border border-[#dde5f5] text-[12px] font-semibold text-[#4a5a82] hover:border-[#0f1f3d] hover:text-[#0f1f3d] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || workplanItems.length === 0}
            className="px-4 py-2 rounded-[8px] bg-[#0d9488] text-white text-[12px] font-semibold hover:bg-[#0f766e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Creating…" : "Create & notify employee"}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(overlay, document.body);
  }
  return null;
}
