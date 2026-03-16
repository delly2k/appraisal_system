"use client";

import { cn } from "@/lib/utils";

type Status = 
  | "draft" 
  | "pending" 
  | "self_submitted" 
  | "manager_in_review" 
  | "manager_completed" 
  | "employee_acknowledged" 
  | "hr_in_review" 
  | "complete" 
  | "closed"
  | "open";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig: Record<string, { bg: string; text: string; border: string; dot: string; label: string }> = {
  DRAFT: { bg: "#f1f5f9", text: "#64748b", border: "#e2e8f0", dot: "#94a3b8", label: "Draft" },
  PENDING_APPROVAL: { bg: "#fffbeb", text: "#92400e", border: "#fde68a", dot: "#f59e0b", label: "Pending Approval" },
  SELF_ASSESSMENT: { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe", dot: "#3b82f6", label: "Self Assessment" },
  SUBMITTED: { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0", dot: "#22c55e", label: "Submitted" },
  MANAGER_REVIEW: { bg: "#f3e8ff", text: "#6d28d9", border: "#ddd6fe", dot: "#7c3aed", label: "Manager Review" },
  PENDING_SIGNOFF: { bg: "#fffbeb", text: "#92400e", border: "#fde68a", dot: "#f59e0b", label: "Pending Sign-off" },
  HOD_REVIEW: { bg: "#fdf2f8", text: "#9d174d", border: "#fbcfe8", dot: "#ec4899", label: "HOD Review" },
  HR_REVIEW: { bg: "#f0fdfa", text: "#0f766e", border: "#99f6e4", dot: "#0d9488", label: "HR Review" },
  COMPLETE: { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0", dot: "#22c55e", label: "Complete" },
  draft: {
    bg: "#f1f5f9",
    text: "#64748b",
    border: "#e2e8f0",
    dot: "#94a3b8",
    label: "Draft",
  },
  pending: {
    bg: "#fffbeb",
    text: "#92400e",
    border: "#fde68a",
    dot: "#f59e0b",
    label: "Pending",
  },
  self_submitted: {
    bg: "#fffbeb",
    text: "#92400e",
    border: "#fde68a",
    dot: "#f59e0b",
    label: "Self Submitted",
  },
  manager_in_review: {
    bg: "#eff6ff",
    text: "#1d4ed8",
    border: "#bfdbfe",
    dot: "#3b82f6",
    label: "In Review",
  },
  manager_completed: {
    bg: "#f0fdf4",
    text: "#166534",
    border: "#bbf7d0",
    dot: "#22c55e",
    label: "Manager Completed",
  },
  employee_acknowledged: {
    bg: "#f0fdf4",
    text: "#166534",
    border: "#bbf7d0",
    dot: "#22c55e",
    label: "Acknowledged",
  },
  hr_in_review: {
    bg: "#f5f3ff",
    text: "#6d28d9",
    border: "#ddd6fe",
    dot: "#7c3aed",
    label: "HR Review",
  },
  complete: {
    bg: "#f0fdf4",
    text: "#166534",
    border: "#bbf7d0",
    dot: "#22c55e",
    label: "Complete",
  },
  closed: {
    bg: "#f1f5f9",
    text: "#64748b",
    border: "#e2e8f0",
    dot: "#94a3b8",
    label: "Closed",
  },
  open: {
    bg: "#f0fdf4",
    text: "#166534",
    border: "#bbf7d0",
    dot: "#22c55e",
    label: "Open",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? {
    bg: "#f1f5f9",
    text: "#64748b",
    border: "#e2e8f0",
    dot: "#94a3b8",
    label: status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold",
        className
      )}
      style={{
        backgroundColor: config.bg,
        color: config.text,
        border: `1px solid ${config.border}`,
      }}
    >
      <span
        className="h-[5px] w-[5px] rounded-full"
        style={{ backgroundColor: config.dot }}
      />
      {config.label}
    </span>
  );
}
