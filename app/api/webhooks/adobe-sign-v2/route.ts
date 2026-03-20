import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { downloadSignedPDF } from "@/lib/adobe-sign";
import { sendNotification, type SupabaseLike } from "@/lib/notifications";
import { resolveDepartmentHeadSystemUserId } from "@/lib/hrmis-approval-auth";

// Adobe Sign webhook verification expects client ID echoed in response header.
export async function GET(req: NextRequest) {
  const verificationCode = req.nextUrl.searchParams.get("verificationCode");
  if (verificationCode) {
    return new NextResponse(verificationCode, { status: 200 });
  }

  const clientId = req.headers.get("x-adobesign-clientid");
  const response = new NextResponse("Webhook received", { status: 200 });
  response.headers.set("X-AdobeSign-ClientId", clientId ?? "");
  return response;
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase config");
  return createClient(url, key);
}

function normEmail(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function emailsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normEmail(a);
  const nb = normEmail(b);
  return na.length > 0 && nb.length > 0 && na === nb;
}

/** Adobe webhook payloads vary by account/version — try several paths. */
function extractAgreementId(body: Record<string, unknown>): string | undefined {
  const agreement = body.agreement as { id?: string } | undefined;
  if (agreement?.id) return agreement.id;
  const resource = body.resource as { id?: string } | undefined;
  if (resource?.id) return resource.id;
  const rid = body.resourceId ?? body.agreementId;
  if (typeof rid === "string" && rid) return rid;
  return undefined;
}

function extractWebhookEvent(body: Record<string, unknown>): string | undefined {
  const e = body.event;
  if (typeof e === "string" && e) return e;
  const nested = body.webhookNotificationInfo as { event?: string } | undefined;
  if (typeof nested?.event === "string" && nested.event) return nested.event;
  const webhookEvent = body.webhookEvent;
  if (typeof webhookEvent === "string" && webhookEvent) return webhookEvent;
  return undefined;
}

