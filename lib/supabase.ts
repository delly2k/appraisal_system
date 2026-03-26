import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase browser client for client components.
 * Use this in 'use client' components and browser context.
 *
 * Environment variables required (when database is implemented):
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
let browserClient: SupabaseClient | null = null;

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (browserClient) return browserClient;
  browserClient = createSupabaseClient(supabaseUrl, supabaseAnonKey);
  return browserClient;
}

// Re-export types for convenience when implementing database logic
export type { User, Session } from "@supabase/supabase-js";
