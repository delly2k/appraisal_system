import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { canAccessEvidenceForEmployee } from "@/lib/evidence-auth";
import { getGraphToken } from "@/lib/azure-graph-token";
import { EVIDENCE_WEIGHTS } from "@/lib/evidence-weights";
import { createHash } from "crypto";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase config required");
  return createClient(url, key);
}

const GRAPH_BASE = process.env.AZURE_GRAPH_BASE_URL ?? "https://graph.microsoft.com/v1.0";

const NOISE_EXTENSIONS = [".pdf", ".mp4", ".mp3", ".csv", ".tmp"];
const NOISE_PREFIXES = ["Invoice-", "Receipt-", "October-Orbit", "Stride"];

async function processFiles(
  files: Array<{
    id?: string;
    name?: string;
    folder?: unknown;
    size?: number;
    lastModifiedDateTime?: string;
    createdDateTime?: string;
    webUrl?: string;
  }>,
  employeeId: string,
  reviewStart: string,
  reviewEnd: string,
  supabase: SupabaseClient
): Promise<{ count: number; raw: number; dropped: Record<string, number> }> {
  let count = 0;
  const dropped: Record<string, number> = {
    folder: 0,
    tooSmall: 0,
    noiseExt: 0,
    noisePrefix: 0,
    outsideRange: 0,
  };

  for (const file of files) {
    if (file.folder) {
      dropped.folder++;
      continue;
    }
    if ((file.size ?? 0) < 1024) {
      dropped.tooSmall++;
      continue;
    }

    const ext = ("." + (file.name ?? "").split(".").pop()).toLowerCase();
    const nameStart = file.name ?? "";
    if (NOISE_EXTENSIONS.includes(ext)) {
      dropped.noiseExt++;
      continue;
    }
    if (NOISE_PREFIXES.some((p) => nameStart.startsWith(p))) {
      dropped.noisePrefix++;
      continue;
    }

    const lastModified = (file.lastModifiedDateTime ?? "").slice(0, 10);
    const created = (file.createdDateTime ?? "").slice(0, 10);

    if (!lastModified || lastModified < reviewStart || lastModified > reviewEnd) {
      dropped.outsideRange++;
      continue;
    }

    const wasCreatedInPeriod = created >= reviewStart;
    const activityType = wasCreatedInPeriod ? "document_created" : "document_edited";
    const weight = EVIDENCE_WEIGHTS[activityType] ?? 50;

    const fingerprint = createHash("md5")
      .update(`sharepoint:${activityType}:${file.name ?? ""}:${lastModified}:${file.id ?? ""}`)
      .digest("hex");

    const { error } = await supabase
      .from("evidence_items")
      .upsert(
        {
          employee_id: employeeId,
          source_system: "sharepoint",
          activity_type: activityType,
          title: file.name ?? "Untitled document",
          description: null,
          activity_date: lastModified,
          reference_url: file.webUrl ?? null,
          confidence_weight: weight,
          fingerprint,
        },
        { onConflict: "fingerprint", ignoreDuplicates: true }
      );

    if (!error) count++;
  }

  return { count, raw: files.length, dropped };
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { employeeId, reviewStart, reviewEnd, graphToken: passedToken } = body as {
      employeeId: string;
      reviewStart?: string;
      reviewEnd?: string;
      graphToken?: string | null;
    };
    if (!employeeId) return NextResponse.json({ error: "Missing employeeId" }, { status: 400 });

    if (!canAccessEvidenceForEmployee(user, employeeId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const token = passedToken ?? (await getGraphToken());
    if (!token) {
      console.warn("[sharepoint-collector] No Graph token — returning stub");
      return NextResponse.json({
        collected: 0,
        note: "Azure Graph not connected",
        diagnosis: { oneDrive: { raw: 0, stored: 0 }, sharePoint: { raw: 0, stored: 0 }, totalStored: 0 },
      });
    }

    const supabase = getSupabaseAdmin();

    const { data: employee } = await supabase
      .from("employees")
      .select("email, aad_object_id")
      .eq("employee_id", employeeId)
      .single();

    if (!employee?.email) {
      console.warn("[sharepoint-collector] No email for employee", employeeId);
      return NextResponse.json({
        collected: 0,
        diagnosis: { oneDrive: { raw: 0, stored: 0 }, sharePoint: { raw: 0, stored: 0 }, totalStored: 0 },
      });
    }

    const userId = employee.aad_object_id ?? employee.email;
    const startDate = reviewStart ?? new Date().toISOString().slice(0, 10);
    const endDate = reviewEnd ?? startDate;
    let collected = 0;
    let oneDriveRaw = 0;
    let oneDriveStored = 0;
    let sharePointRaw = 0;
    let sharePointStored = 0;

    try {
      const res = await fetch(
        `${GRAPH_BASE}/users/${encodeURIComponent(userId)}/drive/root/search(q='')`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = (await res.json()) as { value?: Array<Record<string, unknown>> };
        const od = await processFiles(
          (data.value ?? []) as Parameters<typeof processFiles>[0],
          employeeId,
          startDate,
          endDate,
          supabase
        );
        oneDriveRaw = od.raw;
        oneDriveStored = od.count;
        collected += od.count;
      } else {
        console.warn("[sharepoint-collector] OneDrive search failed:", await res.text());
      }
    } catch (e) {
      console.warn("[sharepoint-collector] OneDrive error:", e);
    }

    try {
      const drivesRes = await fetch(
        `${GRAPH_BASE}/users/${encodeURIComponent(userId)}/drives`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (drivesRes.ok) {
        const drivesData = (await drivesRes.json()) as {
          value?: Array<{ id: string; name?: string; driveType?: string }>;
        };
        const drives = drivesData.value ?? [];

        for (const drive of drives) {
          if (drive.driveType === "personal") continue;

          try {
            const itemsRes = await fetch(
              `${GRAPH_BASE}/drives/${drive.id}/root/search(q='')`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (itemsRes.ok) {
              const itemsData = (await itemsRes.json()) as { value?: Array<Record<string, unknown>> };
              const sp = await processFiles(
                (itemsData.value ?? []) as Parameters<typeof processFiles>[0],
                employeeId,
                startDate,
                endDate,
                supabase
              );
              sharePointRaw += sp.raw;
              sharePointStored += sp.count;
              collected += sp.count;
            }
          } catch (e) {
            console.warn("[sharepoint-collector] Drive", drive.id, "error:", e);
          }
        }
      } else {
        console.warn("[sharepoint-collector] Drives list failed:", await drivesRes.text());
      }
    } catch (e) {
      console.warn("[sharepoint-collector] SharePoint drives error:", e);
    }

    console.log(
      `[sharepoint-collector] oneDrive: raw=${oneDriveRaw} stored=${oneDriveStored} | sharePoint: raw=${sharePointRaw} stored=${sharePointStored} | total=${collected}`
    );

    return NextResponse.json({
      collected,
      diagnosis: {
        oneDrive: { raw: oneDriveRaw, stored: oneDriveStored },
        sharePoint: { raw: sharePointRaw, stored: sharePointStored },
        totalStored: collected,
      },
    });
  } catch (e) {
    console.error("[evidence/collect/sharepoint]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
