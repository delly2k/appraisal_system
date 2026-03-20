"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { CompletionReport } from "@/lib/appraisal-completion";
import type { AppraisalStatus } from "@/types/appraisal";
import type { WorkflowRole } from "@/lib/appraisal-workflow";

const SUBMIT_LABELS: Record<AppraisalStatus, string> = {
  DRAFT: "Submit for Approval →",
  PENDING_APPROVAL: "Approve Workplan →",
  IN_PROGRESS: "Start self-assessment →",
  SELF_ASSESSMENT: "Submit Self-Assessment →",
  SUBMITTED: "Submitted",
  MANAGER_REVIEW: "Proceed to Sign-off →",
  PENDING_SIGNOFF: "Sign Off →",
  HOD_REVIEW: "Mark Complete →",
  HR_REVIEW: "Mark Complete →",
  COMPLETE: "",
};

/** Map blocker prefix to tab key (matches AppraisalTabs), tab label, and display label for messages. */
const BLOCKER_MAP: { prefix: string; tabKey: string; tabLabel: string; displayLabel: string }[] = [
  { prefix: "Core Competencies:", tabKey: "core", tabLabel: "Core Comp.", displayLabel: "Core competencies" },
  { prefix: "Technical Skills:", tabKey: "technical", tabLabel: "Technical", displayLabel: "Technical" },
  { prefix: "Productivity:", tabKey: "productivity", tabLabel: "Productivity", displayLabel: "Productivity" },
  { prefix: "Leadership:", tabKey: "leadership", tabLabel: "Leadership", displayLabel: "Leadership" },
  { prefix: "Workplan:", tabKey: "workplan", tabLabel: "Workplan", displayLabel: "Workplan" },
];

function parseBlocker(b: string): { key: string; message: string; tabKey: string; tabLabel: string } {
  for (const m of BLOCKER_MAP) {
    if (b.startsWith(m.prefix)) {
      const rest = b.slice(m.prefix.length).trim();
      const numMatch =
        rest.match(/(\d+)\s*(rating|objective)s?\s*(missing|incomplete)/i) ||
        rest.match(/(\d+)\s*(rating|objective)\s*(missing|incomplete)/i);
      const missing = numMatch ? Number(numMatch[1]) : 0;
      const word = rest.toLowerCase().includes("objective") ? "objective" : "rating";
      const suffix = rest.toLowerCase().includes("incomplete") ? "incomplete" : "missing";
      const message =
        missing > 0
          ? `${m.displayLabel} — ${missing} ${word}${missing !== 1 ? "s" : ""} ${suffix}`
          : rest;
      return { key: `${m.tabKey}-${b.slice(0, 20)}`, message, tabKey: m.tabKey, tabLabel: m.tabLabel };
    }
  }
  return { key: `blocker-${b.slice(0, 15)}`, message: b, tabKey: "workplan", tabLabel: "Workplan" };
}

interface CompletionBarProps {
  report: CompletionReport;
  status: AppraisalStatus;
  userRole: WorkflowRole;
  onSubmit: () => Promise<void>;
  isSubmitting?: boolean;
}

