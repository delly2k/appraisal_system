import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase config");
  return createClient(url, key);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.employee_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: appraisalId } = await params;
    const supabase = getSupabaseAdmin();

    // Get the workplan for this appraisal
    const { data: workplan, error: wpErr } = await supabase
      .from("workplans")
      .select("id, status")
      .eq("appraisal_id", appraisalId)
      .single();

    if (wpErr || !workplan) {
      return NextResponse.json(
        { error: "Workplan not found" },
        { status: 404 }
      );
    }

    // Call the approve function
    const { data: result, error: approveErr } = await supabase.rpc(
      "approve_workplan",
      {
        p_workplan_id: workplan.id,
        p_manager_id: user.employee_id,
      }
    );

    if (approveErr) {
      return NextResponse.json({ error: approveErr.message }, { status: 500 });
    }

    if (!result?.success) {
      return NextResponse.json(
        { error: result?.error || "Approval failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
