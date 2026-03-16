/**
 * 360 audit log helpers. Append-only log for assignment created/removed, review submitted/updated/removed.
 * Used for bank/public body compliance.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type FeedbackAuditEventType =
  | "assignment_created"
  | "assignment_removed"
  | "review_submitted"
  | "review_updated"
  | "review_removed";

export async function logFeedbackAudit(
  supabase: SupabaseClient,
  params: {
    cycle_id: string;
    participant_employee_id: string;
    reviewer_id?: string | null;
    event_type: FeedbackAuditEventType;
    actor_employee_id?: string | null;
    actor_system?: boolean;
    metadata?: Record<string, unknown>;
  }
) {
  const { error } = await supabase.from("feedback_audit_log").insert({
    cycle_id: params.cycle_id,
    participant_employee_id: params.participant_employee_id,
    reviewer_id: params.reviewer_id ?? null,
    event_type: params.event_type,
    actor_employee_id: params.actor_employee_id ?? null,
    actor_system: params.actor_system ?? false,
    metadata: params.metadata ?? {},
  });
  if (error) throw error;
}
