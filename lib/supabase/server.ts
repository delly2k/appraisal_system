import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase server client for route handlers.
 * Uses service role when present, otherwise falls back to anon key.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return createSupabaseClient(url, key);
}
