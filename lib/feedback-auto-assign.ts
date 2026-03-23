import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Assign reviewers for a 360 participant (manager) using the appraisals table only:
 * - Their manager (row where employee_id = participant) → MANAGER reviewer
 * - Their direct reports (rows where manager_employee_id = participant) → DIRECT_REPORT reviewers
 */
export async function autoAssignReviewers(
  supabase: SupabaseClient,
  cycleId: string,
  participantEmployeeId: string
): Promise<{ assigned: number }> {
  console.log(`[360 assign] Processing ${participantEmployeeId}`);

  // Fetch this person's own appraisal row
  const { data: selfRow, error: selfErr } = await supabase
    .from("appraisals")
    .select("manager_employee_id, division_id")
    .eq("employee_id", participantEmployeeId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (selfErr) {
    console.error(`[360 assign] Appraisals self lookup error for ${participantEmployeeId}:`, selfErr);
  }

  const myManagerId = selfRow?.manager_employee_id ?? null;
  const myDivisionId = selfRow?.division_id ?? null;

  // Fetch direct reports
  const { data: directReportRows, error: drErr } = await supabase
    .from("appraisals")
    .select("employee_id")
    .eq("manager_employee_id", participantEmployeeId)
    .eq("is_active", true);

  if (drErr) {
    console.error(`[360 assign] Appraisals direct reports error for ${participantEmployeeId}:`, drErr);
    return { assigned: 0 };
  }

  const directReportIds = (directReportRows ?? [])
    .map((r) => r.employee_id as string | null | undefined)
    .filter((id): id is string => Boolean(id && id !== participantEmployeeId));

  console.log(
    `[360 assign] ${participantEmployeeId}: manager=${myManagerId ?? "none"}, reports=${directReportIds.length}, division=${myDivisionId ?? "none"}`
  );

  // Peer selection
  let peerCandidates: string[] = [];

  // Primary: same-manager peers
  if (myManagerId) {
    const { data: siblingRows, error: sibErr } = await supabase
      .from("appraisals")
      .select("employee_id")
      .eq("manager_employee_id", myManagerId)
      .eq("is_active", true)
      .neq("employee_id", participantEmployeeId);
    if (sibErr) {
      console.error(`[360 assign] Appraisals sibling peer lookup error for ${participantEmployeeId}:`, sibErr);
    }
    peerCandidates =
      siblingRows
        ?.map((r) => r.employee_id as string | null | undefined)
        .filter((id): id is string => Boolean(id && id !== participantEmployeeId)) ?? [];

    console.log(`[360 assign] ${participantEmployeeId}: ${peerCandidates.length} same-manager peers`);
  }

  // Fallback: same division if fewer than 2 peers
  if (peerCandidates.length < 2 && myDivisionId) {
    const { data: divisionRows, error: divErr } = await supabase
      .from("appraisals")
      .select("employee_id")
      .eq("division_id", myDivisionId)
      .eq("is_active", true)
      .neq("employee_id", participantEmployeeId);
    if (divErr) {
      console.error(`[360 assign] Appraisals division peer lookup error for ${participantEmployeeId}:`, divErr);
    }
    const divisionPeers =
      divisionRows
        ?.map((r) => r.employee_id as string | null | undefined)
        .filter((id): id is string => Boolean(id && !peerCandidates.includes(id))) ?? [];

    peerCandidates = [...new Set([...peerCandidates, ...divisionPeers])];
    console.log(
      `[360 assign] ${participantEmployeeId}: ${peerCandidates.length} total peers after division fallback`
    );
  }

  // Anonymity gate: need at least 2 peers; pick up to 3
  const peersToAssign: string[] = [];
  if (peerCandidates.length >= 2) {
    const shuffled = [...peerCandidates].sort(() => Math.random() - 0.5).slice(0, 3);
    peersToAssign.push(...shuffled);
    console.log(`[360 assign] ${participantEmployeeId}: assigning ${peersToAssign.length} peers`);
  } else {
    console.warn(
      `[360 assign] ${participantEmployeeId}: only ${peerCandidates.length} peer(s) — skipping (anonymity gate)`
    );
  }

  type UpsertRow = {
    cycle_id: string;
    participant_employee_id: string;
    reviewer_employee_id: string;
    reviewer_type: "SELF" | "MANAGER" | "DIRECT_REPORT" | "PEER";
    status: "Pending";
  };

  const reviewerRows: UpsertRow[] = [];

  // SELF
  reviewerRows.push({
    cycle_id: cycleId,
    participant_employee_id: participantEmployeeId,
    reviewer_employee_id: participantEmployeeId,
    reviewer_type: "SELF",
    status: "Pending",
  });

  // MANAGER
  if (myManagerId && myManagerId !== participantEmployeeId) {
    reviewerRows.push({
      cycle_id: cycleId,
      participant_employee_id: participantEmployeeId,
      reviewer_employee_id: myManagerId,
      reviewer_type: "MANAGER",
      status: "Pending",
    });
  }

  // DIRECT_REPORT
  for (const reportId of [...new Set(directReportIds)]) {
    reviewerRows.push({
      cycle_id: cycleId,
      participant_employee_id: participantEmployeeId,
      reviewer_employee_id: reportId,
      reviewer_type: "DIRECT_REPORT",
      status: "Pending",
    });
  }

  // PEER
  for (const peerId of peersToAssign) {
    reviewerRows.push({
      cycle_id: cycleId,
      participant_employee_id: participantEmployeeId,
      reviewer_employee_id: peerId,
      reviewer_type: "PEER",
      status: "Pending",
    });
  }

  console.log(`[360 assign] ${participantEmployeeId}: upserting ${reviewerRows.length} total reviewer rows`);

  const { error } = await supabase.from("feedback_reviewer").upsert(reviewerRows, {
    onConflict: "cycle_id,participant_employee_id,reviewer_employee_id,reviewer_type",
    ignoreDuplicates: true,
  });

  if (error) {
    console.error(`[360 assign] Upsert error for ${participantEmployeeId}:`, error);
    return { assigned: 0 };
  }

  return { assigned: reviewerRows.length };
}
