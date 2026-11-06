-- Fix: "infinite recursion detected in policy for relation ..." (Postgres
-- error 42P17), hit in production on every insert into `transformations`
-- after 0015_team_roles.sql shipped.
--
-- Root cause: transformations_select_own's policy queries
-- transformation_members (to check "is this user an accepted member?"), and
-- transformation_members_select_own_or_member's own policy queries
-- transformations (to check "does this user own the parent organization?").
-- Evaluating either table's RLS re-triggers the other's — an infinite loop.
-- transformation_members' insert/update/delete policies have the same
-- problem in miniature: they query transformation_members *from inside its
-- own policy* to check for an accepted 'consultant' row, which re-triggers
-- the same policy being evaluated.
--
-- Fix: move every "is this user an accepted member (optionally: consultant)
-- of transformation X" check into a SECURITY DEFINER function. Such a
-- function runs with the privileges of its owner, not the calling user, so
-- the SELECT inside it is not itself subject to RLS — the recursive loop
-- never starts, on either table.

create or replace function is_transformation_member(tx_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from transformation_members tm
    where tm.transformation_id = tx_id
      and tm.user_id = auth.uid()
      and tm.accepted_at is not null
  );
$$;

create or replace function is_transformation_consultant(tx_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from transformation_members tm
    where tm.transformation_id = tx_id
      and tm.user_id = auth.uid()
      and tm.accepted_at is not null
      and tm.role = 'consultant'
  );
$$;

revoke all on function is_transformation_member(uuid) from public;
revoke all on function is_transformation_consultant(uuid) from public;
grant execute on function is_transformation_member(uuid) to authenticated;
grant execute on function is_transformation_consultant(uuid) to authenticated;

-- transformation_members' own policies: replace every self-referencing
-- subquery with the function above (breaks the self-recursion).

alter policy "transformation_members_select_own_or_member" on transformation_members
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = transformation_members.transformation_id
        and o.owner_id = auth.uid()
    )
    or is_transformation_member(transformation_members.transformation_id)
  );

alter policy "transformation_members_insert_owner_or_consultant" on transformation_members
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = transformation_members.transformation_id
        and o.owner_id = auth.uid()
    )
    or is_transformation_consultant(transformation_members.transformation_id)
  );

alter policy "transformation_members_update_owner_or_consultant_or_self_accept" on transformation_members
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = transformation_members.transformation_id
        and o.owner_id = auth.uid()
    )
    or is_transformation_consultant(transformation_members.transformation_id)
    or (transformation_members.user_id is null and transformation_members.invited_email = auth.email())
  )
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = transformation_members.transformation_id
        and o.owner_id = auth.uid()
    )
    or is_transformation_consultant(transformation_members.transformation_id)
    or (transformation_members.invited_email = auth.email())
  );

alter policy "transformation_members_delete_owner_or_consultant" on transformation_members
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = transformation_members.transformation_id
        and o.owner_id = auth.uid()
    )
    or is_transformation_consultant(transformation_members.transformation_id)
  );

-- Every table 0015 broadened to accepted members: same fix, same shape —
-- replace the raw transformation_members subquery with the function.

alter policy "transformations_select_own" on transformations
  using (
    exists (
      select 1 from organizations o
      where o.id = transformations.organization_id
        and o.owner_id = auth.uid()
    )
    or is_transformation_member(transformations.id)
  );

alter policy "gaps_select_own" on gaps
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = gaps.transformation_id
        and o.owner_id = auth.uid()
    )
    or is_transformation_member(gaps.transformation_id)
  );

alter policy "priorities_select_own" on priorities
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = priorities.transformation_id
        and o.owner_id = auth.uid()
    )
    or is_transformation_member(priorities.transformation_id)
  );

alter policy "matches_select_own" on matches
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = matches.transformation_id
        and o.owner_id = auth.uid()
    )
    or is_transformation_member(matches.transformation_id)
  );

alter policy "trajectories_select_own" on trajectories
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = trajectories.transformation_id
        and o.owner_id = auth.uid()
    )
    or is_transformation_member(trajectories.transformation_id)
  );

alter policy "risks_select_own" on risks
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = risks.transformation_id
        and o.owner_id = auth.uid()
    )
    or is_transformation_member(risks.transformation_id)
  );

alter policy "opportunities_select_own" on opportunities
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = opportunities.transformation_id
        and o.owner_id = auth.uid()
    )
    or is_transformation_member(opportunities.transformation_id)
  );

alter policy "roadmap_phases_select_own" on roadmap_phases
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = roadmap_phases.transformation_id
        and o.owner_id = auth.uid()
    )
    or is_transformation_member(roadmap_phases.transformation_id)
  );

alter policy "module_recommendations_select_own" on module_recommendations
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = module_recommendations.transformation_id
        and o.owner_id = auth.uid()
    )
    or is_transformation_member(module_recommendations.transformation_id)
  );

alter policy "module_status_select_own" on module_status
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = module_status.transformation_id
        and o.owner_id = auth.uid()
    )
    or is_transformation_member(module_status.transformation_id)
  );

alter policy "capability_assessments_select_own" on capability_assessments
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = capability_assessments.transformation_id
        and o.owner_id = auth.uid()
    )
    or is_transformation_member(capability_assessments.transformation_id)
  );
