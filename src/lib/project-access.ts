import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Périmètre des dossiers accessibles à l'utilisateur courant : ceux des
// organisations qu'il possède (cas normal, propriétaire) OU ceux dont il est
// membre accepté via transformation_members (invité qui a accepté, voir
// 0025_claim_pending_invitations.sql).
//
// La RLS de `transformations` applique déjà cette même union (0018 :
// propriétaire OU is_transformation_member) ; ce filtre applicatif la
// redouble explicitement, comme le faisait l'ancien filtre "propriétaire
// seul", pour ne jamais dépendre de la seule RLS pour décider quel dossier
// afficher.
export type ProjectAccessScope = {
  ownedOrganizations: { id: string; name: string; industry: string | null }[];
  memberTransformationIds: string[];
};

export async function fetchProjectAccessScope(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<ProjectAccessScope> {
  const [{ data: orgs }, membershipsResult] = await Promise.all([
    supabase.from("organizations").select("id, name, industry").eq("owner_id", userId),
    // Best-effort, comme dans control-tower.ts : une base sans
    // transformation_members (migration pas encore appliquée) se comporte
    // comme "aucune adhésion", jamais comme une erreur bloquante.
    supabase
      .from("transformation_members")
      .select("transformation_id")
      .eq("user_id", userId)
      .not("accepted_at", "is", null),
  ]);
  return {
    ownedOrganizations: (orgs ?? []).map((o) => ({ id: o.id, name: o.name, industry: o.industry ?? null })),
    memberTransformationIds: (membershipsResult.data ?? []).map((m) => m.transformation_id),
  };
}

/** Pure : ce dossier fait-il partie du périmètre (organisation possédée OU adhésion acceptée) ? */
export function isAccessibleTransformation(
  scope: ProjectAccessScope,
  transformation: { id: string; organization_id: string }
): boolean {
  return (
    scope.ownedOrganizations.some((o) => o.id === transformation.organization_id) ||
    scope.memberTransformationIds.includes(transformation.id)
  );
}
