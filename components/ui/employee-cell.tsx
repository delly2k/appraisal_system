"use client";

import { cn } from "@/lib/utils";

interface EmployeeCellProps {
  name: string;
  email?: string;
  className?: string;
}

const gradients = [
  "linear-gradient(135deg, #3b82f6, #1d4ed8)",
  "linear-gradient(135deg, #0d9488, #0f766e)",
  "linear-gradient(135deg, #7c3aed, #6d28d9)",
  "linear-gradient(135deg, #e11d48, #be123c)",
  "linear-gradient(135deg, #f59e0b, #d97706)",
];

function getGradient(name: string): string {
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return gradients[hash % gradients.length];
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function EmployeeCell({ name, email, className }: EmployeeCellProps) {
  const initials = getInitials(name);
  const gradient = getGradient(name);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full font-display text-xs font-semibold text-white"
        style={{ background: gradient }}
      >
        {initials}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13.5px] font-medium text-text-primary">
          {name}
        </p>
        {email && (
          <p className="truncate text-[11.5px] text-text-muted">{email}</p>
        )}
      </div>
    </div>
  );
}
