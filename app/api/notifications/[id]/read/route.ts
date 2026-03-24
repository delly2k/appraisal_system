import { NextResponse } from "next/server";
import { getNotificationSessionUser, getNotificationsSupabaseAdmin } from "@/lib/notifications/route-context";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getNotificationSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = getNotificationsSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("app_notifications")
    .update({ read_at: now })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
