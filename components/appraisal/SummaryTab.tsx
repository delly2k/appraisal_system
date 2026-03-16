"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import { AppraisalData } from "./AppraisalTabs";
import {
  calcSummary,
  type SummaryResult,
  type WeightedRatingItem,
  type WorkplanItemSummary,
} from "@/lib/summary-calc";
import SummaryTabContent from "./SummaryTabContent";

interface SummaryTabProps {
  appraisalId: string;
  appraisal: AppraisalData;
  showLeadership: boolean;
  isHR: boolean;
  isManager: boolean;
  isEmployee: boolean;
  currentUserEmployeeId: string | null;
  /** Optional: called when summary result is available (e.g. for tab indicator dot). */
  onSummaryResult?: (result: SummaryResult) => void;
}

export function SummaryTab({
  appraisalId,
  appraisal,
  showLeadership,
  isHR,
  isManager,
  isEmployee,
  currentUserEmployeeId,
  onSummaryResult,
}: SummaryTabProps) {
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<{
    full_name: string | null;
    employee_id: string;
    division_name: string | null;
  } | null>(null);
  const [cycle, setCycle] = useState<{ name: string; fiscal_year: string } | null>(null);
  const [workplanItems, setWorkplanItems] = useState<{
    weight: number;
    actual_result: number | null;
    points: number | null;
  }[]>([]);
  const [summaryRatings, setSummaryRatings] = useState<{
    competencies: WeightedRatingItem[];
    productivity: WeightedRatingItem[];
    leadership: WeightedRatingItem[];
    technical: WeightedRatingItem[];
  }>({ competencies: [], productivity: [], leadership: [], technical: [] });

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    try {
      const { data: appData } = await supabase
        .from("appraisals")
        .select("employee_id, cycle_id")
        .eq("id", appraisalId)
        .single();
      // Use props when RLS blocks client read so API fetches still run
      const app = appData ?? { employee_id: appraisal.employee_id, cycle_id: appraisal.cycle_id };

      const [empRes, cycleRes, coreCatRes, prodCatRes, leadCatRes] = await Promise.all([
        supabase
          .from("employees")
          .select("full_name, employee_id, division_name")
          .eq("employee_id", app.employee_id)
          .single(),
        supabase.from("appraisal_cycles").select("name, fiscal_year").eq("id", app.cycle_id).single(),
        supabase.from("evaluation_categories").select("id").eq("category_type", "core").eq("active", true),
        supabase.from("evaluation_categories").select("id").eq("category_type", "productivity").eq("active", true),
        supabase.from("evaluation_categories").select("id").eq("category_type", "leadership").eq("active", true),
      ]);

      if (empRes.data) setEmployee(empRes.data);
      else setEmployee({ full_name: appraisal.employeeName, employee_id: appraisal.employee_id, division_name: null });
      if (cycleRes.data) setCycle(cycleRes.data);
      else setCycle({ name: appraisal.cycleName, fiscal_year: "" });

      // Use same API as Performance Assessment tab (service role, bypasses RLS)
      const wpRes = await fetch(`/api/appraisals/${appraisalId}/workplan`);
      const wpData = wpRes.ok ? await wpRes.json() : null;
      const rawItems = wpData?.items ?? [];
      const items: { weight: number; actual_result: number | null; points: number | null }[] = rawItems.map(
        (r: { weight?: number; actual_result?: number | null; points?: number | null }) => ({
          weight: Number(r.weight) || 0,
          actual_result: r.actual_result != null ? Number(r.actual_result) : null,
          points: r.points != null ? Number(r.points) : null,
        })
      );
      setWorkplanItems(items);

      // Use same APIs as section tabs (service role, bypasses RLS)
      const [factorRatingsRes, techCompRes] = await Promise.all([
        fetch(`/api/appraisals/${appraisalId}/factor-ratings`).then((r) => (r.ok ? r.json() : { ratings: [] })),
        fetch(`/api/appraisals/${appraisalId}/technical-competencies`).then((r) => (r.ok ? r.json() : { competencies: [] })),
      ]);
      const ratingData = factorRatingsRes.ratings ?? [];
      const techData = techCompRes.competencies ?? [];

      const allRatings = ratingData.map(
        (r: { factor_id: string; manager_rating_code?: string | null; self_rating_code?: string | null; weight?: number | null }) => ({
          factor_id: r.factor_id,
          manager_rating: r.manager_rating_code ?? null,
          self_rating: r.self_rating_code ?? null,
          weight: r.weight != null ? Number(r.weight) : null,
        })
      ) as { factor_id: string; manager_rating: string | null; self_rating: string | null; weight: number | null }[];

      const coreCatIds = (coreCatRes.data ?? []).map((c: { id: string }) => c.id);
      const prodCatIds = (prodCatRes.data ?? []).map((c: { id: string }) => c.id);
      const leadCatIds = (leadCatRes.data ?? []).map((c: { id: string }) => c.id);

      let coreFactorIds: string[] = [];
      let productivityFactorIds: string[] = [];
      let leadershipFactorIds: string[] = [];
      const factorWeightById = new Map<string, number>();
      if (coreCatIds.length > 0) {
        const { data: coreFactors } = await supabase.from("evaluation_factors").select("id, weight").in("category_id", coreCatIds).eq("active", true);
        (coreFactors ?? []).forEach((f: { id: string; weight?: number | null }) => {
          coreFactorIds.push(f.id);
          factorWeightById.set(f.id, Number(f.weight) || 0);
        });
      }
      if (prodCatIds.length > 0) {
        const { data: prodFactors } = await supabase.from("evaluation_factors").select("id, weight").in("category_id", prodCatIds).eq("active", true);
        (prodFactors ?? []).forEach((f: { id: string; weight?: number | null }) => {
          productivityFactorIds.push(f.id);
          factorWeightById.set(f.id, Number(f.weight) || 0);
        });
      }
      if (leadCatIds.length > 0 && showLeadership) {
        const { data: leadFactors } = await supabase.from("evaluation_factors").select("id, weight").in("category_id", leadCatIds).eq("active", true);
        (leadFactors ?? []).forEach((f: { id: string; weight?: number | null }) => {
          leadershipFactorIds.push(f.id);
          factorWeightById.set(f.id, Number(f.weight) || 0);
        });
      }

      const competencies: WeightedRatingItem[] = allRatings
        .filter((r) => coreFactorIds.includes(r.factor_id))
        .map((r) => ({ manager_rating: r.manager_rating, self_rating: r.self_rating, weight: r.weight ?? factorWeightById.get(r.factor_id) ?? 0 }));
      const productivity: WeightedRatingItem[] = allRatings
        .filter((r) => productivityFactorIds.includes(r.factor_id))
        .map((r) => ({ manager_rating: r.manager_rating, self_rating: r.self_rating, weight: r.weight ?? factorWeightById.get(r.factor_id) ?? 0 }));
      const leadership: WeightedRatingItem[] = allRatings
        .filter((r) => leadershipFactorIds.includes(r.factor_id))
        .map((r) => ({ manager_rating: r.manager_rating, self_rating: r.self_rating, weight: r.weight ?? factorWeightById.get(r.factor_id) ?? 0 }));
      const technical: WeightedRatingItem[] = (techData ?? []).map((t: { self_rating?: string | null; manager_rating?: string | null; weight?: number | null }) => ({
        manager_rating: t.manager_rating ?? null,
        self_rating: t.self_rating ?? null,
        weight: t.weight != null ? Number(t.weight) : 0,
      }));
      setSummaryRatings({ competencies, productivity, leadership, technical });
    } finally {
      setLoading(false);
    }
  }, [appraisalId, showLeadership, appraisal]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handler = () => loadData();
    window.addEventListener("appraisal-completion-invalidate", handler);
    return () => window.removeEventListener("appraisal-completion-invalidate", handler);
  }, [loadData]);

  const workplanForSummary: WorkplanItemSummary[] = useMemo(
    () => workplanItems.map((i) => ({ weight: i.weight, actual_result: i.actual_result })),
    [workplanItems]
  );

  const summaryResult: SummaryResult = useMemo(
    () =>
      calcSummary({
        workplanItems: workplanForSummary,
        competencies: summaryRatings.competencies,
        technical: summaryRatings.technical,
        productivity: summaryRatings.productivity,
        leadership: summaryRatings.leadership,
        isManagementTrack: showLeadership,
      }),
    [workplanForSummary, summaryRatings, showLeadership]
  );

  const isEmptyScore = summaryResult.totalPoints === 0 || summaryResult.components.every((c) => c.actual === 0);

  useEffect(() => {
    if (onSummaryResult) onSummaryResult(summaryResult);
  }, [summaryResult, onSummaryResult]);

  return loading ? (
    <p className="text-slate-500 py-4">Loading summary…</p>
  ) : (
    <SummaryTabContent
      employee={employee}
      cycle={cycle}
      appraisal={appraisal}
      summaryResult={summaryResult}
      isEmptyScore={isEmptyScore}
    />
  );
}
