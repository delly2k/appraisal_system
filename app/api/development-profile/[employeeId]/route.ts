import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AuthUser } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase config required");
  return createClient(url, key);
}

function isHrOrAdmin(user: AuthUser): boolean {
  const set = new Set(user.roles.map((r) => String(r).toLowerCase()));
  return set.has("hr") || set.has("admin") || set.has("super_admin");
}

async function isManagerOfEmployee(
  supabase: SupabaseClient<any>,
  reportEmployeeId: string,
  managerEmployeeId: string | null | undefined
): Promise<boolean> {
  if (!managerEmployeeId || !reportEmployeeId) return false;
  const { data: lines } = await supabase
    .from("reporting_lines")
    .select("employee_id")
    .eq("manager_employee_id", managerEmployeeId)
    .eq("employee_id", reportEmployeeId)
    .eq("is_primary", true)
    .limit(1);
  return (lines?.length ?? 0) > 0;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { employeeId } = await params;
    if (!employeeId) return NextResponse.json({ error: "employeeId required" }, { status: 400 });

    const supabase = getSupabase();

    const isOwn = user.employee_id != null && user.employee_id === employeeId;
    const isElevated = isHrOrAdmin(user);
    const isMgr = await isManagerOfEmployee(supabase, employeeId, user.employee_id ?? undefined);
    if (!isOwn && !isElevated && !isMgr) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: profile, error: profileErr } = await supabase
      .from("employee_development_profiles")
      .select("*")
      .eq("employee_id", employeeId)
      .maybeSingle();

    if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 });

    const empId = employeeId;
    let cycles: { id: string; fiscal_year: string; status: string; updated_at: string }[] = [];
    let employee: { full_name: string; division: string } | null = null;

    if (empId) {
      const { data: empRow } = await supabase
        .from("employees")
        .select("full_name, division_name")
        .eq("employee_id", empId)
        .maybeSingle();
      if (empRow) {
        employee = {
          full_name: empRow.full_name ?? "Unknown",
          division: empRow.division_name ?? "—",
        };
      }
    }
    if (!employee) {
      employee = { full_name: "Unknown", division: "—" };
    }

    const isManager = await isManagerOfEmployee(supabase, employeeId, user.employee_id ?? undefined);

    if (empId) {
      const { data: rows } = await supabase
        .from("appraisals")
        .select("id, status, updated_at, cycle_id")
        .eq("employee_id", empId)
        .order("updated_at", { ascending: false })
        .limit(10);

      if (rows?.length) {
        const cycleIds = [...new Set(rows.map((r) => r.cycle_id))];
        const { data: cycleRows } = await supabase
          .from("appraisal_cycles")
          .select("id, fiscal_year")
          .in("id", cycleIds);

        const cycleMap = new Map((cycleRows ?? []).map((c) => [c.id, c.fiscal_year]));
        const withFiscal = rows
          .map((r) => ({
            id: r.id,
            fiscal_year: cycleMap.get(r.cycle_id) ?? "",
            status: r.status as string,
            updated_at: r.updated_at as string,
          }))
          .filter((r) => r.fiscal_year)
          .sort((a, b) => (b.fiscal_year || "").localeCompare(a.fiscal_year || ""))
          .slice(0, 4);
        cycles = withFiscal;
      }
    }

    let activeAppraisal: { id: string; fiscal_year: string } | null = null;
    let eqResult: {
      id: string;
      taken_at: string;
      sa_total: number;
      me_total: number;
      mo_total: number;
      e_total: number;
      ss_total: number;
      total_score: number;
    } | null = null;
    let eqDraft: {
      responses: Record<string, number> | null;
      last_page: number | null;
      updated_at: string | null;
    } | null = null;
    if (empId) {
      const { data: openRows } = await supabase
        .from("appraisals")
        .select("id, cycle_id")
        .eq("employee_id", empId)
        .eq("status", "SELF_ASSESSMENT")
        .limit(1);
      if (openRows?.length && openRows[0]) {
        const { data: cy } = await supabase
          .from("appraisal_cycles")
          .select("fiscal_year")
          .eq("id", openRows[0].cycle_id)
          .maybeSingle();
        activeAppraisal = {
          id: openRows[0].id,
          fiscal_year: (cy?.fiscal_year as string) ?? "",
        };
      }
    }

    const { data: eqRow } = await supabase
      .from("eq_results")
      .select("id, taken_at, sa_total, me_total, mo_total, e_total, ss_total, total_score")
      .eq("employee_id", employeeId)
      .order("taken_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (eqRow) {
      eqResult = {
        id: String(eqRow.id),
        taken_at: String(eqRow.taken_at),
        sa_total: Number(eqRow.sa_total),
        me_total: Number(eqRow.me_total),
        mo_total: Number(eqRow.mo_total),
        e_total: Number(eqRow.e_total),
        ss_total: Number(eqRow.ss_total),
        total_score: Number(eqRow.total_score),
      };
    }

    const { data: draftRow } = await supabase
      .from("eq_drafts")
      .select("responses, last_page, updated_at")
      .eq("employee_id", employeeId)
      .maybeSingle();

    if (draftRow) {
      eqDraft = {
        responses: (draftRow.responses as Record<string, number> | null) ?? null,
        last_page: (draftRow.last_page as number | null) ?? null,
        updated_at: (draftRow.updated_at as string | null) ?? null,
      };
    }

    return NextResponse.json({ profile: profile ?? null, cycles, employee, isManager, activeAppraisal, eqResult, eqDraft });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