function extractParticipantEmail(body: Record<string, unknown>): string | undefined {
  const actionInfo = body.actionInfo as { participantEmail?: string } | undefined;
  if (actionInfo?.participantEmail) return actionInfo.participantEmail;
  const candidates = [
    body.participantUserEmail,
    body.actingUserEmail,
    body.participantEmail,
    (body.participantUserDetails as { email?: string } | undefined)?.email,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    console.log("[webhook] Failed to parse JSON body; exiting");
    return NextResponse.json({ ok: true });
  }

  const agreementObject = body.agreement as { id?: string; status?: string } | undefined;
  const eventType = body?.event as string;
  console.log("[webhook] Raw body received");
  console.log("[webhook] Event type:", eventType);
  console.log("[webhook] Adobe agreement ID:", body?.agreement?.id);
  console.log("[webhook] Participant email:", body?.participantUserEmail);
  console.log("[webhook] Agreement ID:", agreementObject?.id ?? "NONE");
  console.log("[webhook] Agreement status:", agreementObject?.status ?? "NONE");
  console.log("[webhook] Full payload:", JSON.stringify(body, null, 2));

  const agreementId = agreementObject?.id;
  console.log("[webhook] Checking event type match:", eventType ?? "UNKNOWN");

  if (!agreementId) {
    console.log("[webhook] No agreement ID found; exiting");
    return NextResponse.json({ ok: true });
  }

  const { data: agreement, error: aggErr } = await supabase
    .from("appraisal_agreements")
    .select("id, appraisal_id, employee_signed_at, manager_signed_at, hr_signed_at")
    .eq("adobe_agreement_id", agreementId)
    .maybeSingle();

  if (aggErr || !agreement) {
    console.log("[webhook] Agreement row not found in DB; exiting", {
      agreementId,
      aggErr: aggErr?.message ?? null,
    });
    return NextResponse.json({ ok: true });
  }

  const { data: appraisal, error: appErr } = await supabase
    .from("appraisals")
    .select("employee_id, manager_employee_id")
    .eq("id", agreement.appraisal_id)
    .single();

  if (appErr || !appraisal) {
    console.log("[webhook] Appraisal row not found in DB; exiting", {
      appraisalId: agreement.appraisal_id,
      appErr: appErr?.message ?? null,
    });
    return NextResponse.json({ ok: true });
  }

  const { data: emp } = await supabase
    .from("employees")
    .select("id, employee_id, email, full_name")
    .eq("employee_id", appraisal.employee_id)
    .single();
  const { data: mgr } = await supabase
    .from("employees")
    .select("id, employee_id, email, full_name")
    .eq("employee_id", appraisal.manager_employee_id)
    .single();

  const { data: managerUser } = await supabase
    .from("app_users")
    .select("role")
    .eq("employee_id", appraisal.manager_employee_id)
    .in("role", ["gm", "admin"])
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const hodEmployeeId = await resolveDepartmentHeadSystemUserId(appraisal.employee_id);
  const { data: hod } = hodEmployeeId
    ? await supabase
        .from("employees")
        .select("employee_id, email, full_name")
        .eq("employee_id", hodEmployeeId)
        .single()
    : { data: null };

  const managerActsAsFinalApprover =
    appraisal.manager_employee_id === hodEmployeeId || !!managerUser;
  const testOnlyEmployeeSigner = process.env.ALLOW_APPRAISAL_TEST_BYPASS === "true";
  const managerIsInChain = !testOnlyEmployeeSigner && !managerActsAsFinalApprover;
  const finalSignerEmployeeId = testOnlyEmployeeSigner
    ? appraisal.employee_id
    : (managerActsAsFinalApprover ? appraisal.manager_employee_id : hodEmployeeId);

  const actionInfo = body.actionInfo as { participantEmail?: string; comment?: string } | undefined;
  const signerEmail = (body?.participantUserEmail as string | undefined) ?? extractParticipantEmail(body);

  const runCompletedFlow = async () => {
    const signedPdfBuffer = await downloadSignedPDF(agreementId);
    const signedPath = `${agreement.appraisal_id}/signed-${Date.now()}.pdf`;

    await supabase.storage
      .from("appraisal-pdfs")
      .upload(signedPath, signedPdfBuffer, { contentType: "application/pdf" });

    const { data: urlData } = await supabase.storage
      .from("appraisal-pdfs")
      .createSignedUrl(signedPath, 60 * 60 * 24 * 365);

    const completedAt = new Date().toISOString();
    const completionUpdate: Record<string, string | null> = {
      status: "COMPLETED",
      signed_pdf_url: urlData?.signedUrl ?? null,
      signed_pdf_path: signedPath,
      employee_signed_at: agreement.employee_signed_at ?? completedAt,
      manager_signed_at: agreement.manager_signed_at ?? completedAt,
      hr_signed_at: agreement.hr_signed_at ?? completedAt,
      updated_at: completedAt,
    };

    await supabase.from("appraisal_agreements").update(completionUpdate).eq("id", agreement.id);

    await supabase
      .from("appraisals")
      .update({ status: "HOD_REVIEW" })
      .eq("id", agreement.appraisal_id);

    const recipients = Array.from(
      new Set(
        [appraisal.employee_id, managerIsInChain ? appraisal.manager_employee_id : null, finalSignerEmployeeId]
          .filter((v): v is string => Boolean(v))
      )
    );

    for (const recipientEmployeeId of recipients) {
      await sendNotification(
        {
          recipientEmployeeId,
          type: "SIGNOFF_COMPLETE",
          message: `Sign-off is complete for ${emp?.full_name ?? "Employee"}'s FY 2026 appraisal. The appraisal is now moving to HOD Review.`,
          appraisalId: agreement.appraisal_id,
        },
        supabase as unknown as SupabaseLike
      );
    }
  };

  switch (eventType) {
    case "AGREEMENT_ACTION_COMPLETED": {
      console.log("[webhook] Checking event type match:", eventType);
      const agreementStatus = String(agreementObject?.status ?? "").toUpperCase();
      if (agreementStatus === "SIGNED" || agreementStatus === "COMPLETED") {
        await runCompletedFlow();
        break;
      }

      if (agreementStatus === "OUT_FOR_SIGNATURE") {
        const updates: Record<string, string> = { updated_at: new Date().toISOString() };
        const now = new Date().toISOString();

        if (emailsMatch(signerEmail, emp?.email)) {
          updates.employee_signed_at = now;
          if (managerIsInChain && mgr?.employee_id) {
            await sendNotification(
              {
                recipientEmployeeId: mgr.employee_id,
                type: "SIGNOFF_ACTION_REQUIRED",
                message: `${emp?.full_name ?? "Employee"} has signed their appraisal. Check your email from Adobe Sign to add your signature.`,
                appraisalId: agreement.appraisal_id,
              },
              supabase as unknown as SupabaseLike
            );
          } else if (!testOnlyEmployeeSigner && !managerActsAsFinalApprover && hod?.employee_id) {
            await sendNotification(
              {
                recipientEmployeeId: hod.employee_id,
                type: "SIGNOFF_ACTION_REQUIRED",
                message: `${emp?.full_name ?? "Employee"} has signed their appraisal. Check your email from Adobe Sign to complete sign-off.`,
                appraisalId: agreement.appraisal_id,
              },
              supabase as unknown as SupabaseLike
            );
          }
        } else if (emailsMatch(signerEmail, mgr?.email)) {
          updates.manager_signed_at = now;
          if (hod?.employee_id) {
            await sendNotification(
              {
                recipientEmployeeId: hod.employee_id,
                type: "SIGNOFF_ACTION_REQUIRED",
                message: `Manager has signed the appraisal for ${emp?.full_name ?? "Employee"}. Check your email from Adobe Sign to complete sign-off.`,
                appraisalId: agreement.appraisal_id,
              },
              supabase as unknown as SupabaseLike
            );
          }
        } else if (emailsMatch(signerEmail, hod?.email)) {
          updates.hr_signed_at = now;
        }

        await supabase.from("appraisal_agreements").update(updates).eq("id", agreement.id);
      }
      break;
    }

    case "AGREEMENT_COMPLETED": {
      console.log("[webhook] Checking event type match:", eventType);
      await runCompletedFlow();
      break;
    }

    case "AGREEMENT_DECLINED": {
      console.log("[webhook] Checking event type match:", eventType);
      const declinerEmail = extractParticipantEmail(body) ?? (actionInfo?.participantEmail as string) ?? "";
      const declineReason = (actionInfo?.comment as string) ?? "";

      await supabase
        .from("appraisal_agreements")
        .update({
          status: "DECLINED",
          declined_by_email: declinerEmail,
          decline_reason: declineReason,
          declined_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", agreement.id);

      await supabase
        .from("appraisals")
        .update({ status: "MANAGER_REVIEW" })
        .eq("id", agreement.appraisal_id);

      if (mgr?.employee_id) {
        await sendNotification(
          {
            recipientEmployeeId: mgr.employee_id,
            type: "SIGNOFF_DECLINED",
            message: `${declinerEmail} has declined to sign the appraisal for ${emp?.full_name ?? "Employee"}. Reason: "${declineReason}". Please review and resubmit for sign-off.`,
            appraisalId: agreement.appraisal_id,
          },
          supabase as unknown as SupabaseLike
        );
      }
      break;
    }

    case "AGREEMENT_EXPIRED": {
      console.log("[webhook] Checking event type match:", eventType);
      await supabase
        .from("appraisal_agreements")
        .update({ status: "EXPIRED", updated_at: new Date().toISOString() })
        .eq("id", agreement.id);

      await supabase
        .from("appraisals")
        .update({ status: "MANAGER_REVIEW" })
        .eq("id", agreement.appraisal_id);

      if (finalSignerEmployeeId) {
        await sendNotification(
          {
            recipientEmployeeId: finalSignerEmployeeId,
            type: "SIGNOFF_EXPIRED",
            message: `The sign-off agreement for ${emp?.full_name ?? "Employee"}'s appraisal has expired after 30 days. The appraisal has been returned to Manager Review.`,
            appraisalId: agreement.appraisal_id,
          },
          supabase as unknown as SupabaseLike
        );
      }
      break;
    }

    case "AGREEMENT_RECALLED": {
      console.log("[webhook] Checking event type match:", eventType);
      await supabase
        .from("appraisal_agreements")
        .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
        .eq("id", agreement.id);
      break;
    }

    default:
      console.log("[webhook] No matching event type handler for:", eventType);
      break;
  }

  return NextResponse.json({ ok: true });
}
