import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveManagerSystemUserId } from "@/lib/hrmis-approval-auth";

export interface ManagerAccessResult {
  isPrimaryManager: boolean;
  isDelegated: boolean;
  hasManagerAccess: boolean;
}

interface ResolveManagerAccessArgs {
  supabase: SupabaseClient;
  appraisalId: string;
  appraisalEmployeeId: string | null;
  appraisalManagerEmployeeId: string | null;
  currentEmployeeId: string | null;
}

/**
 * Manager auth fallback for delegated access.
 * Preserves primary manager auth and only adds delegated access.
 */
export async function resolveManagerAccessForAppraisal(
  args: ResolveManagerAccessArgs
): Promise<ManagerAccessResult> {
  const {
    supabase,
    appraisalId,
    appraisalEmployeeId,
    appraisalManagerEmployeeId,
    currentEmployeeId,
  } = args;

  if (!currentEmployeeId) {
    return { isPrimaryManager: false, isDelegated: false, hasManagerAccess: false };
  }

  const managerSystemUserId =
    (await resolveManagerSystemUserId(appraisalEmployeeId)) ??
    appraisalManagerEmployeeId ??
    null;
  const isPrimaryManager = managerSystemUserId === currentEmployeeId;
  if (isPrimaryManager) {
    return { isPrimaryManager: true, isDelegated: false, hasManagerAccess: true };
  }

  const { data: delegation } = await supabase
    .from("appraisal_delegations")
    .select("id")
    .eq("appraisal_id", appraisalId)
    .eq("delegated_to", currentEmployeeId)
    .maybeSingle();

  const isDelegated = Boolean(delegation?.id);
  return {
    isPrimaryManager: false,
    isDelegated,
    hasManagerAccess: isDelegated,
  };
}
