"use client";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  className?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  className,
  action,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center py-8 px-6 text-center", className)}>
      <div
        className="flex h-[52px] w-[52px] items-center justify-center rounded-full"
        style={{ backgroundColor: "var(--surface-2)" }}
      >
        <span className="text-text-muted">{icon}</span>
      </div>
      <h3 className="mt-4 text-sm font-semibold text-text-primary">{title}</h3>
      <p className="mt-1 max-w-[220px] text-[12.5px] leading-relaxed text-text-muted">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
