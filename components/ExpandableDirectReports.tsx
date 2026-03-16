"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import type { ReportingPerson } from "@/lib/reporting-structure";

interface ExpandableDirectReportsProps {
  directReports: ReportingPerson[];
}

function ReportCard({ p, isNested }: { p: ReportingPerson; isNested?: boolean }) {
  return (
    <li
      className={`flex flex-col rounded-md border bg-muted/30 p-2 text-sm ${isNested ? "ml-4 mt-2 border-l-2 border-muted-foreground/20" : ""}`}
    >
      <span className="font-medium">{p.full_name ?? p.employee_id}</span>
      {p.job_title && (
        <span className="text-muted-foreground">{p.job_title}</span>
      )}
      {p.email && (
        <span className="text-muted-foreground text-xs">{p.email}</span>
      )}
    </li>
  );
}

export function ExpandableDirectReports({ directReports }: ExpandableDirectReportsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [nestedCache, setNestedCache] = useState<Record<string, ReportingPerson[]>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function toggleExpand(employeeId: string) {
    if (expandedId === employeeId) {
      setExpandedId(null);
      return;
    }
    if (nestedCache[employeeId] !== undefined) {
      setExpandedId(employeeId);
      return;
    }
    setLoadingId(employeeId);
    try {
      const res = await fetch(`/api/reporting/direct-reports?employeeId=${encodeURIComponent(employeeId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to load");
      setNestedCache((prev) => ({ ...prev, [employeeId]: Array.isArray(data) ? data : [] }));
      setExpandedId(employeeId);
    } catch {
      setNestedCache((prev) => ({ ...prev, [employeeId]: [] }));
      setExpandedId(employeeId);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <ul className="space-y-4">
      {directReports.map((p) => {
        const isExpanded = expandedId === p.employee_id;
        const isLoading = loadingId === p.employee_id;
        const nested = nestedCache[p.employee_id];
        return (
          <li
            key={p.employee_id}
            className="flex flex-col rounded-md border bg-muted/30 p-2 text-sm"
          >
            <div className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => toggleExpand(p.employee_id)}
                className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-expanded={isExpanded}
                aria-label={isExpanded ? "Collapse" : "Expand to see who reports to this person"}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : isExpanded ? (
                  <ChevronDown className="h-4 w-4" aria-hidden />
                ) : (
                  <ChevronRight className="h-4 w-4" aria-hidden />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <span className="font-medium">{p.full_name ?? p.employee_id}</span>
                {p.job_title && (
                  <span className="block text-muted-foreground">{p.job_title}</span>
                )}
                {p.email && (
                  <span className="block text-muted-foreground text-xs">{p.email}</span>
                )}
              </div>
            </div>
            {isExpanded && (
              <div className="mt-2">
                {nested === undefined ? null : nested.length === 0 ? (
                  <p className="ml-6 text-xs text-muted-foreground">No direct reports.</p>
                ) : (
                  <ul className="space-y-3">
                    {nested.map((sub) => (
                      <ReportCard key={sub.employee_id} p={sub} isNested />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
