import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NotificationType } from "./types";

function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isAppUserUuid(id: string): boolean {
  return UUID_RE.test(id);
}

export interface CreateNotificationInput {
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  if (!isAppUserUuid(input.user_id)) return;
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const { error } = await supabase.from("app_notifications").insert({
    user_id: input.user_id,
    type: input.type,
    title: input.title,
    body: input.body,
    link: input.link ?? null,
    metadata: input.metadata ?? null,
  });
  if (error) console.error("[notifications] create error:", error);
}

export async function createNotifications(inputs: CreateNotificationInput[]): Promise<void> {
  if (!inputs.length) return;
  const filtered = inputs.filter((i) => isAppUserUuid(i.user_id));
  if (!filtered.length) return;
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const { error } = await supabase.from("app_notifications").insert(
    filtered.map((i) => ({
      user_id: i.user_id,
      type: i.type,
      title: i.title,
      body: i.body,
      link: i.link ?? null,
      metadata: i.metadata ?? null,
    }))
  );
  if (error) console.error("[notifications] bulk create error:", error);
}

/**
 * Resolve active app_users.id by employees.employee_id and create an in-app notification.
 */
export async function createNotificationForEmployeeId(
  employeeId: string | null | undefined,
  input: Omit<CreateNotificationInput, "user_id">
): Promise<void> {
  const eid = typeof employeeId === "string" ? employeeId.trim() : "";
  if (!eid) return;
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const { data, error } = await supabase
    .from("app_users")
    .select("id")
    .eq("employee_id", eid)
    .eq("is_active", true)
    .maybeSingle();
  if (error || !data?.id || !isAppUserUuid(data.id)) return;
  await createNotification({ ...input, user_id: data.id });
}
