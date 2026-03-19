import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { downloadSignedPDF } from "@/lib/adobe-sign";
import { sendNotification, type SupabaseLike } from "@/lib/notifications";

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

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const event = body.event as string | undefined;
  const agreementId = (body.agreement as { id?: string })?.id as string | undefined;

  if (!agreementId) return NextResponse.json({ ok: true });

  const { data: agreement, error: aggErr } = await supabase
    .from("appraisal_agreements")
    .select("id, appraisal_id, employee_signed_at, manager_signed_at, hr_signed_at")
    .eq("adobe_agreement_id", agreementId)
    .maybeSingle();

  if (aggErr || !agreement) return NextResponse.json({ ok: true });

  const { data: appraisal, error: appErr } = await supabase
    .from("appraisals")
    .select("employee_id, manager_employee_id")
    .eq("id", agreement.appraisal_id)
    .single();

  if (appErr || !appraisal) return NextResponse.json({ ok: true });

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

  const { data: hrUser } = await supabase
    .from("app_users")
    .select("employee_id, email, display_name")
    .in("role", ["hr", "admin"])
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  let hrOfficerEmployeeId: string | null = null;
  if (hrUser?.employee_id) hrOfficerEmployeeId = hrUser.employee_id;

  const actionInfo = body.actionInfo as { participantEmail?: string; comment?: string } | undefined;
  const signerEmail = actionInfo?.participantEmail as string | undefined;

  switch (event) {
    case "AGREEMENT_ACTION_COMPLETED": {
      const updates: Record<string, string> = { updated_at: new Date().toISOString() };

      if (signerEmail === emp?.email) {
        updates.employee_signed_at = new Date().toISOString();
        if (mgr?.employee_id) {
          await sendNotification(
            {
              recipientEmployeeId: mgr.employee_id,
              type: "SIGNOFF_ACTION_REQUIRED",
              message: `${emp?.full_name ?? "Employee"} has signed their appraisal. Check your email from Adobe Sign to add your signature.`,
              appraisalId: agreement.appraisal_id,
            },
            supabase as unknown as SupabaseLike
          );
        }
      } else if (signerEmail === mgr?.email) {
        updates.manager_signed_at = new Date().toISOString();
        if (hrOfficerEmployeeId) {
          await sendNotification(
            {
              recipientEmployeeId: hrOfficerEmployeeId,
              type: "SIGNOFF_ACTION_REQUIRED",
              message: `Manager has signed the appraisal for ${emp?.full_name ?? "Employee"}. Check your email from Adobe Sign to complete sign-off.`,
              appraisalId: agreement.appraisal_id,
            },
            supabase as unknown as SupabaseLike
          );
        }
      } else {
        updates.hr_signed_at = new Date().toISOString();
      }

      await supabase.from("appraisal_agreements").update(updates).eq("id", agreement.id);
      break;
    }

    case "AGREEMENT_COMPLETED": {
      const signedPdfBuffer = await downloadSignedPDF(agreementId);
      const signedPath = `${agreement.appraisal_id}/signed-${Date.now()}.pdf`;

      await supabase.storage
        .from("appraisal-pdfs")
        .upload(signedPath, signedPdfBuffer, { contentType: "application/pdf" });

      const { data: urlData } = await supabase.storage
        .from("appraisal-pdfs")
        .createSignedUrl(signedPath, 60 * 60 * 24 * 365);

      await supabase
        .from("appraisal_agreements")
        .update({
          status: "SIGNED",
          signed_pdf_url: urlData?.signedUrl ?? null,
          signed_pdf_path: signedPath,
          hr_signed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", agreement.id);

      await supabase
        .from("appraisals")
        .update({ status: "HOD_REVIEW" })
        .eq("id", agreement.appraisal_id);

      const recipients = [appraisal.employee_id, appraisal.manager_employee_id].filter(Boolean);
      if (hrOfficerEmployeeId) recipients.push(hrOfficerEmployeeId);

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
      break;
    }

    case "AGREEMENT_DECLINED": {
      const declinerEmail = (actionInfo?.participantEmail as string) ?? "";
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
      await supabase
        .from("appraisal_agreements")
        .update({ status: "EXPIRED", updated_at: new Date().toISOString() })
        .eq("id", agreement.id);

      await supabase
        .from("appraisals")
        .update({ status: "MANAGER_REVIEW" })
        .eq("id", agreement.appraisal_id);

      if (hrOfficerEmployeeId) {
        await sendNotification(
          {
            recipientEmployeeId: hrOfficerEmployeeId,
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
      await supabase
        .from("appraisal_agreements")
        .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
        .eq("id", agreement.id);
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ ok: true });
}
