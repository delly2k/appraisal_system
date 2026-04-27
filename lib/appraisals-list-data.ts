import { createClient } from "@supabase/supabase-js";
import type { AuthUser } from "@/lib/auth";
import { getReportingStructureFromDynamics } from "@/lib/reporting-structure";
import { getDirectReports } from "@/lib/dynamics-org-service";

/**
 * Server-side data for appraisals list by role.
 * Employee: own appraisals. Manager: direct reports from Dynamics (same source as "People reporting to you" test page).
 * GM: division. HR/Admin: same role-based list on "My Appraisals"; use getAppraisalsAll() on /admin/appraisals for view-all.
 */

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase URL and key required");
  return createClient(url, key);
}

export interface AppraisalListItem {
  appraisalId: string;
  employeeId: string;
  employeeName: string;
  cycleId: string;
  cycleName: string;
  reviewType: string;
  status: string;
  departmentName: string;
  isDelegated?: boolean;
  delegatedByName?: string | null;
  delegatedToName?: string | null;
}

export interface AppraisalsListResult {
  items: AppraisalListItem[];
  total: number;
}

export interface AppraisalsListWithReportsResult {
  myAppraisals: AppraisalListItem[];
  reportsAppraisals: AppraisalListItem[];
}

export interface AppraisalsListOptions {
  search?: string;
  status?: string;
  cycleId?: string;
  page?: number;
  pageSize?: number;
}

export interface CycleOption {
  id: string;
  name: string;
}

/** For HR filter dropdown: list of cycles (id, name). */
export async function getAppraisalCycleOptions(): Promise<CycleOption[]> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("appraisal_cycles")
    .select("id, name")
    .order("end_date", { ascending: false });
  return (data ?? []).map((c) => ({ id: c.id, name: c.name }));
}

/**
 * Fetch appraisals for direct reports using Dynamics (same as "People reporting to you" on reporting test page).
 * Resolves user to xrm1_employeeid via getReportingStructureFromDynamics, then getDirectReports; appraisals use system user id.
 */
async function getAppraisalsForDirectReportsFromDynamics(
  user: AuthUser
): Promise<AppraisalListItem[]> {
  const structure = await getReportingStructureFromDynamics(
    user.employee_id ?? null,
    user.email ?? null
  );
  if (!structure.employee_id) return [];

  const reports = await getDirectReports(structure.employee_id);
  const systemUserIds = reports
    .map((r) => r._xrm1_employee_user_id_value)
    .filter((id): id is string => Boolean(id));
  if (systemUserIds.length === 0) return [];

  const supabase = getSupabase();
  const { data: appraisals, error: appError } = await supabase
    .from("appraisals")
    .select("id, employee_id, cycle_id, review_type, status")
    .in("employee_id", systemUserIds)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (appError || !appraisals?.length) return [];
  return hydrateList(appraisals, supabase);
}

/**
 * Fetch appraisals for the current user based on role (for "My Appraisals").
 * Returns both myAppraisals (user's own) and reportsAppraisals (direct reports from Dynamics).
 * HR/Admin: same logic; use getAppraisalsAll() on /admin/appraisals for view-all.
 */
export async function getAppraisalsListForUser(
  user: AuthUser | null,
  options?: AppraisalsListOptions
): Promise<AppraisalsListWithReportsResult> {
  if (!user) return { myAppraisals: [], reportsAppraisals: [] };

  const employeeId = user.employee_id ?? null;
  const supabase = getSupabase();

  const delegatedAppraisalsPromise = employeeId
    ? supabase
        .from("appraisal_delegations")
        .select("appraisal_id, delegated_to_name")
        .eq("delegated_to", employeeId)
    : Promise.resolve({
        data: [] as Array<{ appraisal_id: string; delegated_to_name?: string | null }>,
        error: null as null,
      });

  const [reportsAppraisals, myOwnAppraisals, delegatedRowsResult] = await Promise.all([
    getAppraisalsForDirectReportsFromDynamics(user),
    employeeId ? getAppraisalsForEmployee(employeeId) : Promise.resolve([]),
    delegatedAppraisalsPromise,
  ]);

  const delegatedRows = delegatedRowsResult.data ?? [];
  let delegatedAppraisals: AppraisalListItem[] = [];
  if (delegatedRows.length > 0) {
    const delegatedIds = delegatedRows.map((d) => d.appraisal_id);
    const { data: appraisals } = await supabase
      .from("appraisals")
      .select("id, employee_id, cycle_id, review_type, status")
      .in("id", delegatedIds)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    delegatedAppraisals = await hydrateList(appraisals ?? [], supabase);
    delegatedAppraisals = delegatedAppraisals.map((item) => ({
      ...item,
      isDelegated: true,
      delegatedByName: item.delegatedByName ?? null,
    }));
  }

  const seen = new Set<string>();
  const myAppraisals = [...myOwnAppraisals, ...delegatedAppraisals].filter((item) => {
    if (seen.has(item.appraisalId)) return false;
    seen.add(item.appraisalId);
    return true;
  });

  return { myAppraisals, reportsAppraisals };
}

