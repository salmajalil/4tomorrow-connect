-- 4 Tomorrow — PROJET ET ÉQUIPE: team membership and roles
--
-- Purely additive: one new table, no existing table altered or dropped.
-- Owner-only access (every table from 0001/0002) keeps working unchanged —
-- zero regression for the single-owner case that is 100% of today's usage.
--
-- Design notes:
--   * Roles, exactly as the brief defines them: consultant (modifie tout,
--     envoie au CEO), client (modifie les données de son usine), expert
--     (consulte, commente, modifie son domaine), ceo (valide / demande un
--     complément / refuse).
--   * `domain` is only meaningful for role = 'expert' ("modifie son
--     domaine") — scoped to the same four module names already used
--     everywhere else in this schema (module_status.module,
--     module_recommendations.module), not a new vocabulary.
--   * A row starts as a pending invite (user_id null, invited_email set,
--     accepted_at null) and becomes active once the invited person signs in
--     and claims it (user_id set, accepted_at set) — claiming happens in
--     application code (see src/app/api/control-tower/invite-member/route.ts
--     and the as-yet-unbuilt claim flow), not here.
--   * Two-layer enforcement, deliberately: RLS below grants the *coarse*,
--     safe default — an accepted member can always READ everything on a
--     transformation they belong to (the brief's "un espace par projet"),
--     and only the owner or a consultant member can WRITE most tables
--     (consultant "modifie tout"). The *finer* per-role rule — a client
--     restricted to their own usine's data, an expert restricted to their
--     own domain — is intentionally NOT attempted here as a blanket RLS
--     predicate across a dozen differently-shaped tables (that is a lot of
--     security-critical SQL to get right without being able to execute it
--     against a live database from this session). It is enforced instead in
--     src/lib/transformation-roles.ts (pure, unit-tested, called by API
--     routes before any client/expert write). This migration's own policies
--     are the safety net under that: a client or expert member can never
--     write through RLS directly, only through routes that apply the finer
--     check. NEEDS STAGING VERIFICATION before this ships — not executed or
--     tested against the real Supabase project from this sandbox.

create table if not exists transformation_members (
  id uuid primary key default gen_random_uuid(),
  transformation_id uuid not null references transformations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  invited_email text not null,
  role text not null check (role in ('consultant', 'client', 'expert', 'ceo')),
  domain text check (domain in ('decide', 'connect', 'deliver', 'learn')),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  -- an expert's row must carry a domain (their "domaine"); no other role uses it
  constraint transformation_members_domain_only_for_expert check (
    (role = 'expert' and domain is not null) or (role <> 'expert' and domain is null)
  ),
  unique (transformation_id, invited_email)
);

create index if not exists transformation_members_transformation_id_idx on transformation_members (transformation_id);
create index if not exists transformation_members_user_id_idx on transformation_members (user_id);

alter table transformation_members enable row level security;

-- Membership itself: the owner always sees/manages it; any accepted member
-- can see the roster (so a team can see who's on the project) but cannot
-- change it — only the owner or an accepted consultant can invite/edit/
-- remove, matching "consultant = modifie tout".
create policy "transformation_members_select_own_or_member" on transformation_members
  for select to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = transformation_members.transformation_id
        and o.owner_id = auth.uid()
    )
    or exists (
      select 1 from transformation_members tm
      where tm.transformation_id = transformation_members.transformation_id
        and tm.user_id = auth.uid()
        and tm.accepted_at is not null
    )
  );

create policy "transformation_members_insert_owner_or_consultant" on transformation_members
  for insert to authenticated
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = transformation_members.transformation_id
        and o.owner_id = auth.uid()
    )
    or exists (
      select 1 from transformation_members tm
      where tm.transformation_id = transformation_members.transformation_id
        and tm.user_id = auth.uid()
        and tm.accepted_at is not null
        and tm.role = 'consultant'
    )
  );

create policy "transformation_members_update_owner_or_consultant_or_self_accept" on transformation_members
  for update to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = transformation_members.transformation_id
        and o.owner_id = auth.uid()
    )
    or exists (
      select 1 from transformation_members tm
      where tm.transformation_id = transformation_members.transformation_id
        and tm.user_id = auth.uid()
        and tm.accepted_at is not null
        and tm.role = 'consultant'
    )
    -- a pending invite's own recipient may update (and only) their own row,
    -- to claim it (set user_id/accepted_at) once they sign in
    or (transformation_members.user_id is null and transformation_members.invited_email = auth.email())
  )
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = transformation_members.transformation_id
        and o.owner_id = auth.uid()
    )
    or exists (
      select 1 from transformation_members tm
      where tm.transformation_id = transformation_members.transformation_id
        and tm.user_id = auth.uid()
        and tm.accepted_at is not null
        and tm.role = 'consultant'
    )
    or (transformation_members.invited_email = auth.email())
  );

