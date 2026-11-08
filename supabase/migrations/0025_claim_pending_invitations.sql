-- PROJET ET ÉQUIPE — flux d'acceptation des invitations (le "claim flow"
-- annoncé dans 0015_team_roles.sql et jamais construit).
--
-- Sans ce flux, aucune ligne de transformation_members n'avait jamais
-- user_id/accepted_at renseignés : is_transformation_member() restait
-- toujours faux, et toutes les policies "propriétaire OU membre" de 0015,
-- 0018 et 0022 se réduisaient en pratique à "propriétaire seul".
--
-- Purement additif : une nouvelle fonction, et deux policies existantes de
-- transformation_members redéfinies (ALTER POLICY, même approche que 0018).
-- Aucune table ni colonne modifiée ou supprimée.

-- ---------------------------------------------------------------------------
-- 1. claim_pending_invitations()
--
-- Appelée par l'application juste après l'ouverture de session
-- (src/app/auth/callback/route.ts, et après une connexion par mot de passe
-- dans src/app/login/page.tsx), ou depuis la tour de contrôle quand une
-- invitation arrive pour un utilisateur déjà connecté.
--
-- SECURITY DEFINER : elle n'a besoin d'aucune policy UPDATE côté invité
-- (voir §3), et ne touche QUE user_id et accepted_at — jamais role ni
-- domain, qui restent ceux fixés par le propriétaire/consultant.
--
-- Garde-fous :
--   * l'e-mail de session doit être CONFIRMÉ (auth.users.email_confirmed_at)
--     — sinon, sur un projet Supabase où la confirmation d'e-mail serait
--     désactivée, n'importe qui pourrait créer un compte avec l'adresse d'un
--     invité et s'approprier son invitation ;
--   * comparaison d'e-mail insensible à la casse (l'invitation enregistre
--     l'adresse telle que saisie, Supabase Auth la stocke en minuscules) ;
--   * une ligne déjà rattachée à un AUTRE utilisateur n'est jamais réattribuée.
--
-- Renvoie le nombre d'invitations acceptées par cet appel.
-- ---------------------------------------------------------------------------
create or replace function claim_pending_invitations()
returns integer
language plpgsql
security definer
set search_path = public
volatile
as $$
declare
  claimed integer := 0;
  caller_email text := auth.email();
begin
  if auth.uid() is null or caller_email is null or caller_email = '' then
    return 0;
  end if;

  if not exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
  ) then
    return 0;
  end if;

  update transformation_members tm
     set user_id = auth.uid(),
         accepted_at = now()
   where lower(tm.invited_email) = lower(caller_email)
     and tm.accepted_at is null
     and (tm.user_id is null or tm.user_id = auth.uid());

  get diagnostics claimed = row_count;
  return claimed;
end;
$$;

revoke all on function claim_pending_invitations() from public;
grant execute on function claim_pending_invitations() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. SELECT : l'invité voit sa propre invitation, même pas encore acceptée.
--
-- Sans cette branche, cercle vicieux : l'invité ne pouvait voir sa ligne
-- qu'en étant déjà membre accepté (is_transformation_member), ce qui
-- supposait justement d'avoir accepté. Il ne voit QUE les lignes adressées à
-- son e-mail — pas le reste de l'équipe tant qu'il n'a pas accepté.
-- ---------------------------------------------------------------------------
alter policy "transformation_members_select_own_or_member" on transformation_members
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = transformation_members.transformation_id
        and o.owner_id = auth.uid()
    )
    or is_transformation_member(transformation_members.transformation_id)
    or lower(transformation_members.invited_email) = lower(auth.email())
  );

-- ---------------------------------------------------------------------------
-- 3. UPDATE : suppression de la branche "self-accept" (élévation de privilège).
--
-- Avant : USING (user_id is null and invited_email = auth.email()) et
-- WITH CHECK (invited_email = auth.email()), sans borner les colonnes — un
-- invité "client" pouvait lui-même passer role = 'consultant' (puis gérer
-- l'équipe et écrire partout via is_transformation_consultant).
--
-- Choix retenu : l'invité n'a PLUS AUCUN droit UPDATE direct sur
-- transformation_members. La seule mise à jour légitime côté invité —
-- poser user_id/accepted_at — passe exclusivement par
-- claim_pending_invitations() ci-dessus (SECURITY DEFINER, colonnes figées
-- dans le corps de la fonction). C'est plus sûr qu'un WITH CHECK comparant
-- l'ancienne et la nouvelle valeur de role/domain, que RLS n'exprime pas
-- directement (WITH CHECK ne voit que la nouvelle ligne).
-- Le propriétaire et les consultants acceptés gardent exactement leurs
-- droits UPDATE existants (inviter/modifier les membres).
-- ---------------------------------------------------------------------------
alter policy "transformation_members_update_owner_or_consultant_or_self_accept" on transformation_members
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = transformation_members.transformation_id
        and o.owner_id = auth.uid()
    )
    or is_transformation_consultant(transformation_members.transformation_id)
  )
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = transformation_members.transformation_id
        and o.owner_id = auth.uid()
    )
    or is_transformation_consultant(transformation_members.transformation_id)
  );
