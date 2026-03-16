/**
 * Appraisal service: cycle creation, opening, check-in creation, dashboard data.
 * All DB access via Supabase server (service role) client.
 * Export all service functions from this module.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  generateAppraisalsForCycle,
  type GenerateResult,
} from "@/lib/appraisal-generator";
import type { AppraisalStatus, DashboardEmployeePayload } from "@/types/appraisal";

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required"
    );
  }
  return createClient(url, key);
}

export { generateAppraisalsForCycle };
export type { GenerateResult };

export interface CreateCycleInput {
  name: string;
  cycle_type: "quarterly" | "mid_year" | "annual";
  fiscal_year: string;
  quarter?: string | null;
  start_date: string;
  end_date: string;
}

export interface CreateCycleResult {
  id: string;
}

/** Create a cycle (draft) and its cycle_review_types. Fails if a cycle for this fiscal year already exists. */
export async function createCycle(
  input: CreateCycleInput
): Promise<CreateCycleResult> {
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from("appraisal_cycles")
    .select("id")
    .eq("fiscal_year", input.fiscal_year)
    .limit(1)
    .maybeSingle();
  if (existing?.id) {
    throw new Error(
      `A cycle for fiscal year ${input.fiscal_year} already exists. Only one cycle per fiscal year is allowed.`
    );
  }
  const { data: created, error: e } = await supabase
    .from("appraisal_cycles")
    .insert({
      name: input.name,
      cycle_type: input.cycle_type,
      fiscal_year: input.fiscal_year,
      quarter: input.quarter ?? null,
      start_date: input.start_date,
      end_date: input.end_date,
      status: "draft",
    })
    .select("id")
    .single();
  if (e) throw new Error(e.message);
  if (!created?.id) throw new Error("Create cycle failed");
  await supabase.from("cycle_review_types").insert([
    { cycle_id: created.id, review_type: "quarterly" },
    { cycle_id: created.id, review_type: "mid_year" },
    { cycle_id: created.id, review_type: "annual" },
  ]);
  return { id: created.id };
}

/** Open a cycle: set status to open, then generate appraisals (mid_year + annual). */
export async function openCycle(cycleId: string): Promise<{
  status: string;
  appraisalsCreated: number;
  cycleName: string;
}> {
  const supabase = getSupabaseAdmin();
  const { error: updateErr } = await supabase
    .from("appraisal_cycles")
    .update({ status: "open" })
    .eq("id", cycleId);
  if (updateErr) throw new Error(updateErr.message);
  const result: GenerateResult = await generateAppraisalsForCycle(cycleId);
  return {
    status: "open",
    appraisalsCreated: result.appraisalsCreated,
    cycleName: result.cycleName,
  };
}

export interface CreateCheckinInput {
  cycleId: string;
  employeeId: string;
  quarter: 1 | 2 | 3 | 4;
}

/** Create a quarterly check-in appraisal (idempotent). */
export async function createCheckin(
  input: CreateCheckinInput
): Promise<{ id: string }> {
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from("appraisals")
    .select("id")
    .eq("cycle_id", input.cycleId)
    .eq("employee_id", input.employeeId)
    .eq("review_type", "quarterly")
    .eq("quarter", input.quarter)
    .maybeSingle();
  if (existing?.id) return { id: existing.id };

  const { data: cycle } = await supabase
    .from("appraisal_cycles")
    .select("id")
    .eq("id", input.cycleId)
    .single();
  if (!cycle) throw new Error("Cycle not found");

  const { data: emp } = await supabase
    .from("employees")
    .select("employee_id, division_id")
    .eq("employee_id", input.employeeId)
    .single();
  if (!emp) throw new Error("Employee not found");

  const { data: rl } = await supabase
    .from("reporting_lines")
    .select("manager_employee_id")
    .eq("employee_id", input.employeeId)
    .eq("is_primary", true)
    .maybeSingle();

  const { data: inserted, error: insErr } = await supabase
    .from("appraisals")
    .insert({
      cycle_id: input.cycleId,
      employee_id: input.employeeId,
      manager_employee_id: rl?.manager_employee_id ?? null,
      division_id: emp.division_id ?? null,
      review_type: "quarterly",
      quarter: input.quarter,
      status: "DRAFT",
      purpose: "end_of_year",
    })
    .select("id")
    .single();
  if (insErr) throw new Error(insErr.message);
  if (!inserted?.id) throw new Error("Create check-in failed");
  return { id: inserted.id };
}

/** Get dashboard payload for an employee for the current open cycle. */
export async function getDashboardDataForEmployee(
  employeeId: string
): Promise<DashboardEmployeePayload | null> {
  const supabase = getSupabaseAdmin();
  const { data: cycle } = await supabase
    .from("appraisal_cycles")
    .select("id, fiscal_year")
    .eq("status", "open")
    .order("end_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!cycle) return null;

  const { data: appraisals } = await supabase
    .from("appraisals")
    .select("id, review_type, quarter, status")
    .eq("cycle_id", cycle.id)
    .eq("employee_id", employeeId);

  const appraisalIds = (appraisals ?? []).map((a) => a.id);
  const { data: workplans } = await supabase
    .from("workplans")
    .select("status")
    .in("appraisal_id", appraisalIds.length ? appraisalIds : ["00000000-0000-0000-0000-000000000000"]);
  const workplanStatus = workplans?.[0]?.status ?? "none";

  const byReview = new Map<string, { status: AppraisalStatus }>();
  const quarterlyByQuarter = new Map<number, { status: AppraisalStatus }>();
  for (const a of appraisals ?? []) {
    const status = a.status as AppraisalStatus;
    byReview.set(a.review_type, { status });
    if (a.review_type === "quarterly" && a.quarter != null) {
      quarterlyByQuarter.set(a.quarter, { status });
    }
  }

  const checkins: DashboardEmployeePayload["checkins"] = {
    Q1: (quarterlyByQuarter.get(1) as { status: AppraisalStatus } | undefined) ?? "NOT_CREATED",
    Q2: (quarterlyByQuarter.get(2) as { status: AppraisalStatus } | undefined) ?? "NOT_CREATED",
    Q3: (quarterlyByQuarter.get(3) as { status: AppraisalStatus } | undefined) ?? "NOT_CREATED",
    Q4: (quarterlyByQuarter.get(4) as { status: AppraisalStatus } | undefined) ?? "NOT_CREATED",
  };

  return {
    fiscal_year: cycle.fiscal_year,
    cycle_id: cycle.id,
    workplan_status: workplanStatus,
    mid_year: byReview.get("mid_year") ?? null,
    annual: byReview.get("annual") ?? null,
    checkins,
  };
}
