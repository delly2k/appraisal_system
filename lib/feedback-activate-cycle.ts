import type { SupabaseClient } from "@supabase/supabase-js";
import {
  backfillFeedbackParticipantsFromReportingLines,
  countFeedbackParticipants,
} from "@/lib/feedback-seed-participants";

export type ActivateCycleErrorCode = "NOT_FOUND" | "CLOSED" | "DB_ERROR";

export type ActivateCycleResult =
  | {
      ok: true;
      alreadySeeded: boolean;
      participantCount: number;
      status: string;
    }
  | { ok: false; error: string; code: ActivateCycleErrorCode };

/**
 * Activate a 360 feedback cycle and/or seed participants from reporting_lines.
 * Same behavior as POST /api/admin/feedback/cycles/[id]/activate (idempotent).
 */
export async function activateFeedbackCycle(
  supabase: SupabaseClient,
  cycleId: string
): Promise<ActivateCycleResult> {
  const { data: cycle, error: fetchErr } = await supabase
    .from("feedback_cycle")
    .select("id, status")
    .eq("id", cycleId)
    .maybeSingle();

  if (fetchErr || !cycle) {
    return { ok: false, error: "Cycle not found", code: "NOT_FOUND" };
  }

  if (cycle.status === "Closed") {
    return { ok: false, error: "Cannot initialize a closed cycle", code: "CLOSED" };
  }

  let participantCount = await countFeedbackParticipants(supabase, cycleId);
  if (participantCount > 0) {
    return {
      ok: true,
      alreadySeeded: true,
      participantCount,
      status: cycle.status,
    };
  }

  if (cycle.status === "Draft") {
    const { error: updErr } = await supabase
      .from("feedback_cycle")
      .update({ status: "Active" })
      .eq("id", cycleId)
      .eq("status", "Draft");

    if (updErr) {
      return { ok: false, error: updErr.message, code: "DB_ERROR" };
    }

    participantCount = await countFeedbackParticipants(supabase, cycleId);
  }

  if (participantCount === 0) {
    await backfillFeedbackParticipantsFromReportingLines(supabase, cycleId);
    participantCount = await countFeedbackParticipants(supabase, cycleId);
  }

  const { data: finalCycle } = await supabase
    .from("feedback_cycle")
    .select("status")
    .eq("id", cycleId)
    .maybeSingle();

  return {
    ok: true,
    alreadySeeded: false,
    participantCount,
    status: finalCycle?.status ?? cycle.status,
  };
}
