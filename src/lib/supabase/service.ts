import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Service-role Supabase client — bypasses Row Level Security entirely.
// Used ONLY by the CEO validation link route (src/app/api/validate/[token]),
// whose recipient has no account/session and so cannot go through the
// normal RLS-scoped server client (src/lib/supabase/server.ts). Every call
// site using this client MUST filter by the exact opaque `token` value
// (never list/enumerate ceo_validation_tokens) — the token itself, not this
// client, is what restricts access. Never import this from client code; the
// key must only ever live in a server-only env var.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — required for the CEO validation link route to read/write ceo_validation_tokens without a signed-in session."
    );
  }
  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
