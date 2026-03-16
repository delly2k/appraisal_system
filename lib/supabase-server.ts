import { createClient } from "@supabase/supabase-js";

/**
 * Supabase server client for Server Components and Route Handlers.
 * Use in server context only (e.g. app/* page.tsx server components, route.ts).
 * Cookie-based session handling will be added when integrating auth.
 *
 * Environment variables required (when database is implemented):
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
export function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  return createClient(supabaseUrl, supabaseAnonKey);
}
