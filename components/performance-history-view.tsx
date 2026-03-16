"use client";

import { useState, Fragment } from "react";
import { ChevronDown, ChevronRight, List, LayoutList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { PerformanceHistoryItem } from "@/lib/history-data";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function truncate(s: string | null, max: number): string {
  if (!s) return "—";
  return s.length <= max ? s : s.slice(0, max) + "…";
}

export function PerformanceHistoryView({
  items,
}: {
  items: PerformanceHistoryItem[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "timeline">("table");

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center py-8">
            No past appraisal cycles yet. Completed appraisals will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const managerComments = (item: PerformanceHistoryItem) => {
    const a = item.manager_recommendation ?? "";
    const b = item.manager_justification ?? "";
    if (a && b) return `${a} ${b}`.trim();
    return a || b || null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {items.length} cycle{items.length !== 1 ? "s" : ""} with completed
          appraisals
        </p>
        <div className="flex rounded-md border border-input overflow-hidden">
          <Button
            variant={viewMode === "table" ? "secondary" : "ghost"}
            size="sm"
            className="rounded-none border-0"
            onClick={() => setViewMode("table")}
          >
            <List className="h-4 w-4 mr-1" />
            Table
          </Button>
          <Button
            variant={viewMode === "timeline" ? "secondary" : "ghost"}
            size="sm"
            className="rounded-none border-0 border-l border-input"
            onClick={() => setViewMode("timeline")}
          >
            <LayoutList className="h-4 w-4 mr-1" />
            Timeline
          </Button>
        </div>
      </div>

      {viewMode === "table" && (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-9" aria-label="Expand" />
                  <TableHead>Cycle</TableHead>
                  <TableHead className="text-right">Total Score</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Manager Comments</TableHead>
                  <TableHead>HR Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const isExpanded = expandedId === item.appraisal_id;
                  const comments = managerComments(item);
                  return (
                    <Fragment key={item.appraisal_id}>
                      <TableRow
                        key={item.appraisal_id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : item.appraisal_id)
                        }
                      >
                        <TableCell className="w-9">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {item.cycle_name}
                          <span className="block text-xs text-muted-foreground font-normal">
                            {item.fiscal_year}
                            {item.cycle_type !== "annual"
                              ? ` • ${item.cycle_type}`
                              : ""}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.total_score != null
                            ? `${item.total_score.toFixed(1)}%`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {item.final_rating ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-[180px] text-muted-foreground">
                          {truncate(comments, 50)}
                        </TableCell>
                        <TableCell className="max-w-[140px] text-muted-foreground">
                          {truncate(item.hr_final_decision, 40)}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${item.appraisal_id}-detail`}>
                          <TableCell
                            colSpan={6}
                            className="bg-muted/30 p-4"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="grid gap-4 sm:grid-cols-2 text-sm">
                              <div>
                                <p className="font-medium text-foreground mb-1">
                                  Manager comments
                                </p>
                                <p className="text-muted-foreground whitespace-pre-wrap">
                                  {comments ?? "—"}
                                </p>
                              </div>
                              <div>
                                <p className="font-medium text-foreground mb-1">
                                  HR decision
                                </p>
                                <p className="text-muted-foreground whitespace-pre-wrap">
                                  {item.hr_final_decision ?? "—"}
                                </p>
                              </div>
                              <div className="sm:col-span-2">
                                <p className="font-medium text-foreground mb-1">
                                  Score breakdown
                                </p>
                                <div className="flex flex-wrap gap-4 text-muted-foreground">
                                  <span>
                                    Competency:{" "}
                                    {item.competency_score != null
                                      ? `${item.competency_score.toFixed(1)}%`
                                      : "—"}
                                  </span>
                                  <span>
                                    Productivity:{" "}
                                    {item.productivity_score != null
                                      ? `${item.productivity_score.toFixed(1)}%`
                                      : "—"}
                                  </span>
                                  <span>
                                    Leadership:{" "}
                                    {item.leadership_score != null
                                      ? `${item.leadership_score.toFixed(1)}%`
                                      : "—"}
                                  </span>
                                  <span>
                                    Workplan:{" "}
                                    {item.workplan_score != null
                                      ? `${item.workplan_score.toFixed(1)}%`
                                      : "—"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {viewMode === "timeline" && (
        <div className="relative space-y-0">
          <div
            className="absolute left-4 top-0 bottom-0 w-px bg-border"
            aria-hidden
          />
          {items.map((item, idx) => {
            const isExpanded = expandedId === item.appraisal_id;
            const comments = managerComments(item);
            return (
              <div
                key={item.appraisal_id}
                className="relative flex gap-4 pb-8 last:pb-0"
              >
                <div
                  className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background text-xs font-medium text-primary"
                  aria-hidden
                >
                  {items.length - idx}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <Card
                    className="cursor-pointer transition-colors hover:bg-muted/30"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : item.appraisal_id)
                    }
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">
                            {item.cycle_name}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {item.fiscal_year}
                            {item.cycle_type !== "annual"
                              ? ` • ${item.cycle_type}`
                              : ""}{" "}
                            • Ended {formatDate(item.end_date)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="tabular-nums font-semibold">
                            {item.total_score != null
                              ? `${item.total_score.toFixed(1)}%`
                              : "—"}
                          </span>
                          {item.final_rating && (
                            <span className="block text-xs text-muted-foreground">
                              {item.final_rating}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    {isExpanded && (
                      <CardContent className="pt-0 space-y-3 text-sm">
                        {comments && (
                          <div>
                            <p className="font-medium text-foreground mb-0.5">
                              Manager comments
                            </p>
                            <p className="text-muted-foreground whitespace-pre-wrap">
                              {comments}
                            </p>
                          </div>
                        )}
                        {item.hr_final_decision && (
                          <div>
                            <p className="font-medium text-foreground mb-0.5">
                              HR decision
                            </p>
                            <p className="text-muted-foreground whitespace-pre-wrap">
                              {item.hr_final_decision}
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-foreground mb-0.5">
                            Score breakdown
                          </p>
                          <p className="text-muted-foreground">
                            Competency:{" "}
                            {item.competency_score != null
                              ? `${item.competency_score.toFixed(1)}%`
                              : "—"}
                            {" · "}
                            Productivity:{" "}
                            {item.productivity_score != null
                              ? `${item.productivity_score.toFixed(1)}%`
                              : "—"}
                            {" · "}
                            Leadership:{" "}
                            {item.leadership_score != null
                              ? `${item.leadership_score.toFixed(1)}%`
                              : "—"}
                            {" · "}
                            Workplan:{" "}
                            {item.workplan_score != null
                              ? `${item.workplan_score.toFixed(1)}%`
                              : "—"}
                          </p>
                        </div>
                      </CardContent>
                    )}
                    {!isExpanded && (comments || item.hr_final_decision) && (
                      <CardContent className="pt-0">
                        <p className="text-muted-foreground text-sm">
                          {truncate(comments || item.hr_final_decision, 80)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Click to expand details
                        </p>
                      </CardContent>
                    )}
                  </Card>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
