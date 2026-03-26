import { createDataverseApiClient } from "@/lib/dynamics-sync";

let cache: Map<string, string> | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000;

function normGuid(id: string): string {
  return String(id).replace(/^\{|\}$/g, "").trim().toLowerCase();
}

/** Full GUIDs from CSV / appraisals data; used when Dataverse is empty or unreachable. */
const HARDCODED_DEPARTMENTS: [string, string][] = [
  ["265565d1-d0a5-ea11-a812-000d3a35bad3", "Finance & Treasury"],
  ["307d185b-0f7a-ec11-8d21-000d3a3538ba", "Project Management Office (PMO)"],
  ["d39f856a-b8a5-ea11-a812-000d3a35b8ce", "HRD & Administration"],
  ["b463f348-39e0-eb11-bacb-00224808d60a", "Channels, Relationships & Marketing (CRM)"],
  ["2b171281-d3a5-ea11-a812-000d3a35bc16", "PPP & Privatization (P4)"],
  ["64794e36-b8a5-ea11-a812-000d3a35b8ce", "Managing Director's Office"],
  ["205565d1-d0a5-ea11-a812-000d3a35bad3", "Management Information Systems"],
  ["245565d1-d0a5-ea11-a812-000d3a35bad3", "Audit Services"],
  ["225565d1-d0a5-ea11-a812-000d3a35bad3", "Legal Services"],
  ["27d0d646-e1a5-ea11-a812-000d3a35b8ce", "Risk & Compliance"],
  ["2f171281-d3a5-ea11-a812-000d3a35bc16", "Strategic Services"],
  ["a1ed07a3-6ede-eb11-bacb-00224808d60a", "Test Department"],
  ["56bbab2b-948a-ec11-93b0-0022480a1105", "Credit Enhancement Fund (CEF)"],
  ["f788424e-36e0-eb11-bacb-00224808d60a", "Investor Relationship"],
  ["e9af9d1c-dda7-ec11-983f-000d3a34937b", "BIGEE"],
  ["ff40a26c-e1a5-ea11-a812-000d3a35b8ce", "Registry"],
  ["192ca675-e1a5-ea11-a812-000d3a35b8ce", "Cafeteria"],
  ["b0db3f24-e1a5-ea11-a812-000d3a35b8ce", "Private Capital Programme"],
  ["49aac10e-81da-eb11-bacb-000d3a3202f2", "Support Systems"],
  ["845feed3-80da-eb11-bacb-000d3a3202f2", "Related Companies"],
  ["d5b4969a-80da-eb11-bacb-000d3a3202f2", "General Ledger"],
  ["b07fbfba-80da-eb11-bacb-000d3a3202f2", "Loans"],
  ["735686f0-80da-eb11-bacb-000d3a3202f2", "Pension Fund"],
  ["36fd38d8-35e0-eb11-bacb-00224808d60a", "Intermediary Relationships"],
  ["02208732-36e0-eb11-bacb-00224808d60a", "Service Quality & Customer Experience"],
  ["46f95f56-e1a5-ea11-a812-000d3a35b8ce", "Communication & Public Relations"],
  ["43074ac8-9056-ef11-a316-000d3a333647", "Procurement"],
  ["bd38582c-0e30-f011-8c4e-000d3a332d23", "Administration"],
  ["c5338b48-928a-ec11-93b0-0022480a1105", "Marketing"],
  ["8e7a31f6-7eda-eb11-bacb-000d3a3202f2", "Quality Assurance"],
  ["07b28d2c-7ade-eb11-bacb-00224808d60a", "Development Bank of Jamaica"],
];

function hardcodedDepartmentMap(): Map<string, string> {
  const m = new Map<string, string>();
  for (const [id, name] of HARDCODED_DEPARTMENTS) {
    m.set(normGuid(id), name);
  }
  return m;
}

/**
 * Division id → display name (cached 1h).
 * Loads from Dataverse `xrm1_departments` (xrm1_departmentid / xrm1_name); falls back to a static map from CSV.
 */
export async function getDivisionNames(): Promise<Map<string, string>> {
  const now = Date.now();
  if (cache && now - cacheTime < CACHE_TTL_MS) {
    return cache;
  }

  const hasUrl = Boolean(process.env.DYNAMICS_DATAVERSE_URL?.trim());
  if (!hasUrl) {
    const fallback = hardcodedDepartmentMap();
    console.log(`[divisions] DYNAMICS_DATAVERSE_URL missing; hardcoded fallback: ${fallback.size} departments`);
    cache = fallback;
    cacheTime = now;
    return cache;
  }

  try {
    const client = await createDataverseApiClient();
    const res = await client.get<{
      value?: Array<{ xrm1_departmentid?: string; xrm1_name?: string }>;
    }>(
      "/xrm1_departments?$select=xrm1_departmentid,xrm1_name&$filter=statecode eq 0&$top=200"
    );

    const map = new Map<string, string>();
    for (const dept of res.data?.value ?? []) {
      const id = dept.xrm1_departmentid;
      const name = dept.xrm1_name;
      if (id != null && String(id).trim() && name != null && String(name).trim()) {
        map.set(normGuid(String(id)), String(name).trim());
      }
    }

    if (map.size > 0) {
      console.log(`[divisions] loaded ${map.size} departments from xrm1_departments`);
      cache = map;
      cacheTime = now;
      return cache;
    }

    console.warn("[divisions] xrm1_departments returned 0 results");
  } catch (e: unknown) {
    const ax = e as { response?: { status?: number }; message?: string };
    console.error("[divisions] xrm1_departments failed:", ax?.response?.status, ax?.message ?? e);
  }

  const hardcoded = hardcodedDepartmentMap();
  console.log(`[divisions] using hardcoded fallback: ${hardcoded.size} departments`);
  cache = hardcoded;
  cacheTime = now;
  return cache;
}

export async function resolveDivisionName(divisionId: string | null | undefined): Promise<string> {
  if (divisionId == null || String(divisionId).trim() === "") return "Unassigned";
  const m = await getDivisionNames();
  return m.get(normGuid(divisionId)) ?? "Unknown division";
}

/** Resolve many GUIDs; keys in the returned map are the original id strings passed in. */
export async function resolveDivisionNames(divisionIds: string[]): Promise<Map<string, string>> {
  const m = await getDivisionNames();
  const result = new Map<string, string>();
  for (const raw of divisionIds) {
    if (!raw || raw === "__unassigned__") continue;
    result.set(raw, m.get(normGuid(raw)) ?? "Unknown division");
  }
  return result;
}
