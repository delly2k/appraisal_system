import axios, { type AxiosInstance } from "axios";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Dynamics 365 Dataverse synchronization service.
 * - Authenticates with Azure AD (client credentials).
 * - Fetches employees and reporting lines from Dataverse Web API (with pagination).
 * - Upserts into Supabase employees and reporting_lines.
 *
 * Env: DYNAMICS_TENANT_ID, DYNAMICS_CLIENT_ID, DYNAMICS_CLIENT_SECRET, DYNAMICS_DATAVERSE_URL
 * Supabase (for upsert): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const PAGE_SIZE = 5000;
const TOKEN_URL = (tenantId: string) =>
  `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

// Optional Dataverse field names (set in .env if your entity uses different or custom columns)
const FIELD_GRADE = process.env.DYNAMICS_FIELD_GRADE ?? "crXXX_grade";
const FIELD_DIVISION_ID = process.env.DYNAMICS_FIELD_DIVISION_ID ?? "crXXX_divisionid";
const FIELD_DIVISION_NAME = process.env.DYNAMICS_FIELD_DIVISION_NAME ?? "crXXX_divisionname";
const FIELD_DEPARTMENT_ID = process.env.DYNAMICS_FIELD_DEPARTMENT_ID ?? "crXXX_departmentid";
const FIELD_DEPARTMENT_NAME = process.env.DYNAMICS_FIELD_DEPARTMENT_NAME ?? "crXXX_departmentname";
const FIELD_EMPLOYEE_TYPE = process.env.DYNAMICS_FIELD_EMPLOYEE_TYPE ?? "crXXX_employeetype";

/**
 * Dataverse systemusers entity (from Web API).
 * Key fields: systemuserid, internalemailaddress, fullname, title, parentsystemuserid.
 * domainname often matches email; isdisabled = true means user is disabled.
 */
export interface DataverseEmployeeRecord {
  systemuserid?: string;
  azureactivedirectoryobjectid?: string | null;
  fullname?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  internalemailaddress?: string | null;
  domainname?: string | null;
  title?: string | null;
  parentsystemuserid?: string | null;
  isdisabled?: boolean | number;
  [key: string]: string | boolean | number | null | undefined;
}

export interface EmployeeRow {
  employee_id: string;
  aad_object_id: string | null;
  email: string | null;
  full_name: string | null;
  job_title: string | null;
  grade: string | null;
  division_id: string | null;
  division_name: string | null;
  department_id: string | null;
  department_name: string | null;
  employee_type: "management" | "non_management";
  is_active: boolean;
  last_synced_at: string;
}

export interface ReportingLineRow {
  employee_id: string;
  manager_employee_id: string;
  is_primary: boolean;
  effective_from: string | null;
  effective_to: string | null;
  last_synced_at: string;
}

/** Get Azure AD access token using client credentials. */
export async function getDataverseAccessToken(): Promise<string> {
  const tenantId = process.env.DYNAMICS_TENANT_ID;
  const clientId = process.env.DYNAMICS_CLIENT_ID;
  const clientSecret = process.env.DYNAMICS_CLIENT_SECRET;
  const resource = process.env.DYNAMICS_DATAVERSE_URL?.trim().replace(/\/$/, "");

  if (!tenantId || !clientId || !clientSecret || !resource) {
    throw new Error(
      "Missing Dynamics env: DYNAMICS_TENANT_ID, DYNAMICS_CLIENT_ID, DYNAMICS_CLIENT_SECRET, DYNAMICS_DATAVERSE_URL"
    );
  }

  const scope = `${resource}/.default`;
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope,
  });

  const { data } = await axios.post<{ access_token: string }>(
    TOKEN_URL(tenantId),
    params.toString(),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );

  if (!data?.access_token) {
    throw new Error("No access_token in Azure AD response");
  }
  return data.access_token;
}

/** Create an Axios client for the Dataverse Web API with a valid token. */
export async function createDataverseApiClient(): Promise<AxiosInstance> {
  const token = await getDataverseAccessToken();
  const baseURL = process.env.DYNAMICS_DATAVERSE_URL?.trim().replace(/\/$/, "");
  if (!baseURL) throw new Error("DYNAMICS_DATAVERSE_URL is required");

  return axios.create({
    baseURL: `${baseURL}/api/data/v9.2`,
    headers: {
      "OData-MaxVersion": "4.0",
      "OData-Version": "4.0",
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      Prefer: 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"',
    },
  });
}

const EMPLOYEE_ENTITY = process.env.DYNAMICS_EMPLOYEE_ENTITY ?? "systemusers";

/** Build $select for employees: standard systemuser fields (per Dataverse schema) + optional custom fields from env. */
function employeeSelect(): string {
  const standard =
    "systemuserid,azureactivedirectoryobjectid,fullname,firstname,lastname,internalemailaddress,domainname,title,parentsystemuserid,isdisabled";
  const optional = [
    process.env.DYNAMICS_FIELD_GRADE,
    process.env.DYNAMICS_FIELD_DIVISION_ID,
    process.env.DYNAMICS_FIELD_DIVISION_NAME,
    process.env.DYNAMICS_FIELD_DEPARTMENT_ID,
    process.env.DYNAMICS_FIELD_DEPARTMENT_NAME,
    process.env.DYNAMICS_FIELD_EMPLOYEE_TYPE,
  ].filter((f): f is string => !!f && !f.startsWith("crXXX_"));
  return optional.length ? `${standard},${optional.join(",")}` : standard;
}

/** Fetch all employees from Dataverse with pagination. */
export async function fetchAllEmployeesFromDataverse(): Promise<DataverseEmployeeRecord[]> {
  const client = await createDataverseApiClient();
  const select = employeeSelect();
  const url = `/${EMPLOYEE_ENTITY}?$select=${encodeURIComponent(select)}&$top=${PAGE_SIZE}`;

  const results: DataverseEmployeeRecord[] = [];
  let nextUrl: string | null = url;

  type PagePayload = { value?: DataverseEmployeeRecord[]; "@odata.nextLink"?: string };
  while (nextUrl) {
    const requestUrl: string = nextUrl.startsWith("http")
      ? nextUrl
      : `${process.env.DYNAMICS_DATAVERSE_URL?.trim().replace(/\/$/, "")}/api/data/v9.2${nextUrl}`;
    const res = await client.get<PagePayload>(requestUrl);
    const data = res.data as PagePayload | undefined;
    const page = data?.value ?? [];
    results.push(...page);
    nextUrl = data?.["@odata.nextLink"] ?? null;
  }

  return results;
}

/** Fetch a single employee from Dataverse by email (internalemailaddress). */
export async function fetchOneEmployeeByEmail(email: string): Promise<DataverseEmployeeRecord | null> {
  if (!email?.trim()) return null;
  const client = await createDataverseApiClient();
  const select = employeeSelect();
  const escaped = email.trim().replace(/'/g, "''");
  const filter = `internalemailaddress eq '${escaped}'`;
  const url = `/${EMPLOYEE_ENTITY}?$filter=${encodeURIComponent(filter)}&$select=${encodeURIComponent(select)}&$top=1`;
  const { data } = await client.get<{ value?: DataverseEmployeeRecord[] }>(url);
  const value = data.value ?? [];
  return value[0] ?? null;
}

/** Fetch system user by email from systemusers (internalemailaddress). Always uses systemusers entity for reporting resolution. */
export async function fetchOneSystemUserByEmail(email: string): Promise<DataverseEmployeeRecord | null> {
  if (!email?.trim()) return null;
  const client = await createDataverseApiClient();
  const select = "systemuserid,fullname,internalemailaddress";
  const raw = email.trim();
  const escaped = raw.replace(/'/g, "''");
  const lowerEscaped = raw.toLowerCase().replace(/'/g, "''");
  const filters = [`internalemailaddress eq '${escaped}'`, `tolower(internalemailaddress) eq '${lowerEscaped}'`];
  for (const filter of filters) {
    try {
      const url = `/systemusers?$filter=${encodeURIComponent(filter)}&$select=${encodeURIComponent(select)}&$top=1`;
      const { data } = await client.get<{ value?: DataverseEmployeeRecord[] }>(url);
      const value = data.value ?? [];
      const record = value[0];
      if (record) return record;
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[dynamics-sync] fetchOneSystemUserByEmail filter failed:", filter.slice(0, 50) + "...", err);
      }
    }
  }
  return null;
}

/** Fetch a single employee from Dataverse by Azure AD object ID. */
export async function fetchOneEmployeeByAadObjectId(aadObjectId: string): Promise<DataverseEmployeeRecord | null> {
  if (!aadObjectId?.trim()) return null;
  const client = await createDataverseApiClient();
  const select = employeeSelect();
  const escaped = aadObjectId.trim().replace(/'/g, "''");
  const filter = `azureactivedirectoryobjectid eq '${escaped}'`;
  const url = `/${EMPLOYEE_ENTITY}?$filter=${encodeURIComponent(filter)}&$select=${encodeURIComponent(select)}&$top=1`;
  const { data } = await client.get<{ value?: DataverseEmployeeRecord[] }>(url);
  const value = data.value ?? [];
  return value[0] ?? null;
}

/** Map a Dataverse systemusers record to our employees table row. */
export function mapToEmployeeRow(record: DataverseEmployeeRecord): EmployeeRow | null {
  const id = record.systemuserid;
  if (!id) return null;

  const now = new Date().toISOString();
  const rawType = record[FIELD_EMPLOYEE_TYPE];
  const employeeType: "management" | "non_management" =
    String(rawType ?? "").toLowerCase() === "management" ? "management" : "non_management";

  const rawEmail = record.internalemailaddress ?? record.domainname ?? null;
  const email = rawEmail != null ? String(rawEmail).trim().toLowerCase() || null : null;
  const fullName =
    record.fullname ??
    ([record.firstname, record.lastname].filter(Boolean).join(" ").trim() || null);
  const isActive = record.isdisabled === true || record.isdisabled === 1 ? false : true;

  const str = (v: string | number | boolean | null | undefined): string | null =>
    v != null ? String(v) : null;
  return {
    employee_id: String(id),
    aad_object_id: record.azureactivedirectoryobjectid ?? null,
    email,
    full_name: fullName,
    job_title: record.title ?? null,
    grade: str(record[FIELD_GRADE] ?? null),
    division_id: str(record[FIELD_DIVISION_ID] ?? null),
    division_name: str(record[FIELD_DIVISION_NAME] ?? null),
    department_id: str(record[FIELD_DEPARTMENT_ID] ?? null),
    department_name: str(record[FIELD_DEPARTMENT_NAME] ?? null),
    employee_type: employeeType,
    is_active: isActive,
    last_synced_at: now,
  };
}

/** Derive reporting lines from employee records (parentsystemuserid). */
export function deriveReportingLines(
  records: DataverseEmployeeRecord[],
  effectiveFrom?: string | null,
  effectiveTo?: string | null
): ReportingLineRow[] {
  const now = new Date().toISOString();
  const lines: ReportingLineRow[] = [];

  for (const r of records) {
    const empId = r.systemuserid;
    const managerId = r.parentsystemuserid;
    if (!empId || !managerId) continue;
    lines.push({
      employee_id: String(empId),
      manager_employee_id: String(managerId),
      is_primary: true,
      effective_from: effectiveFrom ?? null,
      effective_to: effectiveTo ?? null,
      last_synced_at: now,
    });
  }
  return lines;
}

/** Get Supabase admin client for sync (bypasses RLS). */
function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for sync"
    );
  }
  return createClient(url, key);
}

/** Upsert employees into Supabase. Returns count upserted. */
export async function syncEmployees(): Promise<number> {
  const records = await fetchAllEmployeesFromDataverse();
  const rows = records.map(mapToEmployeeRow).filter((r): r is EmployeeRow => r !== null);
  if (rows.length === 0) return 0;

  // Deduplicate by email (case-insensitive) to avoid unique constraint on employees.email.
  // When Dynamics returns multiple records for the same email, keep one per email.
  const byEmail = new Map<string, EmployeeRow>();
  for (const row of rows) {
    const key = row.email?.toLowerCase() ?? row.employee_id;
    byEmail.set(key, row);
  }
  const deduped = Array.from(byEmail.values());

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("employees").upsert(deduped, {
    onConflict: "employee_id",
  });
  if (error) throw new Error(`Employees upsert failed: ${error.message}`);
  return deduped.length;
}

/** Upsert reporting lines: full replace (delete existing, insert current set). */
export async function syncReportingLines(): Promise<number> {
  const records = await fetchAllEmployeesFromDataverse();
  const lines = deriveReportingLines(records);
  if (lines.length === 0) return 0;

  const supabase = getSupabaseAdmin();
  const { error: delError } = await supabase.from("reporting_lines").delete().gte("id", "00000000-0000-0000-0000-000000000000");
  if (delError) throw new Error(`Reporting lines delete failed: ${delError.message}`);

  const { error: insError } = await supabase.from("reporting_lines").insert(
    lines.map(({ employee_id, manager_employee_id, is_primary, effective_from, effective_to, last_synced_at }) => ({
      employee_id,
      manager_employee_id,
      is_primary,
      effective_from,
      effective_to,
      last_synced_at,
    }))
  );
  if (insError) throw new Error(`Reporting lines insert failed: ${insError.message}`);
  return lines.length;
}
