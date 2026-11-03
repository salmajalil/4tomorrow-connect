-- 4 Tomorrow — D01 diagnostic: deterministic capability assessment
--
-- Purely additive: a new table alongside the existing `gaps`/`priorities`
-- (left untouched — they keep carrying the AI's qualitative, narrative
-- read of the situation, exactly as before). This new table carries the
-- structured, numeric part of the diagnostic that the brief's D01 rule
-- requires to be calculated, never invented by the model:
--   gap = target - observed (floored at 0)
--   priority = gap * importance
--   status = "non vérifié" unless a proof note is attached
-- The numbers are computed in src/lib/decide-diagnostic-calc.ts (pure,
-- unit-tested) and written here as-is by the API route — this table never
-- receives a value chosen by the AI.
create table if not exists capability_assessments (
  id uuid primary key default gen_random_uuid(),
  transformation_id uuid not null references transformations (id) on delete cascade,
  domain text not null check (domain in ('manufacturing', 'rd', 'gtm', 'strategy', 'digitalization')),
  observed integer not null check (observed between 1 and 5),
  target integer not null check (target between 1 and 5),
  importance integer not null check (importance between 1 and 5),
  gap integer not null check (gap >= 0),
  priority integer not null check (priority >= 0),
  status text not null check (status in ('vérifié', 'non vérifié')),
  proof_note text not null default '',
  created_at timestamptz not null default now(),
  unique (transformation_id, domain)
);

create index if not exists capability_assessments_transformation_id_idx
  on capability_assessments (transformation_id);

alter table capability_assessments enable row level security;

-- Same owner-only pattern as every other transformation-scoped table
-- (see 0001_init.sql / 0002_decide.sql) — a transformation is reachable
-- only through the organization its owner holds.
create policy "capability_assessments_select_own" on capability_assessments
  for select to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = capability_assessments.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "capability_assessments_insert_own" on capability_assessments
  for insert to authenticated
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = capability_assessments.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "capability_assessments_update_own" on capability_assessments
  for update to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = capability_assessments.transformation_id
        and o.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = capability_assessments.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "capability_assessments_delete_own" on capability_assessments
  for delete to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = capability_assessments.transformation_id
        and o.owner_id = auth.uid()
    )
  );
