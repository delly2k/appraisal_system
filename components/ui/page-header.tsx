"use client";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  className?: string;
  action?: React.ReactNode;
}

export function PageHeader({ icon, title, subtitle, className, action }: PageHeaderProps) {
  return (
    <div className={cn("animate-fade-up flex items-start justify-between gap-4", className)}>
      <div className="flex items-start gap-4">
        <div
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl"
          style={{
            background: "linear-gradient(135deg, #eff6ff, #dbeafe)",
          }}
        >
          <span className="text-accent">{icon}</span>
        </div>
        <div className="pt-0.5">
          <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary" style={{ letterSpacing: "-0.02em" }}>
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 text-[13.5px] text-text-muted">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
