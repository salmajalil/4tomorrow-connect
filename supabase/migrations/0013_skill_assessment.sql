-- 4 Tomorrow — F01 skills matrix: deterministic gap assessment
--
-- Purely additive, same owner-only RLS pattern as every other
-- transformation-scoped table (see 0001_init.sql, 0002_decide.sql, and
-- 0011_capability_assessment.sql for D01's identical precedent). The
-- numbers here (gap, weighted) are computed in
-- src/lib/learn-skills-calc.ts (pure, unit-tested) and written as-is by
-- the API route — this table never receives a value chosen by the AI.
-- Existing `trainings` content generation (src/lib/learn.ts) is
-- untouched: it still writes to the `trainings` table exactly as before.

create table if not exists skill_assessments (
  id uuid primary key default gen_random_uuid(),
  transformation_id uuid not null references transformations (id) on delete cascade,
  role text not null,
  domain text not null check (domain in ('manufacturing', 'rd', 'gtm', 'strategy', 'digitalization')),
  required integer not null check (required between 0 and 4),
  demonstrated integer not null check (demonstrated between 0 and 4),
  criticality integer not null check (criticality between 1 and 5),
  self_assessed boolean not null default false,
  gap integer not null check (gap >= 0),
  weighted integer not null check (weighted >= 0),
  status text not null check (status in ('à confirmer', 'confirmé')),
  created_at timestamptz not null default now()
);

create index if not exists skill_assessments_transformation_id_idx
  on skill_assessments (transformation_id);

alter table skill_assessments enable row level security;

create policy "skill_assessments_select_own" on skill_assessments
  for select to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = skill_assessments.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "skill_assessments_insert_own" on skill_assessments
  for insert to authenticated
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = skill_assessments.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "skill_assessments_delete_own" on skill_assessments
  for delete to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = skill_assessments.transformation_id
        and o.owner_id = auth.uid()
    )
  );

-- Catalogue de formations éditable (brief F01: "catalogue de formations").
-- Scoped per organization (same ownership unit as everything else today —
-- there is no cross-client admin concept yet). One row per domain per
-- organization; a missing row falls back to
-- learn-skills-calc.ts's DEFAULT_TRAINING_SUGGESTIONS, never to the AI.
create table if not exists training_suggestions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  domain text not null check (domain in ('manufacturing', 'rd', 'gtm', 'strategy', 'digitalization')),
  suggestion text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, domain)
);

alter table training_suggestions enable row level security;

create policy "training_suggestions_select_own" on training_suggestions
  for select to authenticated
  using (
    exists (select 1 from organizations o where o.id = training_suggestions.organization_id and o.owner_id = auth.uid())
  );

create policy "training_suggestions_insert_own" on training_suggestions
  for insert to authenticated
  with check (
    exists (select 1 from organizations o where o.id = training_suggestions.organization_id and o.owner_id = auth.uid())
  );

create policy "training_suggestions_update_own" on training_suggestions
  for update to authenticated
  using (
    exists (select 1 from organizations o where o.id = training_suggestions.organization_id and o.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from organizations o where o.id = training_suggestions.organization_id and o.owner_id = auth.uid())
  );

create policy "training_suggestions_delete_own" on training_suggestions
  for delete to authenticated
  using (
    exists (select 1 from organizations o where o.id = training_suggestions.organization_id and o.owner_id = auth.uid())
  );
