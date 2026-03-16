"use client";

import { cn } from "@/lib/utils";

type ColorVariant = "blue" | "gold" | "teal" | "rose";

interface StatCardProps {
  label: string;
  value: string | number;
  meta?: string;
  icon: React.ReactNode;
  variant?: ColorVariant;
  className?: string;
}

const variantStyles: Record<ColorVariant, { gradient: string; iconBg: string; iconColor: string }> = {
  blue: {
    gradient: "linear-gradient(90deg, #3b82f6, #60a5fa)",
    iconBg: "#eff6ff",
    iconColor: "var(--accent)",
  },
  gold: {
    gradient: "linear-gradient(90deg, #f59e0b, #fcd34d)",
    iconBg: "#fffbeb",
    iconColor: "var(--gold)",
  },
  teal: {
    gradient: "linear-gradient(90deg, #0d9488, #2dd4bf)",
    iconBg: "#f0fdfa",
    iconColor: "var(--teal)",
  },
  rose: {
    gradient: "linear-gradient(90deg, #e11d48, #fb7185)",
    iconBg: "#fff1f2",
    iconColor: "var(--rose)",
  },
};

export function StatCard({
  label,
  value,
  meta,
  icon,
  variant = "blue",
  className,
}: StatCardProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[14px] bg-white p-5 transition-all duration-200 hover:-translate-y-0.5",
        className
      )}
      style={{
        boxShadow: "var(--shadow-card)",
        border: "1px solid var(--border-color)",
      }}
    >
      {/* Top accent bar (visible on hover) */}
      <div
        className="absolute inset-x-0 top-0 h-[3px] opacity-0 transition-opacity group-hover:opacity-100"
        style={{ background: styles.gradient }}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted">
          {label}
        </span>
        <div
          className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px]"
          style={{ backgroundColor: styles.iconBg }}
        >
          <span style={{ color: styles.iconColor }}>{icon}</span>
        </div>
      </div>

      {/* Value */}
      <div className="mt-3">
        <span
          className="font-display text-[28px] font-bold text-text-primary"
          style={{ letterSpacing: "-0.03em" }}
        >
          {value}
        </span>
      </div>

      {/* Meta */}
      {meta && (
        <p className="mt-1 text-xs text-text-muted">{meta}</p>
      )}
    </div>
  );
}
