"use client";

import { cn } from "@/lib/utils";

interface CycleChipProps {
  year: string;
  className?: string;
}

const CalendarIcon = () => (
  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

export function CycleChip({ year, className }: CycleChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-display text-xs font-semibold",
        className
      )}
      style={{
        background: "linear-gradient(135deg, #eff6ff, #dbeafe)",
        border: "1px solid #bfdbfe",
        color: "#1d4ed8",
      }}
    >
      <CalendarIcon />
      {year}
    </span>
  );
}
