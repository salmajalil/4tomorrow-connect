import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { TransformationActor } from "@/lib/transformation-roles";

// The caller's real standing on this transformation: owner of its
// organization, or an accepted member with a given role — or nobody (null:
// the transformation is invisible to them, or they have no role on it).
// Shared by every server route/page that needs canPerform() — the decision
// itself stays in the pure src/lib/transformation-roles.ts.
export async function loadActor(
  supabase: SupabaseClient<Database>,
  userId: string,
  transformationId: string
): Promise<TransformationActor | null> {
  const [{ data: transformation }, { data: ownedOrgs }, { data: membership }] = await Promise.all([
    supabase.from("transformations").select("id, organization_id").eq("id", transformationId).maybeSingle(),
    supabase.from("organizations").select("id").eq("owner_id", userId),
    supabase
      .from("transformation_members")
      .select("role, domain")
      .eq("transformation_id", transformationId)
      .eq("user_id", userId)
      .not("accepted_at", "is", null)
      .maybeSingle(),
  ]);
  if (!transformation) return null;
  const isOwner = (ownedOrgs ?? []).some((o) => o.id === transformation.organization_id);
  if (isOwner) return { role: "consultant", isOwner: true };
  if (membership) return { role: membership.role, domain: membership.domain, isOwner: false };
  return null;
}