create policy "transformation_members_delete_owner_or_consultant" on transformation_members
  for delete to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = transformation_members.transformation_id
        and o.owner_id = auth.uid()
    )
    or exists (
      select 1 from transformation_members tm
      where tm.transformation_id = transformation_members.transformation_id
        and tm.user_id = auth.uid()
        and tm.accepted_at is not null
        and tm.role = 'consultant'
    )
  );

-- ---------------------------------------------------------------------------
-- Broaden READ on the project's own content to accepted members, on top of
-- the existing owner-only policies — same mechanism (ALTER POLICY keeps the
-- existing policy name and its INSERT/UPDATE/DELETE counterparts untouched,
-- only the SELECT predicate gains an `or`). Owner access is unchanged byte
-- for byte; this only adds who else can read. Write access is deliberately
-- NOT broadened here — see the design note above.
-- ---------------------------------------------------------------------------
alter policy "transformations_select_own" on transformations
  using (
    exists (
      select 1 from organizations o
      where o.id = transformations.organization_id
        and o.owner_id = auth.uid()
    )
    or exists (
      select 1 from transformation_members tm
      where tm.transformation_id = transformations.id
        and tm.user_id = auth.uid()
        and tm.accepted_at is not null
    )
  );

alter policy "gaps_select_own" on gaps
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = gaps.transformation_id
        and o.owner_id = auth.uid()
    )
    or exists (
      select 1 from transformation_members tm
      where tm.transformation_id = gaps.transformation_id
        and tm.user_id = auth.uid()
        and tm.accepted_at is not null
    )
  );

alter policy "priorities_select_own" on priorities
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = priorities.transformation_id
        and o.owner_id = auth.uid()
    )
    or exists (
      select 1 from transformation_members tm
      where tm.transformation_id = priorities.transformation_id
        and tm.user_id = auth.uid()
        and tm.accepted_at is not null
    )
  );

alter policy "matches_select_own" on matches
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = matches.transformation_id
        and o.owner_id = auth.uid()
    )
    or exists (
      select 1 from transformation_members tm
      where tm.transformation_id = matches.transformation_id
        and tm.user_id = auth.uid()
        and tm.accepted_at is not null
    )
  );

alter policy "trajectories_select_own" on trajectories
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = trajectories.transformation_id
        and o.owner_id = auth.uid()
    )
    or exists (
      select 1 from transformation_members tm
      where tm.transformation_id = trajectories.transformation_id
        and tm.user_id = auth.uid()
        and tm.accepted_at is not null
    )
  );

alter policy "risks_select_own" on risks
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = risks.transformation_id
        and o.owner_id = auth.uid()
    )
    or exists (
      select 1 from transformation_members tm
      where tm.transformation_id = risks.transformation_id
        and tm.user_id = auth.uid()
        and tm.accepted_at is not null
    )
  );

alter policy "opportunities_select_own" on opportunities
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = opportunities.transformation_id
        and o.owner_id = auth.uid()
    )
    or exists (
      select 1 from transformation_members tm
      where tm.transformation_id = opportunities.transformation_id
        and tm.user_id = auth.uid()
        and tm.accepted_at is not null
    )
  );

alter policy "roadmap_phases_select_own" on roadmap_phases
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = roadmap_phases.transformation_id
        and o.owner_id = auth.uid()
    )
    or exists (
      select 1 from transformation_members tm
      where tm.transformation_id = roadmap_phases.transformation_id
        and tm.user_id = auth.uid()
        and tm.accepted_at is not null
    )
  );

alter policy "module_recommendations_select_own" on module_recommendations
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = module_recommendations.transformation_id
        and o.owner_id = auth.uid()
    )
    or exists (
      select 1 from transformation_members tm
      where tm.transformation_id = module_recommendations.transformation_id
        and tm.user_id = auth.uid()
        and tm.accepted_at is not null
    )
  );

alter policy "module_status_select_own" on module_status
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = module_status.transformation_id
        and o.owner_id = auth.uid()
    )
    or exists (
      select 1 from transformation_members tm
      where tm.transformation_id = module_status.transformation_id
        and tm.user_id = auth.uid()
        and tm.accepted_at is not null
    )
  );

-- capability_assessments (0011) — same broadening, added here rather than
-- in 0011 since team membership didn't exist yet when that migration was
-- written.
alter policy "capability_assessments_select_own" on capability_assessments
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = capability_assessments.transformation_id
        and o.owner_id = auth.uid()
    )
    or exists (
      select 1 from transformation_members tm
      where tm.transformation_id = capability_assessments.transformation_id
        and tm.user_id = auth.uid()
        and tm.accepted_at is not null
    )
  );

do $$
begin
  execute 'alter publication supabase_realtime add table transformation_members';
exception when duplicate_object then
  null;
end $$;
