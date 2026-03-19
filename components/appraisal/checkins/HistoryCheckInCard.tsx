"use client";

import { useState } from "react";
import type { CheckInWithResponses, CheckInResponse } from "@/types/checkins";

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

function dotColor(r: CheckInResponse): string {
  const status = r.mgr_status_override ?? r.employee_status;
  if (status === "ON_TRACK" || status === "COMPLETE") return "#059669";
  if (status === "AT_RISK") return "#d97706";
  if (status === "BEHIND") return "#ef4444";
  return "#dde5f5";
}

function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    MIDYEAR: "bg-[#f0fdfa] border-[#99f6e4] text-[#0d9488]",
    QUARTERLY: "bg-[#eff6ff] border-[#bfdbfe] text-[#1d4ed8]",
    ADHOC: "bg-[#f5f3ff] border-[#ddd6fe] text-[#6d28d9]",
  };
  const labels: Record<string, string> = {
    MIDYEAR: "Mid-year",
    QUARTERLY: "Quarterly",
    ADHOC: "Ad hoc",
  };
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-[.04em] border flex-shrink-0 ${styles[type] ?? styles.ADHOC}`}
    >
      {labels[type] ?? type}
    </span>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const style = STATUS_STYLES[status] ?? { bg: "#f8faff", border: "#dde5f5", text: "#4a5a82", label: status };
  return (
    <span
      className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-semibold"
      style={{ background: style.bg, border: `1px solid ${style.border}`, color: style.text }}
    >
      {style.label}
    </span>
  );
}

function deriveOverallOutcome(responses: CheckInResponse[]): { label: string; color: string } {
  const statuses = responses.map((r) => r.mgr_status_override ?? r.employee_status);
  if (statuses.includes("BEHIND")) return { label: "Behind", color: "#dc2626" };
  if (statuses.includes("AT_RISK")) return { label: "At risk", color: "#d97706" };
  if (statuses.every((s) => s === "COMPLETE")) return { label: "Complete", color: "#059669" };
  return { label: "On track", color: "#059669" };
}

interface HistoryCheckInCardProps {
  checkIn: CheckInWithResponses;
}

export function HistoryCheckInCard({ checkIn }: HistoryCheckInCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [hover, setHover] = useState(false);
  const responses = checkIn.responses ?? [];
  const isCancelled = checkIn.status === "CANCELLED";
  const completedDate = checkIn.manager_reviewed_at ?? checkIn.employee_submitted_at ?? checkIn.updated_at;
  const { label: overallOutcomeLabel, color: overallOutcomeColor } = deriveOverallOutcome(responses);

  const cardContent = isCancelled ? (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0 bg-[#f8faff] border border-[#dde5f5]">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8a97b8" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-[#8a97b8] truncate">{checkIn.title}</p>
        <p className="text-[10px] text-[#8a97b8] mt-0.5">{formatDate(checkIn.created_at)}</p>
      </div>
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#f8faff] border border-[#dde5f5] text-[10px] font-semibold text-[#8a97b8] flex-shrink-0">
        Cancelled
      </span>
    </div>
  ) : (
    <div
      className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-[#f8faff] transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <div
        className={`w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0 ${
          checkIn.status === "COMPLETE" ? "bg-[#ecfdf5] border border-[#6ee7b7]" : "bg-[#f8faff] border border-[#dde5f5]"
        }`}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke={checkIn.status === "COMPLETE" ? "#059669" : "#8a97b8"}
          strokeWidth="2"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-[13px] font-semibold text-[#0f1f3d] truncate">{checkIn.title}</p>
          <TypeBadge type={checkIn.check_in_type} />
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-[#8a97b8]">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {formatDate(checkIn.created_at)}
          <span className="text-[#dde5f5]">·</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          Completed {formatDate(completedDate)}
        </div>
      </div>
      <div className="flex items-center gap-3 mr-2">
        {responses.map((r) => {
          const status = r.mgr_status_override ?? r.employee_status;
          const statusColours: Record<string, string> = { ON_TRACK: "#059669", COMPLETE: "#059669", AT_RISK: "#d97706", BEHIND: "#ef4444" };
          const colour = (status && statusColours[status]) ? statusColours[status] : "#dde5f5";
          return (
            <div key={r.id} className="flex flex-col items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colour }} />
              <p className="text-[8px] text-[#8a97b8] max-w-[56px] truncate text-center">
                {r.workplan_item?.major_task ?? "—"}
              </p>
            </div>
          );
        })}
      </div>
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ecfdf5] border border-[#6ee7b7] text-[10px] font-semibold text-[#065f46] flex-shrink-0">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Complete
      </span>
      <svg
        className={`flex-shrink-0 text-[#8a97b8] transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </div>
  );

  return (
    <div
      className="rounded-[14px] bg-white overflow-hidden transition-colors"
      style={{
        border: `0.5px solid ${hover ? "#0d9488" : "#dde5f5"}`,
        borderRadius: 14,
        boxShadow: "0 2px 12px rgba(15,31,61,0.07)",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {cardContent}

      {expanded && !isCancelled && (
        <div className="border-t border-[#dde5f5]">
          {responses.map((response, i) => (
            <div
              key={response.id}
              className={`px-5 py-4 ${i > 0 ? "border-t border-[#dde5f5]" : ""}`}
            >
              <p className="text-[12px] font-semibold text-[#0f1f3d] mb-0.5">
                {response.workplan_item?.major_task ?? "Objective"}
              </p>
              <p className="text-[10px] text-[#8a97b8] mb-3">
                {response.workplan_item?.key_output ?? "—"}
                {response.workplan_item?.metric_target != null &&
                  ` · Target: ${response.workplan_item.metric_target}`}
                · Weight: {response.workplan_item?.weight ?? 0}%
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[.07em] text-[#8a97b8] mb-2">Employee</p>
                  <div className="bg-[#f8faff] border border-[#dde5f5] rounded-[8px] p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <StatusBadge status={response.employee_status} />
                      {response.progress_pct != null && (
                        <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-[#eff6ff] border border-[#bfdbfe] text-[#1d4ed8]">
                          {response.progress_pct}%
                        </span>
                      )}
                    </div>
                    {response.employee_comment && (
                      <p className="text-[11px] text-[#0f1f3d] leading-relaxed">{response.employee_comment}</p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[.07em] text-[#0d9488] mb-2">
                    Manager response
                  </p>
                  <div className="bg-[#f0fdfa] border border-[#99f6e4] rounded-[8px] p-3">
                    <div className="flex items-center gap-2 mb-2">
                      {response.mgr_status_override ? (
                        <StatusBadge status={response.mgr_status_override} />
                      ) : (
                        <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-[#ecfdf5] border border-[#6ee7b7] text-[#065f46]">
                          Agreed
                        </span>
                      )}
                    </div>
                    {response.mgr_comment && (
                      <p className="text-[11px] text-[#0f1f3d] leading-relaxed">{response.mgr_comment}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {checkIn.manager_overall_notes && (
            <div className="px-5 py-3 border-t border-[#dde5f5] bg-[#f0fdfa]">
              <p className="text-[9px] font-bold uppercase tracking-[.07em] text-[#0d9488] mb-1.5">
                Manager overall notes
              </p>
              <p className="text-[12px] text-[#0f1f3d] leading-relaxed">{checkIn.manager_overall_notes}</p>
            </div>
          )}
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#dde5f5] bg-[#f8faff]">
            <span className="text-[11px] text-[#8a97b8]">
              Reviewed by manager · {formatDate(checkIn.manager_reviewed_at)}
            </span>
            <span className="text-[11px] text-[#8a97b8]">
              Overall outcome: <strong style={{ color: overallOutcomeColor }}>{overallOutcomeLabel}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
