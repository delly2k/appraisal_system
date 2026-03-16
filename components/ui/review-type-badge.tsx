"use client";

import { cn } from "@/lib/utils";

type ReviewType = "mid_year" | "annual" | "quarterly" | "q1" | "q2" | "q3" | "q4";

interface ReviewTypeBadgeProps {
  type: string;
  className?: string;
}

const ClockIcon = () => (
  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const StarIcon = () => (
  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const ChartIcon = () => (
  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const typeConfig: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode; label: string }> = {
  mid_year: {
    bg: "#fef3c7",
    text: "#92400e",
    border: "#fde68a",
    icon: <ClockIcon />,
    label: "Mid Year",
  },
  annual: {
    bg: "#f0fdf4",
    text: "#166534",
    border: "#bbf7d0",
    icon: <StarIcon />,
    label: "Annual",
  },
  quarterly: {
    bg: "#f5f3ff",
    text: "#6d28d9",
    border: "#ddd6fe",
    icon: <ChartIcon />,
    label: "Quarterly",
  },
  q1: {
    bg: "#f5f3ff",
    text: "#6d28d9",
    border: "#ddd6fe",
    icon: <ChartIcon />,
    label: "Q1",
  },
  q2: {
    bg: "#f5f3ff",
    text: "#6d28d9",
    border: "#ddd6fe",
    icon: <ChartIcon />,
    label: "Q2",
  },
  q3: {
    bg: "#f5f3ff",
    text: "#6d28d9",
    border: "#ddd6fe",
    icon: <ChartIcon />,
    label: "Q3",
  },
  q4: {
    bg: "#f5f3ff",
    text: "#6d28d9",
    border: "#ddd6fe",
    icon: <ChartIcon />,
    label: "Q4",
  },
};

export function ReviewTypeBadge({ type, className }: ReviewTypeBadgeProps) {
  const normalizedType = type.toLowerCase().replace(/\s+/g, "_");
  const config = typeConfig[normalizedType] ?? {
    bg: "#f1f5f9",
    text: "#64748b",
    border: "#e2e8f0",
    icon: <ClockIcon />,
    label: type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold",
        className
      )}
      style={{
        backgroundColor: config.bg,
        color: config.text,
        border: `1px solid ${config.border}`,
      }}
    >
      {config.icon}
      {config.label}
    </span>
  );
}
