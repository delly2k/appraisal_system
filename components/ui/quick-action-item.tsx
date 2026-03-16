"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type ColorVariant = "blue" | "teal" | "violet" | "gold";

interface QuickActionItemProps {
  href: string;
  icon: React.ReactNode;
  name: string;
  description: string;
  variant?: ColorVariant;
  className?: string;
}

const variantStyles: Record<ColorVariant, { bg: string; color: string }> = {
  blue: { bg: "#eff6ff", color: "var(--accent)" },
  teal: { bg: "#f0fdfa", color: "var(--teal)" },
  violet: { bg: "#f3e8ff", color: "#9333ea" },
  gold: { bg: "#fffbeb", color: "#d97706" },
};

const ChevronRightIcon = () => (
  <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

export function QuickActionItem({
  href,
  icon,
  name,
  description,
  variant = "blue",
  className,
}: QuickActionItemProps) {
  const styles = variantStyles[variant];

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center justify-between px-6 py-3.5 transition-colors hover:bg-surface",
        className
      )}
      style={{ borderBottom: "1px solid var(--border-color)" }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]"
          style={{ backgroundColor: styles.bg }}
        >
          <span style={{ color: styles.color }}>{icon}</span>
        </div>
        <div>
          <p className="text-[13.5px] font-medium text-text-primary">{name}</p>
          <p className="text-[11.5px] text-text-muted">{description}</p>
        </div>
      </div>
      <div
        className="flex h-7 w-7 items-center justify-center rounded-md text-text-secondary transition-all group-hover:bg-accent group-hover:text-white"
        style={{
          backgroundColor: "var(--surface-2)",
          border: "1px solid var(--border-color)",
        }}
      >
        <ChevronRightIcon />
      </div>
    </Link>
  );
}
