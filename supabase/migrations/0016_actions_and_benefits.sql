-- 4 Tomorrow — AR (actions & risques, transverse) + L06 (bénéfices)
--
-- Purely additive: new columns on `risks` (never touched by the AI — see
-- src/lib/risk-scoring.ts), a new `actions` table (none existed before),
-- update/delete RLS for `risks`/`opportunities` (only select+insert existed,
-- which is why neither had any CRUD UI), and three new tables for L06.

-- ---------------------------------------------------------------------------
-- AR — risks: probability/impact/owner/treatment are set by the user (or
-- left unset), never invented by the AI that still suggests the risk's
-- name/reason. Severity is computed in src/lib/risk-scoring.ts, not stored.
-- ---------------------------------------------------------------------------
alter table risks add column if not exists probability smallint check (probability between 1 and 5);
alter table risks add column if not exists impact smallint check (impact between 1 and 5);
alter table risks add column if not exists owner text;
alter table risks add column if not exists treatment text;

create policy "risks_update_own" on risks
  for update to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = risks.transformation_id
        and o.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = risks.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "risks_delete_own" on risks
  for delete to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = risks.transformation_id
        and o.owner_id = auth.uid()
    )
  );

-- opportunities: same gap (select+insert only) — add update/delete so the
-- Control Tower can let the user edit/remove them like risks.
create policy "opportunities_update_own" on opportunities
  for update to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = opportunities.transformation_id
        and o.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = opportunities.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "opportunities_delete_own" on opportunities
  for delete to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = opportunities.transformation_id
        and o.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- AR — actions: did not exist as a persisted entity at all before this
-- migration (only an AI-generated "action_plan" deliverable JSON blob).
-- "chaque outil peut créer une action" — source_module records which one.
-- ---------------------------------------------------------------------------
create table if not exists actions (
  id uuid primary key default gen_random_uuid(),
  transformation_id uuid not null references transformations (id) on delete cascade,
  title text not null,
  owner text,
  due_date date,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'done')),
  source_module text,
  created_at timestamptz not null default now()
);

create index if not exists actions_transformation_id_idx on actions (transformation_id);

alter table actions enable row level security;

create policy "actions_select_own" on actions
  for select to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = actions.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "actions_insert_own" on actions
  for insert to authenticated
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = actions.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "actions_update_own" on actions
  for update to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = actions.transformation_id
        and o.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = actions.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "actions_delete_own" on actions
  for delete to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = actions.transformation_id
        and o.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- L06 — bénéfices. expected_annual is the D05→L06 integration seam: null
-- until the user fills it in by hand, or D05 (business case, built
-- separately) writes its own computed figure here with source='business_case'.
-- Computation itself (observed-annual, anti-double-count per perimeter,
-- gap vs. expected) lives in src/lib/deliver-benefits-calc.ts — nothing
-- here is AI-generated.
-- ---------------------------------------------------------------------------
create table if not exists benefit_expectations (
  transformation_id uuid primary key references transformations (id) on delete cascade,
  expected_annual numeric,
  source text not null default 'manual' check (source in ('manual', 'business_case')),
  updated_at timestamptz not null default now()
);

alter table benefit_expectations enable row level security;

create policy "benefit_expectations_select_own" on benefit_expectations
  for select to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = benefit_expectations.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "benefit_expectations_upsert_own" on benefit_expectations
  for insert to authenticated
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = benefit_expectations.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "benefit_expectations_update_own" on benefit_expectations
  for update to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = benefit_expectations.transformation_id
        and o.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = benefit_expectations.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create table if not exists benefit_items (
  id uuid primary key default gen_random_uuid(),
  transformation_id uuid not null references transformations (id) on delete cascade,
  label text not null,
  perimeter text not null,
  value numeric not null,
  created_at timestamptz not null default now()
);

create index if not exists benefit_items_transformation_id_idx on benefit_items (transformation_id);

alter table benefit_items enable row level security;

create policy "benefit_items_select_own" on benefit_items
  for select to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = benefit_items.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "benefit_items_insert_own" on benefit_items
  for insert to authenticated
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = benefit_items.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "benefit_items_update_own" on benefit_items
  for update to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = benefit_items.transformation_id
        and o.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = benefit_items.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "benefit_items_delete_own" on benefit_items
  for delete to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = benefit_items.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create table if not exists benefit_observations (
  id uuid primary key default gen_random_uuid(),
  transformation_id uuid not null references transformations (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  value numeric not null,
  created_at timestamptz not null default now(),
  unique (transformation_id, month)
);

create index if not exists benefit_observations_transformation_id_idx on benefit_observations (transformation_id);

alter table benefit_observations enable row level security;

create policy "benefit_observations_select_own" on benefit_observations
  for select to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = benefit_observations.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "benefit_observations_insert_own" on benefit_observations
  for insert to authenticated
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = benefit_observations.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "benefit_observations_delete_own" on benefit_observations
  for delete to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = benefit_observations.transformation_id
        and o.owner_id = auth.uid()
    )
  );

-- Control Tower subscribes to `actions` live, same as risks/opportunities
-- (see src/components/control-tower/control-tower-view.tsx) — same
-- idempotent add-to-publication pattern as 0005_deliver.sql.
do $$
begin
  begin
    execute 'alter publication supabase_realtime add table actions';
  exception when duplicate_object then
    null;
  end;
  begin
    execute 'alter publication supabase_realtime add table benefit_expectations';
  exception when duplicate_object then
    null;
  end;
  begin
    execute 'alter publication supabase_realtime add table benefit_items';
  exception when duplicate_object then
    null;
  end;
  begin
    execute 'alter publication supabase_realtime add table benefit_observations';
  exception when duplicate_object then
    null;
  end;
end $$;
