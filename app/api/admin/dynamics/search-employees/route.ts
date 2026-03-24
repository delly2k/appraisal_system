import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDataverseAccessToken } from "@/lib/dynamics-sync";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  const isAdmin = user?.roles?.some((r) => r === "hr" || r === "admin");
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  try {
    const token = await getDataverseAccessToken();
    const baseUrl = process.env.DYNAMICS_DATAVERSE_URL?.trim().replace(/\/$/, "");
    if (!baseUrl) return NextResponse.json({ results: [] });

    const escaped = q.replace(/'/g, "''");
    const filter =
      `(contains(fullname,'${escaped}') or contains(internalemailaddress,'${escaped}')) and isdisabled eq false`;
    const select = "systemuserid,fullname,internalemailaddress,title";
    const expand = encodeURIComponent("businessunitid($select=name,businessunitid)");
    let url =
      `${baseUrl}/api/data/v9.2/systemusers?$filter=${encodeURIComponent(filter)}` +
      `&$select=${select}&$expand=${expand}&$top=10&$orderby=fullname asc`;

    let res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      url =
        `${baseUrl}/api/data/v9.2/systemusers?$filter=${encodeURIComponent(filter)}` +
        `&$select=${select},businessunitid&$top=10&$orderby=fullname asc`;
      res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "OData-MaxVersion": "4.0",
          "OData-Version": "4.0",
          Accept: "application/json",
        },
        cache: "no-store",
      });
    }

    if (!res.ok) {
      const err = await res.text();
      console.error("[dynamics search] error:", err);
      return NextResponse.json({ results: [] });
    }

    const parseBusinessUnit = (u: Record<string, unknown>): { division_id: string | null; division_name: string | null } => {
      const bu = u.businessunitid;
      if (bu && typeof bu === "object" && bu !== null) {
        const o = bu as Record<string, unknown>;
        const id = typeof o.businessunitid === "string" ? o.businessunitid : null;
        const name = typeof o.name === "string" ? o.name : null;
        return { division_id: id, division_name: name };
      }
      if (typeof bu === "string" && bu.length > 0) {
        return { division_id: bu, division_name: null };
      }
      return { division_id: null, division_name: null };
    };

    const data = (await res.json()) as { value?: Array<Record<string, unknown>> };
    const results = (data.value ?? []).map((u) => {
      const { division_id, division_name } = parseBusinessUnit(u);
      return {
        employee_id: String(u.systemuserid ?? ""),
        full_name: String(u.fullname ?? ""),
        email: String(u.internalemailaddress ?? ""),
        title: typeof u.title === "string" ? u.title : null,
        division_id,
        division_name,
      };
    });

    return NextResponse.json({ results });
  } catch (err) {
    console.error("[dynamics search] exception:", err);
    return NextResponse.json({ results: [] });
  }
}
