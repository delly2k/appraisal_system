"use client";

import { cn } from "@/lib/utils";

type ColorVariant = "blue" | "violet" | "teal" | "gold";

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  count?: number;
  variant?: ColorVariant;
  className?: string;
  action?: React.ReactNode;
}

const variantStyles: Record<ColorVariant, { gradient: string; dotColor: string }> = {
  blue: {
    gradient: "linear-gradient(135deg, #eff6ff, #dbeafe)",
    dotColor: "#3b82f6",
  },
  violet: {
    gradient: "linear-gradient(135deg, #f3e8ff, #e9d5ff)",
    dotColor: "#7c3aed",
  },
  teal: {
    gradient: "linear-gradient(135deg, #f0fdfa, #ccfbf1)",
    dotColor: "#0d9488",
  },
  gold: {
    gradient: "linear-gradient(135deg, #fffbeb, #fef3c7)",
    dotColor: "#f59e0b",
  },
};

export function SectionHeader({
  icon,
  title,
  subtitle,
  count,
  variant = "blue",
  className,
  action,
}: SectionHeaderProps) {
  const styles = variantStyles[variant];

  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex items-start gap-3">
        <div
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px]"
          style={{ background: styles.gradient }}
        >
          <span className="text-text-primary">{icon}</span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-semibold text-text-primary">
              {title}
            </h2>
            {count !== undefined && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                style={{
                  backgroundColor: "var(--surface-2)",
                  border: "1px solid var(--border-color)",
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: styles.dotColor }}
                />
                {count}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-0.5 text-sm text-text-muted">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
