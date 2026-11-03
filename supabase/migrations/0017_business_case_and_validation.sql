-- 4 Tomorrow — D05 business case (option, off by default) + L09 CEO
-- validation (single-use, time-limited, link-based).
--
-- Purely additive. Numbers for business_cases are computed in
-- src/lib/decide-business-case-calc.ts (pure, unit-tested) and written
-- as-is by the API route — this table never receives a value invented by
-- the AI, and `enabled` defaults to false (D05 is off unless the consultant
-- turns it on for this transformation).
create table if not exists business_cases (
  id uuid primary key default gen_random_uuid(),
  transformation_id uuid not null references transformations (id) on delete cascade,
  trajectory_id uuid not null references trajectories (id) on delete cascade,
  enabled boolean not null default false,
  capex numeric not null,
  annual_gains numeric not null,
  annual_costs numeric not null,
  horizon_years integer not null check (horizon_years between 1 and 15),
  discount_rate_percent numeric, -- null = pas de VAN ; jamais de défaut inventé côté appli
  net_annual numeric not null,
  payback_years numeric, -- null si jamais rentable (net_annual <= 0)
  npv numeric, -- null tant qu'aucun taux n'a été saisi
  cumulative_by_year jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (trajectory_id)
);

create index if not exists business_cases_transformation_id_idx on business_cases (transformation_id);

alter table business_cases enable row level security;

create policy "business_cases_select_own" on business_cases
  for select to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = business_cases.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "business_cases_insert_own" on business_cases
  for insert to authenticated
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = business_cases.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "business_cases_update_own" on business_cases
  for update to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = business_cases.transformation_id
        and o.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = business_cases.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "business_cases_delete_own" on business_cases
  for delete to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = business_cases.transformation_id
        and o.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- decision_updated_at — bumped by the app (decide-flow's selectTrajectory)
-- every time selected_trajectory_id changes. A CEO validation token snapshots
-- this value at issuance; consumption compares it to the current value so a
-- decision edited after the link was sent invalidates that link, per brief:
-- "refusé ... si la décision a changé depuis l'envoi".
-- ---------------------------------------------------------------------------
alter table transformations add column if not exists decision_updated_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- ceo_validation_tokens — single-use, 72h, tied to a decision AND its
-- version (trajectory_id + decision_updated_at snapshot). No RLS policy
-- grants the unauthenticated recipient access: the /validate/[token] route
-- reads and writes this table with the Supabase SERVICE ROLE key (server
-- only, see src/lib/supabase/service.ts), always filtered by the exact
-- opaque `token` value — never listed, never guessable from a sequential id.
-- Authenticated owners (the consultant issuing the link, viewing history)
-- go through the normal owner-scoped policies below.
-- ---------------------------------------------------------------------------
create table if not exists ceo_validation_tokens (
  id uuid primary key default gen_random_uuid(),
  transformation_id uuid not null references transformations (id) on delete cascade,
  trajectory_id uuid not null references trajectories (id) on delete cascade,
  decision_snapshot timestamptz not null,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  outcome text check (outcome in ('validated', 'needs_more_info', 'rejected')),
  outcome_note text,
  created_at timestamptz not null default now()
);

create index if not exists ceo_validation_tokens_transformation_id_idx on ceo_validation_tokens (transformation_id);
-- token already has a unique index via the `unique` constraint above, which
-- is exactly the lookup the validate route performs — no extra index needed.

alter table ceo_validation_tokens enable row level security;

-- Owner (consultant) can see/issue links and read the validation history for
-- their own projects. No policy at all for anon/other authenticated users —
-- the token route bypasses RLS entirely via the service role, by design.
create policy "ceo_validation_tokens_select_own" on ceo_validation_tokens
  for select to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = ceo_validation_tokens.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "ceo_validation_tokens_insert_own" on ceo_validation_tokens
  for insert to authenticated
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = ceo_validation_tokens.transformation_id
        and o.owner_id = auth.uid()
    )
  );
