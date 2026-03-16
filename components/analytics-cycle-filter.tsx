"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";

interface AnalyticsCycleFilterProps {
  cycleId: string | null;
  options: Array<{ id: string; name: string }>;
}

export function AnalyticsCycleFilter({ cycleId, options }: AnalyticsCycleFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onCycleChange(value: string) {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    if (value === "") {
      next.delete("cycle");
    } else {
      next.set("cycle", value);
    }
    router.push(`/hr/analytics?${next.toString()}`);
  }

  return (
    <div className="flex items-end gap-2">
      <div className="space-y-1">
        <Label htmlFor="analytics-cycle" className="text-xs text-muted-foreground">
          Cycle
        </Label>
        <select
          id="analytics-cycle"
          className="flex h-9 min-w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={cycleId ?? ""}
          onChange={(e) => onCycleChange(e.target.value)}
        >
          <option value="">All cycles</option>
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
