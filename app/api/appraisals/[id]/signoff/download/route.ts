import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase config");
  return createClient(url, key);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: appraisalId } = await params;
    const supabase = getSupabaseAdmin();

    const { data: appraisal } = await supabase
      .from("appraisals")
      .select("id, employee_id, manager_employee_id, division_id")
      .eq("id", appraisalId)
      .single();

    if (!appraisal) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const roles = currentUser.roles ?? [];
    const empId = currentUser.employee_id ?? null;
    const canAccess =
      roles.includes("hr") ||
      roles.includes("admin") ||
      appraisal.employee_id === empId ||
      appraisal.manager_employee_id === empId ||
      (roles.includes("gm") && currentUser.division_id && appraisal.division_id === currentUser.division_id);

    if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: agreement } = await supabase
      .from("appraisal_agreements")
      .select("draft_pdf_path, signed_pdf_path, status")
      .eq("appraisal_id", appraisalId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const typeParam = req.nextUrl.searchParams.get("type");
    const isDraft = typeParam === "draft" || req.nextUrl.searchParams.get("draft") === "1";

    if (isDraft) {
      if (!agreement?.draft_pdf_path) {
        return NextResponse.json({ error: "Draft PDF not available" }, { status: 404 });
      }
      const { data: signed } = await supabase.storage
        .from("appraisal-pdfs")
        .createSignedUrl(agreement.draft_pdf_path, 3600);
      return NextResponse.json({ url: signed?.signedUrl ?? null });
    }

    if (agreement?.status !== "SIGNED" || !agreement.signed_pdf_path) {
      return NextResponse.json({ error: "Signed PDF not available" }, { status: 404 });
    }

    const { data: signed } = await supabase.storage
      .from("appraisal-pdfs")
      .createSignedUrl(agreement.signed_pdf_path, 3600);

    return NextResponse.json({ url: signed?.signedUrl ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
