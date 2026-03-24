import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { isAppUserUuid } from "@/lib/notifications/create";

export function getNotificationsSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** Current user must be a real app_users row (UUID) for in-app notifications. */
export async function getNotificationSessionUser() {
  const user = await getCurrentUser();
  if (!user?.id || !isAppUserUuid(user.id)) return null;
  return user;
}
