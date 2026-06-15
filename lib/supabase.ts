import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase admin client (service role). Created lazily so a missing
 * env var doesn't crash the build/import — the route returns 503 instead.
 * Never import this into client components.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}
