"use client";

import React from "react";
import { CheckSquare, User } from "lucide-react";
import { cn } from "@/utils/cn";
import { AppraisalData } from "./AppraisalTabs";
import { GRADE_BANDS, GRADE_STYLES, type SummaryResult } from "@/lib/summary-calc";

export interface SummaryTabContentProps {
  employee: { full_name: string | null; employee_id: string; division_name: string | null } | null;
  cycle: { name: string; fiscal_year: string } | null;
  appraisal: AppraisalData;
  summaryResult: SummaryResult;
  isEmptyScore: boolean;
}

function formatReviewType(reviewType?: string): string {
  if (reviewType === "mid_year") return "Mid Year";
  if (reviewType === "quarterly") return "Quarterly";
  return "Annual";
}

function SummaryRoot({ children }: { children: React.ReactNode }) {
  return React.createElement(
    "div",
    { className: "w-full px-6 py-7 flex flex-col gap-4" },
    children
  );
}

export default function SummaryTabContent({
  employee,
  cycle,
  appraisal,
  summaryResult,
  isEmptyScore,
}: SummaryTabContentProps) {
  return (
    <SummaryRoot>
      {/* Block 1 - Hero Score Card with gradient, overlays, and component strip inside */}
      <div
        className="relative rounded-[14px] overflow-hidden mb-6"
        style={{
          background: "linear-gradient(135deg, #0a1628 0%, #0f1f3d 40%, #1a3260 75%, #1e3a73 100%)",
          boxShadow: "0 8px 32px rgba(15,31,61,0.18), 0 0 1px rgba(15,31,61,0.12)",
          fontFamily: "DM Sans, sans-serif",
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at 75% 50%, rgba(59,130,246,0.18) 0%, transparent 55%)",
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative z-10 p-6 text-white">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-white/70 mb-1">Overall Appraisal Score</div>
              <div className="text-[22px] font-bold mb-1" style={{ fontFamily: "Sora, sans-serif" }}>
                {employee?.full_name ?? "—"}
              </div>
              <div className="text-sm text-white/80 mb-2">
                FY {cycle?.fiscal_year ?? "—"} · {formatReviewType((appraisal as { review_type?: string }).review_type)} · {employee?.division_name ?? "—"}
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs">
                <User className="w-3.5 h-3.5" />
                {summaryResult.isManagementTrack ? "Management Track" : "Non-Management Track"}
              </span>
            </div>
            <div className="flex flex-col items-end">
              {isEmptyScore ? (
                <div className="text-white/70 text-sm py-8">Scores will appear here once ratings are entered</div>
              ) : (
                <>
                  <div className="relative w-[120px] h-[120px]">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="8" />
                      <circle
                        cx="50"
                        cy="50"
                        r="46"
                        fill="none"
                        stroke={GRADE_STYLES[summaryResult.overallGrade].ringStroke}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={289}
                        strokeDashoffset={289 * (1 - summaryResult.totalPoints / 100)}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[28px] font-bold" style={{ fontFamily: "Sora, sans-serif" }}>
                        {summaryResult.totalPoints.toFixed(1)}
                      </span>
                      <span className="text-xs text-white/70">/ 100</span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "mt-2 font-['Sora'] text-[12px] font-bold px-3.5 py-1.5 rounded-full border",
                      summaryResult.overallGrade === "A" && "bg-emerald-50 text-emerald-700 border-emerald-300",
                      summaryResult.overallGrade === "B" && "bg-blue-50 text-blue-700 border-blue-300",
                      summaryResult.overallGrade === "C" && "bg-sky-50 text-sky-700 border-sky-300",
                      summaryResult.overallGrade === "D" && "bg-amber-50 text-amber-700 border-amber-300",
                      summaryResult.overallGrade === "E" && "bg-rose-50 text-rose-700 border-rose-300"
                    )}
                  >
                    {summaryResult.overallGrade} — {summaryResult.gradeBand}
                  </span>
                </>
              )}
            </div>
          </div>
          {/* Component mini-cards strip inside hero */}
          <div
            className="relative z-10 grid gap-2.5 px-8 pt-6 pb-6"
            style={{ gridTemplateColumns: `repeat(${summaryResult.components.length}, 1fr)` }}
          >
            {summaryResult.components.map((comp) => (
              <div
                key={comp.key}
                className="flex items-center gap-3 rounded-[10px] px-4 py-3 transition-colors"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)" }}
              >
                <div
                  className={cn(
                    "w-9 h-9 rounded-[8px] flex items-center justify-center flex-shrink-0 font-['Sora'] text-[18px] font-extrabold",
                    comp.grade === "A" && "bg-emerald-400/20 text-emerald-400",
                    comp.grade === "B" && "bg-blue-400/20 text-blue-400",
                    comp.grade === "C" && "bg-sky-400/20 text-sky-400",
                    comp.grade === "D" && "bg-amber-400/20 text-amber-400",
                    comp.grade === "E" && "bg-red-400/20 text-red-400",
                    !comp.grade && "bg-white/10 text-white/30"
                  )}
                >
                  {comp.grade ?? "—"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-white/90 mb-1 truncate">{comp.name}</div>
                  <div className="h-[3px] rounded-full overflow-hidden mb-1.5" style={{ background: "rgba(255,255,255,0.12)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${comp.actual ?? 0}%`,
                        background:
                          comp.grade && GRADE_STYLES[comp.grade]
                            ? GRADE_STYLES[comp.grade].barColor
                            : "rgba(255,255,255,0.2)",
                      }}
                    />
                  </div>
                  <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {isEmptyScore ? "No scores yet" : `${comp.actual}% actual`} · weight {comp.weight}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-['Sora'] text-[15px] font-bold text-white leading-tight">
                    {isEmptyScore ? "—" : comp.points.toFixed(1)}
                  </div>
                  <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                    / {comp.weight} pts
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Block 2 - Section A Score table card */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-[#dde5f5] bg-[#f8faff]">
          <div className="w-8 h-8 rounded-[8px] bg-[#eef2fb] border border-[#dde5f5] flex items-center justify-center flex-shrink-0">
            <CheckSquare className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <p className="font-['Sora'] text-[13px] font-bold text-[#0f1f3d]">Section A — Overall Performance Score</p>
            <p className="text-[11px] text-[#8a97b8]">
              {summaryResult.isManagementTrack ? "Management" : "Non-Management"} track · Weighted score calculation
            </p>
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs text-slate-500 mb-3">{summaryResult.isManagementTrack ? "Management Track" : "Non-Management Track"}</div>
          <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="p-3 text-left bg-[#f8faff] border-b border-[#dde5f5]">Component</th>
              <th className="p-3 text-center bg-[#f8faff] border-b border-[#dde5f5]">Weight</th>
              <th className="p-3 text-center bg-[#f8faff] border-b border-[#dde5f5] text-[11px] text-emerald-600">A (×1.0)</th>
              <th className="p-3 text-center bg-[#f8faff] border-b border-[#dde5f5] text-[11px] text-blue-600">B (×0.8)</th>
              <th className="p-3 text-center bg-[#f8faff] border-b border-[#dde5f5] text-[11px] text-sky-600">C (×0.6)</th>
              <th className="p-3 text-center bg-[#f8faff] border-b border-[#dde5f5] text-[11px] text-amber-600">D (×0.4)</th>
              <th className="p-3 text-center bg-[#f8faff] border-b border-[#dde5f5] text-[11px] text-red-600">E (×0.2)</th>
              <th className="p-3 text-center bg-[#f8faff] border-b border-[#dde5f5]">Actual %</th>
              <th className="p-3 text-center bg-[#f8faff] border-b border-[#dde5f5]">Points</th>
            </tr>
          </thead>
          <tbody>
            {summaryResult.components.map((c) => (
              <tr key={c.key}>
                <td className="p-3 border-b border-[#dde5f5]">
                  <div className="font-semibold text-[#1e3a5f]">{c.name}</div>
                  <div className="text-xs text-slate-500">{c.sub}</div>
                </td>
                <td className="p-3 text-center border-b border-[#dde5f5]">
                  <span className="rounded-full bg-[#1e3a5f] text-white text-xs px-2 py-0.5">{c.weight}</span>
                </td>
                <td className="p-3 text-center border-b border-[#dde5f5] text-[11px] text-slate-400">{c.gradeThresholds.A.toFixed(1)}</td>
                <td className="p-3 text-center border-b border-[#dde5f5] text-[11px] text-slate-400">{c.gradeThresholds.B.toFixed(1)}</td>
                <td className="p-3 text-center border-b border-[#dde5f5] text-[11px] text-slate-400">{c.gradeThresholds.C.toFixed(1)}</td>
                <td className="p-3 text-center border-b border-[#dde5f5] text-[11px] text-slate-400">{c.gradeThresholds.D.toFixed(1)}</td>
                <td className="p-3 text-center border-b border-[#dde5f5] text-[11px] text-slate-400">{c.gradeThresholds.E.toFixed(1)}</td>
                <td className="p-3 text-center border-b border-[#dde5f5]">
                  {isEmptyScore ? (
                    "—"
                  ) : (
                    <span className={`rounded-full border-[1.5px] px-2 py-0.5 text-xs font-semibold ${GRADE_STYLES[c.grade].bg} ${GRADE_STYLES[c.grade].border} ${GRADE_STYLES[c.grade].text}`} style={{ fontFamily: "Sora, sans-serif" }}>
                      {c.actual}%
                    </span>
                  )}
                </td>
                <td className="p-3 text-center border-b border-[#dde5f5] text-sm font-bold text-[#1e3a5f]">{isEmptyScore ? "—" : c.points.toFixed(1)}</td>
              </tr>
            ))}
            <tr className="bg-[#f8faff] font-semibold border-t-2 border-[#dde5f5]">
              <td className="p-3 border-b border-[#dde5f5]">TOTALS</td>
              <td className="p-3 text-center border-b border-[#dde5f5]">{summaryResult.totalWeight}</td>
              <td colSpan={5} className="p-3 border-b border-[#dde5f5]" />
              <td className="p-3 text-center border-b border-[#dde5f5]">{isEmptyScore ? "—" : `${summaryResult.totalPoints.toFixed(1)}%`}</td>
              <td className="p-3 text-center border-b border-[#dde5f5] text-base">{isEmptyScore ? "—" : summaryResult.totalPoints.toFixed(1)}</td>
            </tr>
          </tbody>
        </table>
        {/* Grade band strip */}
        <div className="flex rounded-lg overflow-hidden border border-[#e2e8f0] mt-4">
          {(["A", "B", "C", "D", "E"] as const).map((letter) => {
            const isActive = summaryResult.overallGrade === letter;
            const band = GRADE_BANDS[letter];
            return (
              <div
                key={letter}
                className={`flex-1 p-3 text-center ${isActive ? "bg-[#0f1f3d] text-white" : "bg-[#f8faff] text-slate-500"}`}
              >
                <div className="text-lg font-bold" style={{ fontFamily: "Sora, sans-serif" }}>{letter}</div>
                <div className="text-xs font-medium">{band.short}</div>
                <div className="text-[10px] opacity-80">{band.range}</div>
              </div>
            );
          })}
        </div>
        {/* Rating definitions */}
        <div className="mt-4 bg-[#f8faff] border border-[#e2e8f0] rounded-lg p-4">
          <div className="text-xs font-semibold text-slate-600 mb-3">Rating definitions</div>
          {(["A", "B", "C", "D", "E"] as const).map((letter) => {
            const band = GRADE_BANDS[letter];
            const style = GRADE_STYLES[letter];
            return (
              <div key={letter} className="flex items-center gap-3 py-1.5 border-b border-slate-200 last:border-0">
                <span className={`font-bold ${style.text}`} style={{ fontFamily: "Sora, sans-serif", width: "20px" }}>{letter}</span>
                <span className="font-semibold text-[#1e3a5f]">{band.label}</span>
                <span className="text-slate-500 text-sm">{band.range}</span>
              </div>
            );
          })}
        </div>
      </div>
      </div>
    </SummaryRoot>
  );
}
