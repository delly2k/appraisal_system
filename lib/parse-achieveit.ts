import * as XLSX from "xlsx";

export interface CorporateObjectiveRow {
  achieveit_id: string;
  order_ref: string;
  perspective: string | null;
  name: string;
  description: string | null;
  status: string | null;
}

export interface DepartmentObjectiveRow {
  achieveit_id: string;
  order_ref: string;
  name: string;
  description: string | null;
  status: string | null;
  division: string | null;
  assigned_to: string | null;
  corporate_order: string;
}

export interface ParseResult {
  corporateObjectives: CorporateObjectiveRow[];
  departmentObjectives: DepartmentObjectiveRow[];
  errors: string[];
}

function parseDivision(members: string | null | undefined): string | null {
  if (!members) return null;
  const first = members.split(",").map((s) => s.trim()).find((s) => s && !s.includes("@"));
  return first ?? null;
}

function parentOrder(order: string): string {
  return order.split(".").slice(0, -1).join(".");
}

export function parseAchieveItExcel(buffer: ArrayBuffer): ParseResult {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as (string | null)[][];

  const headers = rows[0] as string[];
  const col = (name: string) => headers.indexOf(name);

  const iOrder = col("Order");
  const iLevel = col("Level");
  const iName = col("Name");
  const iDesc = col("Description");
  const iStatus = col("Status");
  const iAssign = col("Assigned To");
  const iMembers = col("Members");
  const iId = col("Id");

  const corporateObjectives: CorporateObjectiveRow[] = [];
  const departmentObjectives: DepartmentObjectiveRow[] = [];
  const errors: string[] = [];
  const perspectiveMap: Record<string, string> = {};

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const level = row[iLevel];
    if (!level) continue;

    const order = String(row[iOrder] ?? "").trim();
    const name = String(row[iName] ?? "").trim();
    const extId = String(row[iId] ?? "").trim();

    if (!order || !name) continue;

    if (level === "Balanced Scorecard Perspective") {
      perspectiveMap[order] = name;
    } else if (level === "Corporate Objective") {
      const perspOrder = order.split(".")[0];
      corporateObjectives.push({
        achieveit_id: extId,
        order_ref: order,
        perspective: perspectiveMap[perspOrder] ?? null,
        name,
        description: row[iDesc] ? String(row[iDesc]) : null,
        status: row[iStatus] ? String(row[iStatus]) : null,
      });
    } else if (level === "Department Objective") {
      departmentObjectives.push({
        achieveit_id: extId,
        order_ref: order,
        name,
        description: row[iDesc] ? String(row[iDesc]) : null,
        status: row[iStatus] ? String(row[iStatus]) : null,
        division: parseDivision(row[iMembers] as string),
        assigned_to: row[iAssign] ? String(row[iAssign]) : null,
        corporate_order: parentOrder(order),
      });
    }
  }

  if (corporateObjectives.length === 0) {
    errors.push(
      'No Corporate Objectives found. Ensure the file has a "Level" column with "Corporate Objective" rows.'
    );
  }

  return { corporateObjectives, departmentObjectives, errors };
}
