"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { CycleOption } from "@/lib/appraisals-list-data";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING_APPROVAL", label: "Pending Approval" },
  { value: "SELF_ASSESSMENT", label: "Self Assessment" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "MANAGER_REVIEW", label: "Manager Review" },
  { value: "PENDING_SIGNOFF", label: "Pending Sign-off" },
  { value: "HOD_REVIEW", label: "HOD Review" },
  { value: "HR_REVIEW", label: "HR Review" },
  { value: "COMPLETE", label: "Complete" },
];

const PAGE_SIZES = [25, 50, 100];

interface AppraisalsListControlsProps {
  total: number;
  cycleOptions: CycleOption[];
  initialSearch: string;
  initialStatus: string;
  initialCycleId: string;
  initialPage: number;
  initialPageSize: number;
  /** Base path for filter links (default /appraisals). Use /admin/appraisals for HR view-all. */
  basePath?: string;
}

export function AppraisalsListControls({
  total,
  cycleOptions,
  initialSearch,
  initialStatus,
  initialCycleId,
  initialPage,
  initialPageSize,
  basePath = "/appraisals",
}: AppraisalsListControlsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const buildUrl = useCallback(
    (updates: Record<string, string | number>) => {
      const p = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([k, v]) => {
        const s = String(v);
        if (s === "" || s === "0") p.delete(k);
        else p.set(k, s);
      });
      const q = p.toString();
      return q ? `${basePath}?${q}` : basePath;
    },
    [searchParams, basePath]
  );

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const q = (form.querySelector('input[name="search"]') as HTMLInputElement)
      ?.value?.trim() ?? "";
    router.push(buildUrl({ search: q, page: 1 }));
  };

  const handleFilterChange = (key: string, value: string) => {
    router.push(buildUrl({ [key]: value, page: 1 }));
  };

  const handlePageSizeChange = (value: number) => {
    router.push(buildUrl({ pageSize: value, page: 1 }));
  };

  const totalPages = Math.max(1, Math.ceil(total / initialPageSize));
  const start = (initialPage - 1) * initialPageSize + 1;
  const end = Math.min(initialPage * initialPageSize, total);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <Label htmlFor="search" className="sr-only">
            Search by name or department
          </Label>
          <Input
            id="search"
            name="search"
            type="search"
            placeholder="Search by name or department..."
            defaultValue={initialSearch}
            className="w-56"
          />
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>
        <div className="flex items-center gap-2">
          <Label htmlFor="status-filter" className="text-sm whitespace-nowrap">
            Status
          </Label>
          <select
            id="status-filter"
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm w-40"
            value={initialStatus}
            onChange={(e) => handleFilterChange("status", e.target.value)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="cycle-filter" className="text-sm whitespace-nowrap">
            Cycle
          </Label>
          <select
            id="cycle-filter"
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm w-44"
            value={initialCycleId}
            onChange={(e) => handleFilterChange("cycleId", e.target.value)}
          >
            <option value="">All cycles</option>
            {cycleOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="page-size" className="text-sm whitespace-nowrap">
            Per page
          </Label>
          <select
            id="page-size"
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm w-20"
            value={initialPageSize}
            onChange={(e) =>
              handlePageSizeChange(Number(e.target.value))
            }
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          Showing {total === 0 ? 0 : start}-{end} of {total} appraisals
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={initialPage <= 1}
            onClick={() => router.push(buildUrl({ page: initialPage - 1 }))}
          >
            Previous
          </Button>
          <span className="px-2">
            Page {initialPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={initialPage >= totalPages}
            onClick={() => router.push(buildUrl({ page: initialPage + 1 }))}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