export function CompletionBar({
  report,
  status,
  userRole,
  onSubmit,
  isSubmitting = false,
}: CompletionBarProps) {
  const [showDetails, setShowDetails] = useState(false);

  const pct = report.totalFields === 0 ? 0 : Math.round((report.completedFields / report.totalFields) * 100);
  const completedFields = report.completedFields;
  const totalFields = report.totalFields;
  const sections = report.sections.filter((s) => s.required);
  const parsedBlockers = report.blockers.map(parseBlocker);

  const handleNavigateToTab = (tabKey: string) => {
    window.dispatchEvent(new CustomEvent("appraisal-navigate-to-tab", { detail: { tabKey } }));
  };

  return (
    <div className="bg-white border border-[#dde5f5] rounded-[14px] shadow-[0_2px_12px_rgba(15,31,61,0.07)] overflow-hidden mb-2">
      {/* Card header — progress bar row */}
      <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-[#dde5f5] bg-[#f8faff]">
        <div className="flex items-center gap-3 flex-1">
          <span className="font-['Sora'] text-[13px] font-semibold text-[#0f1f3d] min-w-[80px]">
            {pct === 100 ? "Ready to submit" : `${pct}% complete`}
          </span>
          <div className="flex-1 h-[6px] rounded-full bg-[#dde5f5] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: pct === 100 ? "#0d9488" : "#d97706",
              }}
            />
          </div>
        </div>

        <span className="text-[11px] text-[#8a97b8] whitespace-nowrap flex-shrink-0">
          {completedFields} / {totalFields} fields
        </span>

        <div className="w-px h-[14px] bg-[#dde5f5] flex-shrink-0" />

        <button
          type="button"
          onClick={() => setShowDetails((p) => !p)}
          className="text-[11px] font-semibold text-[#3b82f6] hover:text-[#1d4ed8] transition-colors whitespace-nowrap"
        >
          {showDetails ? "Details ↑" : "Details ↓"}
        </button>
      </div>

      {/* Section cards grid + blocker rows */}
      {showDetails && (
        <div className="px-5 pt-4 pb-2">
          <div className="grid grid-cols-3 gap-2 mb-4">
            {sections.map((section) => {
              const isDone = section.completed === section.total;
              return (
                <div
                  key={section.key}
                  className={cn(
                    "flex flex-col gap-1.5 rounded-[10px] px-3.5 py-3 border",
                    isDone
                      ? "border-[#99f6e4] bg-[#f0fdfa]"
                      : "border-[#fcd34d] bg-[#fffbeb]"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "text-[12px] font-semibold leading-tight",
                        isDone ? "text-[#0f766e]" : "text-[#92400e]"
                      )}
                    >
                      {section.label}
                    </span>
                    {isDone ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ccfbf1] border border-[#5eead4] text-[9px] font-semibold text-[#0f766e] flex-shrink-0">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Done
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#fef9c3] border border-[#fde047] text-[9px] font-semibold text-[#854d0e] flex-shrink-0">
                        {section.total - section.completed} left
                      </span>
                    )}
                  </div>

                  <div className="h-[3px] rounded-full bg-[#dde5f5] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${section.total > 0 ? (section.completed / section.total) * 100 : 0}%`,
                        background: isDone ? "#0d9488" : "#d97706",
                      }}
                    />
                  </div>

                  <span
                    className={cn("text-[10px]", isDone ? "text-[#0d9488]" : "text-[#d97706]")}
                  >
                    {section.completed} / {section.total} complete
                  </span>
                </div>
              );
            })}
          </div>

          {/* Blocker rows */}
          {parsedBlockers.length > 0 ? (
            <div className="flex flex-col gap-1.5 pb-4">
              {parsedBlockers.map((blocker) => (
                <button
                  key={blocker.key}
                  type="button"
                  onClick={() => handleNavigateToTab(blocker.tabKey)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[8px] bg-[#fff1f2] border border-[#fecaca] text-left cursor-pointer group hover:bg-[#ffe4e6] transition-colors"
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="2"
                    className="flex-shrink-0"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>

                  <span className="text-[11px] text-[#9f1239] flex-1 leading-snug">
                    {blocker.message}
                  </span>

                  <span className="text-[10px] font-semibold text-[#dc2626] bg-[#fecaca] px-2 py-0.5 rounded-full flex-shrink-0">
                    {blocker.tabLabel}
                  </span>

                  <div className="w-[22px] h-[22px] rounded-[6px] bg-[#fecaca] flex items-center justify-center flex-shrink-0 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#dc2626"
                      strokeWidth="2.5"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] text-[#0f766e] bg-[#f0fdfa] border border-[#99f6e4] px-3 py-2 rounded-[8px] mb-4">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              All required fields complete — ready to submit
            </div>
          )}
        </div>
      )}
    </div>
  );
}
