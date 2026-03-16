"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Building2, Layers, Target, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface CycleDetail {
  id: string;
  label: string;
  cycle_year: string;
  is_active: boolean;
  corporate_count: number;
  divisional_count: number;
  created_at: string;
  uploaded_by_name: string;
}

interface ObjectiveRow {
  id: string;
  type: "CORPORATE" | "DIVISIONAL";
  external_id: string;
  title: string;
  division?: string;
  weight?: number;
  created_at: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-JM", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function OperationalPlanCycleDetailPage({
  params,
}: {
  params: Promise<{ cycleId: string }>;
}) {
  const router = useRouter();
  const [cycleId, setCycleId] = useState<string | null>(null);
  const [cycle, setCycle] = useState<CycleDetail | null>(null);
  const [objectives, setObjectives] = useState<ObjectiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"All" | "Corporate" | "Divisional">("All");

  useEffect(() => {
    params.then((p) => setCycleId(p.cycleId));
  }, [params]);

  const load = useCallback(async () => {
    if (!cycleId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/operational-plan/${cycleId}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed to load cycle");
      }
      const data = await res.json();
      setCycle(data.cycle);
      setObjectives(data.objectives ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setCycle(null);
      setObjectives([]);
    } finally {
      setLoading(false);
    }
  }, [cycleId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSetActive = async () => {
    if (!cycleId) return;
    const res = await fetch(`/api/operational-plan/cycles/${cycleId}/active`, { method: "PATCH" });
    if (res.ok) await load();
  };

  const filtered = useMemo(() => {
    return objectives.filter((obj) => {
      const matchSearch =
        !search ||
        obj.title.toLowerCase().includes(search.toLowerCase()) ||
        obj.external_id.toLowerCase().includes(search.toLowerCase()) ||
        obj.division?.toLowerCase().includes(search.toLowerCase());
      const matchType =
        filter === "All" ||
        (filter === "Corporate" && obj.type === "CORPORATE") ||
        (filter === "Divisional" && obj.type === "DIVISIONAL");
      return matchSearch && matchType;
    });
  }, [objectives, search, filter]);

  if (loading && !cycle) {
    return (
      <div className="w-full px-[28px] py-6">
        <p className="text-[13px] text-[#8a97b8]">Loading…</p>
      </div>
    );
  }

  if (error || !cycle) {
    return (
      <div className="w-full px-[28px] py-6">
        <p className="text-[13px] text-red-600">{error ?? "Cycle not found"}</p>
        <Link
          href="/hr/operational-plan"
          className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#8a97b8] transition-colors hover:text-[#0f1f3d]"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Operational Plan
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full px-[28px] py-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Link
            href="/admin/operational-plan"
            className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#8a97b8] transition-colors hover:text-[#0f1f3d]"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back to Operational Plan
          </Link>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[.1em] text-[#8a97b8]">
            HR Administration · Operational Plan
          </p>
          <h1 className="font-['Sora'] text-[20px] font-extrabold text-[#0f1f3d]">{cycle.label}</h1>
          <p className="mt-1 text-[13px] text-[#8a97b8]">
            {cycle.cycle_year} · Uploaded {formatDate(cycle.created_at)} by {cycle.uploaded_by_name}
          </p>
        </div>
        {cycle.is_active ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#6ee7b7] bg-[#ecfdf5] px-3 py-1.5 text-[11px] font-bold text-[#065f46]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#059669] animate-pulse" />
            Active Cycle
          </span>
        ) : (
          <button
            type="button"
            onClick={handleSetActive}
            className="inline-flex items-center gap-2 rounded-[8px] border-[1.5px] border-[#dde5f5] bg-white px-4 py-2 text-[12px] font-semibold text-[#4a5a82] transition-all hover:border-[#0f1f3d] hover:text-[#0f1f3d]"
          >
            Set as active cycle
          </button>
        )}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4">
        {[
          {
            label: "Corporate Objectives",
            value: cycle.corporate_count,
            color: "#3b82f6",
            bg: "#eff6ff",
            border: "#bfdbfe",
            icon: <Building2 className="h-4 w-4" style={{ color: "#3b82f6" }} />,
          },
          {
            label: "Divisional Objectives",
            value: cycle.divisional_count,
            color: "#0d9488",
            bg: "#f0fdfa",
            border: "#99f6e4",
            icon: <Layers className="h-4 w-4" style={{ color: "#0d9488" }} />,
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="flex items-center gap-4 rounded-[14px] border border-[#dde5f5] bg-white p-5 shadow-[0_2px_12px_rgba(15,31,61,0.07)]"
          >
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px]"
              style={{ background: kpi.bg, border: `1px solid ${kpi.border}` }}
            >
              {kpi.icon}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.07em] text-[#8a97b8]">
                {kpi.label}
              </p>
              <p className="font-['Sora'] text-[26px] font-extrabold" style={{ color: kpi.color }}>
                {kpi.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-[14px] border border-[#dde5f5] bg-white shadow-[0_2px_12px_rgba(15,31,61,0.07)]">
        <div className="flex flex-wrap items-center gap-3 border-b border-[#dde5f5] bg-[#f8faff] px-5 py-4">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] border border-[#bfdbfe] bg-[#eff6ff]">
            <Target className="h-4 w-4 text-[#3b82f6]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-['Sora'] text-[13px] font-bold text-[#0f1f3d]">Objectives</p>
            <p className="text-[11px] text-[#8a97b8]">All objectives imported from this plan</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a97b8]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search objectives..."
              className="w-[220px] rounded-[8px] border-[1.5px] border-[#dde5f5] bg-white py-2 pl-8 pr-3 text-[12px] text-[#0f1f3d] outline-none transition-colors focus:border-[#3b82f6]"
            />
          </div>
          <div className="flex gap-1.5">
            {(["All", "Corporate", "Divisional"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-full border-[1.5px] px-3 py-1.5 text-[11px] font-semibold transition-all",
                  filter === f
                    ? "border-[#0f1f3d] bg-[#0f1f3d] text-white"
                    : "border-[#dde5f5] bg-white text-[#8a97b8] hover:border-[#0f1f3d] hover:text-[#0f1f3d]"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#eef2fb]">
              <th className="w-[10%] px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-[.07em] text-[#8a97b8]">
                Type
              </th>
              <th className="px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-[.07em] text-[#8a97b8]">
                Objective
              </th>
              <th className="w-[20%] px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-[.07em] text-[#8a97b8]">
                Division
              </th>
              <th className="w-[12%] px-5 py-2.5 text-left text-[10px] font-bold uppercase tracking-[.07em] text-[#8a97b8]">
                External ID
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((obj) => (
              <tr
                key={obj.id}
                className="border-t border-[#dde5f5] transition-colors hover:bg-[#f8faff]"
              >
                <td className="px-5 py-3">
                  {obj.type === "CORPORATE" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-2.5 py-1 text-[10px] font-bold text-[#1d4ed8]">
                      <Building2 className="h-2.5 w-2.5" />
                      Corporate
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#99f6e4] bg-[#f0fdfa] px-2.5 py-1 text-[10px] font-bold text-[#0f766e]">
                      <Layers className="h-2.5 w-2.5" />
                      Divisional
                    </span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <p className="text-[13px] font-semibold text-[#0f1f3d]">{obj.title}</p>
                </td>
                <td className="px-5 py-3">
                  <p className="text-[12px] text-[#4a5a82]">{obj.division ?? "—"}</p>
                </td>
                <td className="px-5 py-3">
                  <span className="rounded-[6px] border border-[#dde5f5] bg-[#f8faff] px-2 py-0.5 font-mono text-[11px] text-[#8a97b8]">
                    {obj.external_id}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-[#dde5f5] bg-[#f8faff] px-5 py-3">
          <p className="text-[11px] text-[#8a97b8]">
            Showing {filtered.length} of {objectives.length} objectives
          </p>
        </div>
      </div>
    </div>
  );
}
