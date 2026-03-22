import type { SupabaseClient } from "@supabase/supabase-js";

type EmployeeRow = {
  employee_id: string;
  full_name: string | null;
  department_id?: string | null;
  manager_employee_id?: string | null;
  is_manager?: boolean | null;
};

function pickRandom<T>(arr: T[], count: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

export async function autoAssignReviewers(
  supabase: SupabaseClient,
  cycleId: string,
  revieweeEmployeeId: string
): Promise<void> {
  const { data: reviewee } = await supabase
    .from("employees")
    .select("employee_id, full_name, department_id, manager_employee_id, is_manager")
    .eq("employee_id", revieweeEmployeeId)
    .eq("is_active", true)
    .maybeSingle<EmployeeRow>();
  if (!reviewee) return;

  const { data: directReports } = await supabase
    .from("employees")
    .select("employee_id, full_name, department_id, manager_employee_id")
    .eq("manager_employee_id", revieweeEmployeeId)
    .eq("is_active", true);

  const direct = (directReports ?? []) as EmployeeRow[];
  const isManagerLevel = !!reviewee.is_manager || direct.length > 0;
  if (!isManagerLevel) return;

  const directIds = new Set(direct.map((d) => d.employee_id));
  const managerId = reviewee.manager_employee_id ?? null;

  let peerPool: EmployeeRow[] = [];
  if (reviewee.department_id) {
    const { data: peers } = await supabase
      .from("employees")
      .select("employee_id, full_name, department_id, manager_employee_id")
      .eq("department_id", reviewee.department_id)
      .eq("is_active", true)
      .neq("employee_id", revieweeEmployeeId);
    peerPool = (peers ?? []) as EmployeeRow[];
  }

  const peersFiltered = peerPool.filter((p) => {
    if (!p.employee_id) return false;
    if (directIds.has(p.employee_id)) return false;
    if (managerId && p.employee_id === managerId) return false;
    return true;
  });
  const pickedPeers = pickRandom(peersFiltered, 2);

  const assignments: { reviewer_employee_id: string; reviewer_type: "DIRECT_REPORT" | "PEER" | "MANAGER" }[] = [];
  for (const dr of direct) assignments.push({ reviewer_employee_id: dr.employee_id, reviewer_type: "DIRECT_REPORT" });
  for (const peer of pickedPeers) assignments.push({ reviewer_employee_id: peer.employee_id, reviewer_type: "PEER" });
  if (managerId) assignments.push({ reviewer_employee_id: managerId, reviewer_type: "MANAGER" });

  if (assignments.length === 0) return;

  // Keep at most 2 PEER reviewers by pruning old/random extras first.
  const { data: existingPeers } = await supabase
    .from("feedback_reviewer")
    .select("id, reviewer_employee_id")
    .eq("cycle_id", cycleId)
    .eq("participant_employee_id", revieweeEmployeeId)
    .eq("reviewer_type", "PEER");
  const keepPeerIds = new Set(pickedPeers.map((p) => p.employee_id));
  for (const row of existingPeers ?? []) {
    if (!keepPeerIds.has(row.reviewer_employee_id)) {
      await supabase.from("feedback_reviewer").delete().eq("id", row.id);
    }
  }

  await supabase.from("feedback_reviewer").upsert(
    assignments.map((a) => ({
      cycle_id: cycleId,
      participant_employee_id: revieweeEmployeeId,
      reviewer_employee_id: a.reviewer_employee_id,
      reviewer_type: a.reviewer_type,
      status: "Pending",
    })),
    { onConflict: "cycle_id,participant_employee_id,reviewer_employee_id,reviewer_type" }
  );
}

