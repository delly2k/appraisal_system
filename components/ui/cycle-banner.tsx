"use client";

import { cn } from "@/lib/utils";

interface CycleBannerProps {
  fiscalYear: string;
  dateRange: string;
  isActive?: boolean;
  className?: string;
}

const CalendarIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

export function CycleBanner({
  fiscalYear,
  dateRange,
  isActive = true,
  className,
}: CycleBannerProps) {
  return (
    <div
      className={cn(
        "animate-fade-up-delay-1 relative overflow-hidden rounded-[14px] p-5 md:p-6",
        className
      )}
      style={{
        background: "linear-gradient(135deg, var(--navy) 0%, var(--navy-light) 100%)",
      }}
    >
      {/* Blue glow top-right */}
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)" }}
      />
      {/* Gold glow bottom-right */}
      <div
        className="pointer-events-none absolute -bottom-16 -right-16 h-40 w-40 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
        {/* Left side */}
        <div className="flex items-center gap-4">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl backdrop-blur-sm"
            style={{
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            <span style={{ color: "var(--gold-light)" }}>
              <CalendarIcon />
            </span>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
              Active Cycle
            </p>
            <p
              className="font-display text-[22px] font-bold text-white"
              style={{ letterSpacing: "-0.02em" }}
            >
              {fiscalYear}
            </p>
            <p className="text-[12.5px] text-white/55">{dateRange}</p>
          </div>
        </div>

        {/* Right side - Status pill */}
        {isActive && (
          <div
            className="flex items-center gap-2 rounded-full px-3 py-1.5"
            style={{
              background: "rgba(255,255,255,0.10)",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            <span
              className="h-[7px] w-[7px] animate-pulse-slow rounded-full"
              style={{
                backgroundColor: "#4ade80",
                boxShadow: "0 0 6px rgba(74,222,128,0.8)",
              }}
            />
            <span className="text-xs font-medium text-white">In Progress</span>
          </div>
        )}
      </div>
    </div>
  );
}
