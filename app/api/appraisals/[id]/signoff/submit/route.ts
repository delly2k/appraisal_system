import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { generateAppraisalPDF } from "@/lib/appraisal-pdf";
import { uploadTransientDocument, createAgreement } from "@/lib/adobe-sign";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase config");
  return createClient(url, key);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // #region agent log
    const paramsResolved = await params;
    const appraisalIdFromParams = paramsResolved?.id;
    fetch("http://127.0.0.1:7442/ingest/3c624e64-95d6-4fd6-a7c9-facfd0a29264", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "d0ea48" },
      body: JSON.stringify({
        sessionId: "d0ea48",
        runId: "signoff-submit",
        hypothesisId: "A_B",
        location: "signoff/submit/route.ts:POST entry",
        message: "signoff/submit POST handler entered",
        data: { hasParams: !!paramsResolved, appraisalId: appraisalIdFromParams, paramsKeys: paramsResolved ? Object.keys(paramsResolved) : [] },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    const currentUser = await getCurrentUser();
    if (!currentUser?.id) {
      // #region agent log
      fetch("http://127.0.0.1:7442/ingest/3c624e64-95d6-4fd6-a7c9-facfd0a29264", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "d0ea48" },
        body: JSON.stringify({
          sessionId: "d0ea48",
          runId: "signoff-submit",
          hypothesisId: "E",
          location: "signoff/submit/route.ts:401",
          message: "returning 401 Unauthorized",
          data: {},
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: appraisalId } = paramsResolved;
    const supabase = getSupabaseAdmin();

    const { data: appraisal, error: appErr } = await supabase
      .from("appraisals")
      .select("id, employee_id, manager_employee_id, status, manager_comments")
      .eq("id", appraisalId)
      .single();

    // #region agent log
    fetch("http://127.0.0.1:7442/ingest/3c624e64-95d6-4fd6-a7c9-facfd0a29264", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "d0ea48" },
      body: JSON.stringify({
        sessionId: "d0ea48",
        runId: "signoff-submit",
        hypothesisId: "C_D",
        location: "signoff/submit/route.ts:after appraisal query",
        message: "appraisal fetch result",
        data: {
          appraisalId,
          appErrMessage: appErr?.message ?? null,
          appErrCode: appErr?.code ?? null,
          hasAppraisal: !!appraisal,
          willReturn404: !!(appErr || !appraisal),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    if (appErr || !appraisal) {
      // #region agent log
      console.log("[signoff/submit] 404 reason:", {
        appraisalId,
        appErrMessage: appErr?.message ?? null,
        appErrCode: appErr?.code ?? null,
        appErrDetails: appErr ?? null,
        hasAppraisal: !!appraisal,
      });
      // #endregion
      return NextResponse.json(
        { error: "Not found", debug: { appErr: appErr?.message ?? null, appraisalId } },
        { status: 404 }
      );
    }

    const isManager = appraisal.manager_employee_id === currentUser.employee_id;
    const isHR = currentUser.roles?.some((r) => r === "hr" || r === "admin");
    if (!isManager && !isHR) {
      return NextResponse.json({ error: "Only the manager or HR may submit for sign-off" }, { status: 403 });
    }
    if (appraisal.status !== "MANAGER_REVIEW") {
      return NextResponse.json({ error: "Appraisal must be in MANAGER_REVIEW status" }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from("appraisal_agreements")
      .select("id")
      .eq("appraisal_id", appraisalId)
      .in("status", ["OUT_FOR_SIGNATURE"])
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "An active sign-off agreement already exists" }, { status: 400 });
    }

    const { data: emp } = await supabase
      .from("employees")
      .select("full_name, email")
      .eq("employee_id", appraisal.employee_id)
      .single();
    const { data: mgr } = await supabase
      .from("employees")
      .select("full_name, email")
      .eq("employee_id", appraisal.manager_employee_id)
      .single();

    if (!emp?.email) return NextResponse.json({ error: "Employee email not found" }, { status: 400 });
    if (!mgr?.email) return NextResponse.json({ error: "Manager email not found" }, { status: 400 });

    const { data: hrUser } = await supabase
      .from("app_users")
      .select("employee_id, email, display_name")
      .in("role", ["hr", "admin"])
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!hrUser?.email) return NextResponse.json({ error: "No HR officer configured" }, { status: 500 });

    let hrName = hrUser.display_name ?? hrUser.email;
    if (hrUser.employee_id) {
      const { data: hrEmp } = await supabase
        .from("employees")
        .select("full_name")
        .eq("employee_id", hrUser.employee_id)
        .single();
      if (hrEmp?.full_name) hrName = hrEmp.full_name;
    }

    const body = await req.json().catch(() => ({}));
    if (body.managerComments != null) {
      await supabase
        .from("appraisals")
        .update({ manager_comments: body.managerComments })
        .eq("id", appraisalId);
    }

    const pdfBuffer = await generateAppraisalPDF(appraisalId);

    const draftPath = `${appraisalId}/draft-${Date.now()}.pdf`;
    const { error: storageError } = await supabase.storage
      .from("appraisal-pdfs")
      .upload(draftPath, pdfBuffer, { contentType: "application/pdf" });

    if (storageError) {
      return NextResponse.json({ error: `Storage upload failed: ${storageError.message}` }, { status: 500 });
    }

    const filename = `Appraisal_${(emp.full_name ?? "Employee").replace(/\s/g, "_")}_FY2026.pdf`;
    const transientId = await uploadTransientDocument(pdfBuffer, filename);

    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/webhooks/adobe-sign`;
    const agreementId = await createAgreement({
      transientDocumentId: transientId,
      agreementName: `FY 2026 Annual Appraisal — ${emp.full_name ?? "Employee"}`,
      employee: { email: emp.email, name: emp.full_name ?? "Employee" },
      manager: { email: mgr.email, name: mgr.full_name ?? "Manager" },
      hrOfficer: { email: hrUser.email, name: hrName },
      webhookUrl,
    });

    await supabase.from("appraisal_agreements").insert({
      appraisal_id: appraisalId,
      adobe_agreement_id: agreementId,
      status: "OUT_FOR_SIGNATURE",
      draft_pdf_path: draftPath,
      initiated_by: currentUser.employee_id ?? null,
    });

    await supabase
      .from("appraisals")
      .update({ status: "PENDING_SIGNOFF" })
      .eq("id", appraisalId);

    return NextResponse.json({ success: true, agreementId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
