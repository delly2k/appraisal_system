"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  EmployeeScoreTrendPoint,
  DivisionTrendPoint,
  PromotionReadinessItem,
  PromotionReadyEmployee,
} from "@/lib/hr-trends-data";

const DIVISION_COLORS = [
  "hsl(var(--chart-1, 220 70% 50%))",
  "hsl(var(--chart-2, 160 60% 45%))",
  "hsl(var(--chart-3, 30 80% 55%))",
  "hsl(var(--chart-4, 280 65% 60%))",
  "hsl(var(--chart-5, 190 75% 45%))",
];

interface HRTrendsChartsProps {
  employeeScoreTrend: EmployeeScoreTrendPoint[];
  divisionPerformanceTrend: DivisionTrendPoint[];
  promotionReadinessCounts: PromotionReadinessItem[];
  promotionReadyEmployees: PromotionReadyEmployee[];
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
    });
  } catch {
    return dateStr;
  }
}

export function HRTrendsCharts({
  employeeScoreTrend,
  divisionPerformanceTrend,
  promotionReadinessCounts,
  promotionReadyEmployees,
}: HRTrendsChartsProps) {
  const divisionNames = [
    ...new Set(divisionPerformanceTrend.map((d) => d.divisionName)),
  ].slice(0, 8);
  const divisionSeries = divisionNames.map((name, i) => ({
    name,
    color: DIVISION_COLORS[i % DIVISION_COLORS.length],
  }));

  const divisionPivot = employeeScoreTrend.map((c) => {
    const point: Record<string, string | number> = {
      cycleName: c.cycleName,
      endDate: c.endDate,
      avgScore: c.avgScore,
    };
    for (const div of divisionNames) {
      const p = divisionPerformanceTrend.find(
        (d) => d.cycleName === c.cycleName && d.divisionName === div
      );
      point[div] = p?.avgScore ?? "";
    }
    return point;
  });

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Employee score trend</CardTitle>
          <p className="text-sm text-muted-foreground">
            Average total score by cycle (filtered population)
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] w-full">
            {employeeScoreTrend.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No trend data for the selected filters.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={employeeScoreTrend}
                  margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="cycleName"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(_, i) =>
                      employeeScoreTrend[i]?.endDate
                        ? formatDate(employeeScoreTrend[i].endDate)
                        : _
                    }
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number | undefined) => [value ?? 0, "Avg score"]}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.cycleName ?? ""
                    }
                  />
                  <ReferenceLine y={70} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                  <Line
                    type="monotone"
                    dataKey="avgScore"
                    name="Avg score"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Division performance trend</CardTitle>
          <p className="text-sm text-muted-foreground">
            Average score by division over cycles (one line per division)
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] w-full">
            {divisionPivot.length === 0 || divisionSeries.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No division trend data for the selected filters.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={divisionPivot}
                  margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="cycleName"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(_, i) =>
                      divisionPivot[i]?.endDate
                        ? formatDate(String(divisionPivot[i].endDate))
                        : _
                    }
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.cycleName ?? ""
                    }
                  />
                  <Legend />
                  <ReferenceLine y={70} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                  {divisionSeries.map((s) => (
                    <Line
                      key={s.name}
                      type="monotone"
                      dataKey={s.name}
                      name={s.name}
                      stroke={s.color}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Promotion readiness (counts)</CardTitle>
          <p className="text-sm text-muted-foreground">
            HR recommendations by type
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] w-full">
            {promotionReadinessCounts.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No recommendation data.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={promotionReadinessCounts}
                  layout="vertical"
                  margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="recommendation"
                    width={140}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number | undefined) => [value ?? 0, "Count"]}
                  />
                  <Bar
                    dataKey="count"
                    name="Count"
                    fill="hsl(var(--primary))"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Promotion-ready employees</CardTitle>
          <p className="text-sm text-muted-foreground">
            Appraisals with promotion-related recommendation
          </p>
        </CardHeader>
        <CardContent>
          <div className="max-h-[280px] overflow-y-auto">
            {promotionReadyEmployees.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                None for the selected filters.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {promotionReadyEmployees.slice(0, 15).map((e) => (
                  <li
                    key={`${e.employeeId}-${e.cycleName}`}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded border border-border/60 px-3 py-2"
                  >
                    <span className="font-medium">{e.employeeName}</span>
                    <span className="text-muted-foreground text-xs">
                      {e.divisionName ?? "—"} · {e.cycleName}
                    </span>
                    <span className="text-muted-foreground">
                      {e.recommendation}
                      {e.totalScore != null ? ` · ${e.totalScore.toFixed(0)}%` : ""}
                    </span>
                  </li>
                ))}
                {promotionReadyEmployees.length > 15 && (
                  <li className="text-xs text-muted-foreground py-1">
                    +{promotionReadyEmployees.length - 15} more
                  </li>
                )}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
