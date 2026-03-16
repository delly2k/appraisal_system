import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/me
 * Returns the current app user (from NextAuth session + app_users).
 * Returns 401 if not signed in.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await getCurrentUser();
  return NextResponse.json(user ?? { error: "User not found" });
}
