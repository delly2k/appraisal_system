import { NextResponse } from "next/server";
import { getNotificationSessionUser, getNotificationsSupabaseAdmin } from "@/lib/notifications/route-context";

export async function GET() {
  const user = await getNotificationSessionUser();
  if (!user) return NextResponse.json({ count: 0 });

  const supabase = getNotificationsSupabaseAdmin();
  if (!supabase) return NextResponse.json({ count: 0 });

  const { count, error } = await supabase
    .from("app_notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) return NextResponse.json({ count: 0 });
  return NextResponse.json({ count: count ?? 0 });
}