async function getAppraisalsForEmployee(
  employeeId: string
): Promise<AppraisalListItem[]> {
  const supabase = getSupabase();

  const { data: appraisals, error: appError } = await supabase
    .from("appraisals")
    .select("id, employee_id, cycle_id, review_type, status")
    .eq("employee_id", employeeId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (appError || !appraisals?.length) return [];

  return hydrateList(appraisals, supabase);
}

/** Fetch all appraisals with optional filters/pagination. Used by HR "All Appraisals" page only. */
export async function getAppraisalsAll(
  options?: AppraisalsListOptions
): Promise<AppraisalsListResult> {
  const supabase = getSupabase();

  const { data: appraisals, error: appError } = await supabase
    .from("appraisals")
    .select("id, employee_id, cycle_id, review_type, status")
    .order("created_at", { ascending: false });

  if (appError || !appraisals?.length) {
    return { items: [], total: 0 };
  }

  const items = await hydrateList(appraisals, supabase);

  let filtered = items;
  const search = options?.search?.trim().toLowerCase();
  if (search) {
    filtered = filtered.filter(
      (a) =>
        a.employeeName.toLowerCase().includes(search) ||
        (a.departmentName && a.departmentName.toLowerCase().includes(search))
    );
  }
  if (options?.status) {
    filtered = filtered.filter((a) => a.status === options.status);
  }
  if (options?.cycleId) {
    filtered = filtered.filter((a) => a.cycleId === options.cycleId);
  }

  const total = filtered.length;
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(
    100,
    Math.max(10, options?.pageSize ?? 25)
  );
  const start = (page - 1) * pageSize;
  const paginated = filtered.slice(start, start + pageSize);

  return { items: paginated, total };
}

async function getAppraisalsByDivision(
  divisionId: string
): Promise<AppraisalListItem[]> {
  const supabase = getSupabase();

  const { data: appraisals, error: appError } = await supabase
    .from("appraisals")
    .select("id, employee_id, cycle_id, review_type, status")
    .eq("division_id", divisionId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (appError || !appraisals?.length) return [];

  return hydrateList(appraisals, supabase);
}

async function hydrateList(
  appraisals: { id: string; employee_id: string; cycle_id: string; review_type: string | null; status: string }[],
  supabase: ReturnType<typeof getSupabase>
): Promise<AppraisalListItem[]> {
  const empIds = [...new Set(appraisals.map((a) => a.employee_id))];
  const cycleIds = [...new Set(appraisals.map((a) => a.cycle_id))];

  const { data: employees } = await supabase
    .from("employees")
    .select("employee_id, full_name, department_name")
    .in("employee_id", empIds);
  const nameByEmployeeId = new Map(
    (employees ?? []).map((e) => [e.employee_id, e.full_name ?? "—"])
  );
  const departmentByEmployeeId = new Map(
    (employees ?? []).map((e) => [
      e.employee_id,
      (e as { department_name?: string | null }).department_name ?? "—",
    ])
  );

  const { data: cycles } = await supabase
    .from("appraisal_cycles")
    .select("id, name")
    .in("id", cycleIds);
  const nameByCycleId = new Map((cycles ?? []).map((c) => [c.id, c.name]));

  const appraisalIds = appraisals.map((a) => a.id);
  const { data: delegations } = appraisalIds.length
    ? await supabase
        .from("appraisal_delegations")
        .select("appraisal_id, delegated_to_name")
        .in("appraisal_id", appraisalIds)
    : { data: [] as Array<{ appraisal_id: string; delegated_to_name: string }> };
  const delegationByAppraisal = new Map(
    (delegations ?? []).map((d) => [d.appraisal_id, d.delegated_to_name])
  );

  const { data: appraisalManagers } = await supabase
    .from("appraisals")
    .select("id, manager_employee_id")
    .in("id", appraisalIds);
  const managerIdByAppraisal = new Map(
    (appraisalManagers ?? []).map((a) => [a.id, a.manager_employee_id as string | null])
  );
  const allManagerEmployeeIds = [...new Set((appraisalManagers ?? []).map((a) => a.manager_employee_id).filter(Boolean))] as string[];
  const { data: managerEmployees } = allManagerEmployeeIds.length
    ? await supabase
        .from("employees")
        .select("employee_id, full_name")
        .in("employee_id", allManagerEmployeeIds)
    : { data: [] as Array<{ employee_id: string; full_name: string | null }> };
  const managerNameByEmployeeId = new Map(
    (managerEmployees ?? []).map((e) => [e.employee_id, e.full_name ?? "Manager"])
  );

  return appraisals.map((a) => ({
    appraisalId: a.id,
    employeeId: a.employee_id,
    employeeName: nameByEmployeeId.get(a.employee_id) ?? "—",
    cycleId: a.cycle_id,
    cycleName: nameByCycleId.get(a.cycle_id) ?? "—",
    reviewType: a.review_type ?? "—",
    status: (a.status as string) ?? "DRAFT",
    departmentName: departmentByEmployeeId.get(a.employee_id) ?? "—",
    delegatedToName: delegationByAppraisal.get(a.id) ?? null,
    delegatedByName: managerNameByEmployeeId.get(managerIdByAppraisal.get(a.id) ?? "") ?? null,
  }));
}
