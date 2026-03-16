"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";

interface HRTrendsFiltersProps {
  cycleId: string | null;
  divisionId: string | null;
  departmentId: string | null;
  options: {
    cycles: { id: string; name: string }[];
    divisions: { id: string; name: string }[];
    departments: { id: string; name: string }[];
  };
}

export function HRTrendsFilters({
  cycleId,
  divisionId,
  departmentId,
  options,
}: HRTrendsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    if (value === "") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    router.push(`/hr/trends?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-1">
        <Label htmlFor="trends-cycle" className="text-xs text-muted-foreground">
          Cycle
        </Label>
        <select
          id="trends-cycle"
          className="flex h-9 min-w-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={cycleId ?? ""}
          onChange={(e) => updateFilter("cycle", e.target.value)}
        >
          <option value="">All cycles</option>
          {options.cycles.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="trends-division" className="text-xs text-muted-foreground">
          Division
        </Label>
        <select
          id="trends-division"
          className="flex h-9 min-w-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={divisionId ?? ""}
          onChange={(e) => updateFilter("division", e.target.value)}
        >
          <option value="">All divisions</option>
          {options.divisions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="trends-department" className="text-xs text-muted-foreground">
          Department
        </Label>
        <select
          id="trends-department"
          className="flex h-9 min-w-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={departmentId ?? ""}
          onChange={(e) => updateFilter("department", e.target.value)}
        >
          <option value="">All departments</option>
          {options.departments.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
