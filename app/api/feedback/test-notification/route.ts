import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sendFeedbackReviewRequest } from "@/lib/feedback-email";

/**
 * POST /api/feedback/test-notification
 * Manually send a single test 360 review request email via Microsoft Graph.
 * Body: { "toEmail": "recipient@example.com" }
 * Uses sample content: Employee Name "Test Participant", Cycle "Leadership Feedback 2026", Deadline "—".
 * Requires AZURE_AD_* and AZURE_FROM_EMAIL (Mail.Send application permission).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const toEmail = typeof body.toEmail === "string" ? body.toEmail.trim() : "";
    if (!toEmail) {
      return NextResponse.json(
        { error: "Body must include toEmail, e.g. { \"toEmail\": \"you@example.com\" }" },
        { status: 400 }
      );
    }

    await sendFeedbackReviewRequest({
      toEmail,
      participantName: "Test Participant",
      cycleName: "Leadership Feedback 2026",
      deadline: "—",
    });

    return NextResponse.json({
      ok: true,
      message: "Test notification sent to " + toEmail,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
