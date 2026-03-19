"use client";

import { ReportingPerson } from "@/lib/reporting-structure";

interface CycleAppraisal {
  review_type: string;
  status: string;
  cycle_name: string;
}

interface ReportsToCardProps {
  manager: ReportingPerson | null;
  cycleAppraisals: CycleAppraisal[];
  activeCycleName: string | null;
}

const UserIcon = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

function getInitials(fullname: string | null): string {
  if (!fullname) return "??";
  return fullname
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ReportsToCard({
  manager,
  cycleAppraisals,
  activeCycleName,
}: ReportsToCardProps) {
  const annualAppraisal = cycleAppraisals.find(
    (a) => a.review_type?.toLowerCase() === "annual"
  );
  const midYearAppraisal: CycleAppraisal | null = cycleAppraisals.find(
    (a) => a.review_type?.toLowerCase() === "mid_year"
  ) ?? null;

  return (
    <div
      className="overflow-hidden rounded-[14px] bg-white"
      style={{
        boxShadow: "var(--shadow-card)",
        border: "1px solid var(--border-color)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-[22px] py-4"
        style={{ borderBottom: "1px solid var(--border-color)" }}
      >
        <div
          className="flex h-8 w-8 items-center justify-center rounded-[9px]"
          style={{ backgroundColor: "#fffbeb" }}
        >
          <span style={{ color: "#d97706" }}>
            <UserIcon />
          </span>
        </div>
        <h2 className="font-display text-[15px] font-semibold text-text-primary">
          Who You Report To
        </h2>
      </div>

      {/* Manager block */}
      <div
        className="relative mx-[22px] mt-4 overflow-hidden rounded-xl px-4 py-4"
        style={{
          background: "linear-gradient(135deg, var(--navy) 0%, var(--navy-light) 100%)",
        }}
      >
        {/* Blue glow */}
        <div
          className="pointer-events-none absolute -top-4 -right-4 h-20 w-20 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(59,130,246,0.4) 0%, transparent 70%)",
          }}
        />

        {manager ? (
          <div className="relative z-10 flex items-center gap-3">
            {/* Avatar */}
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-display text-[15px] font-bold text-white"
              style={{
                background: "linear-gradient(135deg, #0d9488, #0f766e)",
                border: "2px solid rgba(255,255,255,0.2)",
              }}
            >
              {getInitials(manager.full_name)}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                Line Manager
              </p>
              <p className="font-display text-[15px] font-semibold text-white truncate">
                {manager.full_name || "Unknown"}
              </p>
              {manager.email && (
                <p className="text-[11.5px] text-white/50 truncate">{manager.email}</p>
              )}
            </div>

            {/* View button */}
            <button
              className="shrink-0 rounded-[7px] px-3.5 py-1.5 text-xs font-medium text-white transition-colors"
              style={{
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.12)";
              }}
            >
              View
            </button>
          </div>
        ) : (
          <div className="relative z-10 py-3 text-center">
            <p className="text-sm text-white/50">No manager assigned</p>
          </div>
        )}
      </div>

      {/* Active Cycle Snapshot */}
      <div className="px-[22px] py-4">
        {/* Section divider */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Active Cycle Snapshot
          </span>
          <div className="flex-1 h-px" style={{ backgroundColor: "var(--border-color)" }} />
        </div>

        {/* Mini stat tiles */}
        <div className="grid grid-cols-2 gap-3">
          {/* Mid-Year tile */}
          <div
            className="rounded-[10px] p-3"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-color)",
            }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Mid-Year
            </p>
            <p className="font-display text-lg font-bold text-text-primary mt-1">
              {midYearAppraisal ? formatStatus(midYearAppraisal.status) : "—"}
            </p>
            <p className="text-[11px] text-text-muted mt-0.5">
              {activeCycleName || "No active cycle"}
            </p>
          </div>

          {/* Annual tile */}
          <div
            className="rounded-[10px] p-3"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border-color)",
            }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Annual
            </p>
            <p className="font-display text-lg font-bold text-text-primary mt-1">
              {annualAppraisal ? formatStatus(annualAppraisal.status) : "—"}
            </p>
            <p className="text-[11px] text-text-muted mt-0.5">
              {activeCycleName || "No active cycle"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
