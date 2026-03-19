"use client";

import type { ObjectiveStatus } from "@/types/checkins";

const PILLS: { value: ObjectiveStatus; label: string; bg: string; border: string; text: string }[] = [
  { value: "ON_TRACK", label: "On track", bg: "#ecfdf5", border: "#6ee7b7", text: "#065f46" },
  { value: "AT_RISK", label: "At risk", bg: "#fffbeb", border: "#fcd34d", text: "#92400e" },
  { value: "BEHIND", label: "Behind", bg: "#fff1f2", border: "#fecaca", text: "#dc2626" },
];

interface StatusPillsProps {
  value: ObjectiveStatus | null;
  onChange: (s: ObjectiveStatus) => void;
  disabled?: boolean;
}

export function StatusPills({ value, onChange, disabled }: StatusPillsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {PILLS.map((p) => {
        const selected = value === p.value;
        return (
          <button
            key={p.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(p.value)}
            className="inline-flex items-center px-3 py-1.5 rounded-[8px] border text-[11px] font-semibold transition-colors"
            style={{
              background: selected ? p.bg : "#f8faff",
              borderColor: selected ? p.border : "#dde5f5",
              color: selected ? p.text : "#8a97b8",
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.7 : 1,
            }}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
