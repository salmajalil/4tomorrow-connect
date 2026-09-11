import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ModuleName, ModuleStatusValue } from "@/types/database";

// Kept current by application code on every write to a module's own tables
// (documented in supabase/migrations/0002_decide.sql) rather than a DB
// trigger — same observable "updates automatically" behavior, easier to
// reason about and debug. Every module route that mutates its own data
// should call this right after a successful persist.
export async function setModuleStatus(
  supabase: SupabaseClient<Database>,
  transformationId: string,
  module: ModuleName,
  status: ModuleStatusValue
) {
  await supabase.from("module_status").upsert(
    {
      transformation_id: transformationId,
      module,
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "transformation_id,module" }
  );
}
