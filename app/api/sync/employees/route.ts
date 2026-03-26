import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getAllEmployees } from "@/lib/dynamics-org-service";

type DynamicsEmployeeRow = {
  xrm1_employeeid?: string | null;
  _xrm1_employee_user_id_value?: string | null;
  xrm1_fullname?: string | null;
  xrm1_first_name?: string | null;
  xrm1_last_name?: string | null;
  emailaddress?: string | null;
  internalemailaddress?: string | null;
  _dbjhr_divisions_value?: string | null;
};

function normalizeRole(r: string): string {
  return String(r ?? "").trim().toLowerCase();
}

function hasHrOrAdminRole(roles: string[] | undefined): boolean {
  if (!Array.isArray(roles) || roles.length === 0) return false;
  return roles.some((r) => {
    const n = normalizeRole(r);
    return n === "hr" || n === "admin";
  });
}

function sanitizeEmail(v: string | null | undefined): string | null {
  const out = String(v ?? "").trim().toLowerCase();
  return out || null;
}

function isDbjEmail(v: string | null | undefined): boolean {
  const em = sanitizeEmail(v);
  return !!em && em.endsWith("@dbankjm.com");
}

function isTruthyActive(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const n = v.trim().toLowerCase();
    return n === "true" || n === "1" || n === "active";
  }
  return false;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Sync failed";
}

/**
 * POST /api/sync/employees
 * Manual (HR/Admin) or cron-triggered sync from Dynamics xrm1_employees.
 */
export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  const isCron = !!process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET;
  const triggeredBy = isCron ? "cron" : "manual";
  const startTime = Date.now();
  const supabase = createClient();

  if (!isCron) {
    const user = await getCurrentUser();
    if (!hasHrOrAdminRole(user?.roles)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let logRow: { id?: string } | null = null;
  try {
    const inserted = await supabase
      .from("employee_sync_log")
      .insert({ triggered_by: triggeredBy, status: "running" })
      .select("id")
      .single();
    logRow = (inserted.data as { id?: string } | null) ?? null;
  } catch {
    // If migration is not applied yet, continue sync without log persistence.
    logRow = null;
  }
  const logId = logRow?.id as string | undefined;

  try {
    const allEmployees = (await getAllEmployees()) as DynamicsEmployeeRow[];
    console.log(`[sync] fetched ${allEmployees.length} xrm1_employees from Dynamics`);

    const { data: existingBefore } = await supabase
      .from("employees")
      .select("employee_id, is_active");

    const existingActiveIds = new Set(
      (existingBefore ?? [])
        .filter((e) => isTruthyActive((e as { is_active?: unknown }).is_active))
        .map((e) => String((e as { employee_id?: string }).employee_id ?? ""))
        .filter(Boolean)
    );
    const existingAllIds = new Set(
      (existingBefore ?? [])
        .map((e) => String((e as { employee_id?: string }).employee_id ?? ""))
        .filter(Boolean)
    );

    const rows = allEmployees
      .map((e) => ({
        employee_id: String(e._xrm1_employee_user_id_value ?? "").trim(),
        full_name:
          String(e.xrm1_fullname ?? "").trim() ||
          [e.xrm1_first_name, e.xrm1_last_name].filter(Boolean).map((x) => String(x).trim()).join(" ") ||
          null,
        email: sanitizeEmail(e.internalemailaddress ?? e.emailaddress),
        division_id: e._dbjhr_divisions_value ? String(e._dbjhr_divisions_value) : null,
        is_active: true,
      }))
      .filter((r) => !!r.employee_id)
      .filter((r) => !!r.employee_id && isDbjEmail(r.email));

    console.log(`[sync] after @dbankjm.com filter: ${rows.length} employees`);

    if (rows.length > 0) {
      const { error } = await supabase.from("employees").upsert(rows, { onConflict: "employee_id" });
      if (error) throw new Error(error.message);
    }

    const fetchedIds = new Set(rows.map((r) => r.employee_id));
    const toDeactivate = Array.from(existingActiveIds).filter((id) => !fetchedIds.has(id));
    if (toDeactivate.length > 0) {
      const { error: deactivateErr } = await supabase
        .from("employees")
        .update({ is_active: false })
        .in("employee_id", toDeactivate);
      if (deactivateErr) throw new Error(deactivateErr.message);
    }

    const { data: activeCycle } = await supabase
      .from("appraisal_cycles")
      .select("id, created_at")
      .in("status", ["active", "open"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let newEmployeeIds: string[] = [];
    if (activeCycle?.id) {
      const { data: existingAppraisals } = await supabase
        .from("appraisals")
        .select("employee_id")
        .eq("cycle_id", activeCycle.id)
        .neq("status", "CANCELLED");
      const appraisalEmployeeIds = new Set((existingAppraisals ?? []).map((a) => String(a.employee_id)));
      newEmployeeIds = rows
        .map((r) => r.employee_id)
        .filter((id) => !appraisalEmployeeIds.has(id));
    }

    const employeesAdded = rows.filter((r) => !existingAllIds.has(r.employee_id)).length;
    const duration = Date.now() - startTime;

    if (logId) {
      try {
        await supabase
          .from("employee_sync_log")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            employees_synced: rows.length,
            employees_added: employeesAdded,
            employees_deactivated: toDeactivate.length,
            new_employee_ids: newEmployeeIds,
            duration_ms: duration,
          })
          .eq("id", logId);
      } catch {
        // No-op: sync itself already succeeded.
      }
    }

    return NextResponse.json({
      ok: true,
      employees_synced: rows.length,
      employees_added: employeesAdded,
      employees_deactivated: toDeactivate.length,
      new_without_appraisal: newEmployeeIds.length,
      duration_ms: duration,
    });
  } catch (err: unknown) {
    if (logId) {
      try {
        await supabase
          .from("employee_sync_log")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_message: errorMessage(err),
            duration_ms: Date.now() - startTime,
          })
          .eq("id", logId);
      } catch {
        // no-op
      }
    }
    console.error("[sync] employee sync failed:", err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

/** GET /api/sync/employees -> recent sync log (HR/Admin only). */
export async function GET() {
  const user = await getCurrentUser();
  if (!hasHrOrAdminRole(user?.roles)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from("employee_sync_log")
      .select("*")
      .order("triggered_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return NextResponse.json({ log: data ?? [] });
  } catch {
    return NextResponse.json({ log: [] });
  }
}
