import type { SupabaseClient } from "@supabase/supabase-js";
import { autoAssignReviewers } from "@/lib/feedback-auto-assign";
import {
  countFeedbackParticipants,
  seedParticipantsFromManagerHierarchy,
} from "@/lib/feedback-seed-participants";

export type ActivateCycleErrorCode = "NOT_FOUND" | "CLOSED" | "DB_ERROR";

export type ActivateCycleResult =
  | {
      ok: true;
      alreadySeeded: boolean;
      participantCount: number;
      status: string;
      /** Set when manager seeding ran in this request */
      participantsCreated?: number;
      skipped?: number;
    }
  | { ok: false; error: string; code: ActivateCycleErrorCode };

export type ActivateFeedbackCycleOptions = {
  /** When true, clears and re-seeds participants even if the cycle already has rows (e.g. bad prior seed). */
  reseed?: boolean;
};

/**
 * Activate an existing 360 feedback cycle by `id` only (never inserts `feedback_cycle` rows).
 * Seeds manager participants from distinct `appraisals.manager_employee_id`, then runs autoAssignReviewers.
 * Same behavior as POST /api/admin/feedback/cycles/[id]/activate.
 * Pass `{ reseed: true }` with `?reseed=1` to replace participants when the cycle already has rows.
 */
export async function activateFeedbackCycle(
  supabase: SupabaseClient,
  cycleId: string,
  options?: ActivateFeedbackCycleOptions
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
  if (!options?.reseed && participantCount > 0) {
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

  let participantsCreated: number | undefined;
  let skipped: number | undefined;

  if (options?.reseed || participantCount === 0) {
    const seed = await seedParticipantsFromManagerHierarchy(supabase, cycleId);
    participantsCreated = seed.inserted;
    skipped = seed.skipped;
    participantCount = await countFeedbackParticipants(supabase, cycleId);

    const { data: participants, error: partErr } = await supabase
      .from("feedback_participant")
      .select("employee_id")
      .eq("cycle_id", cycleId);

    if (partErr) {
      return { ok: false, error: partErr.message, code: "DB_ERROR" };
    }

    let totalAssigned = 0;
    for (const row of participants ?? []) {
      const eid = row.employee_id as string;
      if (!eid) continue;
      try {
        const { assigned } = await autoAssignReviewers(supabase, cycleId, eid);
        totalAssigned += assigned;
      } catch (err) {
        console.warn(`[activate] reviewer assignment failed for ${eid}:`, err);
      }
    }
    console.log(`[360 activate] Total reviewer assignment rows upserted: ${totalAssigned}`);
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
    ...(participantsCreated !== undefined ? { participantsCreated, skipped } : {}),
  };
}
