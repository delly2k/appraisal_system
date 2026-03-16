"use client";

import { Filter, LayoutGrid, Plus, RefreshCw, ChevronDown } from "lucide-react";

export function DashboardToolbar() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ms-border bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="flex h-8 items-center gap-1.5 rounded border border-ms-border bg-white px-3 text-[14px] text-ms-text hover:bg-ms-hover"
        >
          <Filter className="h-4 w-4 text-ms-muted" />
          Show Visual Filter
        </button>
        <button
          type="button"
          className="flex h-8 items-center gap-1.5 rounded border border-ms-border bg-white px-3 text-[14px] text-ms-text hover:bg-ms-hover"
        >
          <Filter className="h-4 w-4 text-ms-muted" />
          Show Global Filter
        </button>
        <button
          type="button"
          className="flex h-8 items-center gap-1.5 rounded border border-ms-border bg-white px-3 text-[14px] text-ms-text hover:bg-ms-hover"
        >
          <LayoutGrid className="h-4 w-4 text-ms-muted" />
          Switch to Tile View
        </button>
        <div className="relative">
          <button
            type="button"
            className="flex h-8 items-center gap-1.5 rounded border border-ms-purple bg-[#742774] px-3 text-[14px] font-medium text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            New
            <ChevronDown className="h-4 w-4 ml-0.5" />
          </button>
        </div>
        <button
          type="button"
          className="flex h-8 items-center gap-1.5 rounded border border-ms-border bg-white px-3 text-[14px] text-ms-text hover:bg-ms-hover"
        >
          Set As Default
        </button>
        <button
          type="button"
          className="flex h-8 items-center gap-1.5 rounded border border-ms-border bg-white px-3 text-[14px] text-ms-text hover:bg-ms-hover"
        >
          <RefreshCw className="h-4 w-4 text-ms-muted" />
          Refresh All
        </button>
      </div>
      <div className="flex items-center gap-1 text-[12px] text-ms-muted">
        <span>This Quarter</span>
        <span>1/1/2026 To 3/31/2026</span>
        <button
          type="button"
          className="p-1 rounded hover:bg-ms-hover"
          aria-label="Change date range"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
