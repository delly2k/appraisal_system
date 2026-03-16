import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase config required");
  return createClient(url, key);
}

async function isManagerOf(
  supabase: ReturnType<typeof createClient>,
  profileOwnerUserId: string,
  currentUserEmployeeId: string | null | undefined
): Promise<boolean> {
  if (!currentUserEmployeeId) return false;
  const { data: appUser } = await supabase
    .from("app_users")
    .select("employee_id")
    .eq("id", profileOwnerUserId)
    .maybeSingle();
  const reportEmployeeId = appUser?.employee_id ?? null;
  if (!reportEmployeeId) return false;
  const { data: lines } = await supabase
    .from("reporting_lines")
    .select("employee_id")
    .eq("manager_employee_id", currentUserEmployeeId)
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

    const { data: profile, error: profileErr } = await supabase
      .from("employee_development_profiles")
      .select("*")
      .eq("employee_id", employeeId)
      .maybeSingle();

    if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 });

    const { data: appUser } = await supabase
      .from("app_users")
      .select("employee_id")
      .eq("id", employeeId)
      .maybeSingle();

    const empId = appUser?.employee_id ?? null;
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

    const isManager = await isManagerOf(supabase, employeeId, user.employee_id ?? undefined);

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

    return NextResponse.json({ profile: profile ?? null, cycles, employee, isManager, activeAppraisal });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
