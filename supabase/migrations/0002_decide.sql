-- 4 Tomorrow — DECIDE module schema additions
-- Purely additive on top of 0001_init.sql: existing CONNECT functionality
-- (organizations/transformations/ecosystem_members/matches as used today)
-- keeps working unchanged. New columns are nullable or default-valued.
--
-- Design notes:
--   * `module_status` is kept updated by application code on every write to
--     a module's tables (see src/lib/module-status.ts), not a DB trigger —
--     simpler to reason about and debug than a trigger function, with the
--     same observable "updates automatically" behavior for the user.
--   * `matches.trajectory_id` / `risks.trajectory_id` are nullable: null
--     means "general CONNECT run" / "transverse diagnostic risk" (today's
--     behavior, unchanged); non-null ties a row to one DECIDE scenario.
--   * Scenario indicators are intentionally schemaless (jsonb) — the whole
--     point of DECIDE's "principe directeur" is that the indicator set
--     adapts to the type of challenge, so a fixed column set would fight
--     that requirement.

-- ---------------------------------------------------------------------------
-- transformations: domain classification (Manufacturing / R&D / GTM /
-- Strategy / Digitalization — a challenge can span more than one)
-- ---------------------------------------------------------------------------
alter table transformations add column if not exists domains jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- trajectories: extend to carry full DECIDE scenario content.
-- tech_stack (already jsonb from 0001) now carries richer entries per item:
--   { name, maturity, maturityScale, detail, benefit }
-- scores (already jsonb from 0001) stays the radar axis map — keys adapt
-- per domain (e.g. { cost, co2, risk, roi, feasibility } vs
-- { cost, speed, risk, roi, scalability }), always including cost/risk/roi/feasibility-or-equivalent.
-- ---------------------------------------------------------------------------
alter table trajectories add column if not exists indicators jsonb not null default '{}'::jsonb; -- adaptive KPI map, e.g. { costDelta, timeToMarket, roiMonths }
alter table trajectories add column if not exists regulations jsonb not null default '[]'::jsonb; -- [{ name, description, sourceUrl }]
alter table trajectories add column if not exists executive_briefing text;
alter table trajectories add column if not exists roadmap_start_date date;
alter table trajectories add column if not exists priority_cost integer;   -- 0-100 sliders, co-built with the client
alter table trajectories add column if not exists priority_co2 integer;    -- meaning adapts per domain (documented in UI copy)
alter table trajectories add column if not exists priority_risk integer;
alter table trajectories add column if not exists priority_speed integer;

-- ---------------------------------------------------------------------------
-- matches: allow tying a CONNECT-style recommendation to one DECIDE scenario
-- ---------------------------------------------------------------------------
alter table matches add column if not exists trajectory_id uuid references trajectories (id) on delete cascade;
create index if not exists matches_trajectory_id_idx on matches (trajectory_id);

-- ---------------------------------------------------------------------------
-- risks: allow tying a risk to one scenario (null = transverse diagnostic risk)
-- ---------------------------------------------------------------------------
alter table risks add column if not exists trajectory_id uuid references trajectories (id) on delete cascade;
create index if not exists risks_trajectory_id_idx on risks (trajectory_id);

-- ---------------------------------------------------------------------------
-- opportunities — mirror of risks, feeds the Control Tower
-- ---------------------------------------------------------------------------
create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  transformation_id uuid not null references transformations (id) on delete cascade,
  trajectory_id uuid references trajectories (id) on delete cascade,
  name text not null,
  reason text,
  module_origin text not null default 'decide', -- which module surfaced this opportunity
  created_at timestamptz not null default now()
);

create index if not exists opportunities_transformation_id_idx on opportunities (transformation_id);
create index if not exists opportunities_trajectory_id_idx on opportunities (trajectory_id);

-- ---------------------------------------------------------------------------
-- roadmap_phases — the interactive Gantt for a chosen trajectory
-- ---------------------------------------------------------------------------
create table if not exists roadmap_phases (
  id uuid primary key default gen_random_uuid(),
  transformation_id uuid not null references transformations (id) on delete cascade,
  trajectory_id uuid not null references trajectories (id) on delete cascade,
  phase_name text not null,
  start_date date not null,
  end_date date not null,
  deliverables jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  kpis jsonb not null default '[]'::jsonb,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists roadmap_phases_transformation_id_idx on roadmap_phases (transformation_id);
create index if not exists roadmap_phases_trajectory_id_idx on roadmap_phases (trajectory_id);

-- ---------------------------------------------------------------------------
-- module_recommendations — computed right after the diagnostic, freely
-- overridable by the user; never gates or auto-launches a module.
-- ---------------------------------------------------------------------------
create table if not exists module_recommendations (
  id uuid primary key default gen_random_uuid(),
  transformation_id uuid not null references transformations (id) on delete cascade,
  module text not null check (module in ('connect', 'deliver', 'learn')),
  relevance text not null check (relevance in ('relevant', 'possible', 'not_relevant')),
  reason text,
  user_override boolean not null default false,
  created_at timestamptz not null default now(),
  unique (transformation_id, module)
);

create index if not exists module_recommendations_transformation_id_idx on module_recommendations (transformation_id);

-- ---------------------------------------------------------------------------
-- module_status — per-transformation, per-module progress badge, kept
-- current by application code (see src/lib/module-status.ts) on every
-- write to that module's own tables.
-- ---------------------------------------------------------------------------
create table if not exists module_status (
  id uuid primary key default gen_random_uuid(),
  transformation_id uuid not null references transformations (id) on delete cascade,
  module text not null check (module in ('decide', 'connect', 'deliver', 'learn')),
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'done')),
  updated_at timestamptz not null default now(),
  unique (transformation_id, module)
);

create index if not exists module_status_transformation_id_idx on module_status (transformation_id);

-- ---------------------------------------------------------------------------
-- profiles — per-user preferences (language). Supabase auth.users itself
-- is not writable by app code, so preferences live in their own table.
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  language text not null default 'fr' check (language in ('fr', 'en')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security — same owner-through-transformation pattern as 0001.
-- ---------------------------------------------------------------------------
alter table opportunities enable row level security;
alter table roadmap_phases enable row level security;
alter table module_recommendations enable row level security;
alter table module_status enable row level security;
alter table profiles enable row level security;

create policy "opportunities_select_own" on opportunities
  for select to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = opportunities.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "opportunities_insert_own" on opportunities
  for insert to authenticated
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = opportunities.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "roadmap_phases_select_own" on roadmap_phases
  for select to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = roadmap_phases.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "roadmap_phases_insert_own" on roadmap_phases
  for insert to authenticated
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = roadmap_phases.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "roadmap_phases_delete_own" on roadmap_phases
  for delete to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = roadmap_phases.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "module_recommendations_select_own" on module_recommendations
  for select to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = module_recommendations.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "module_recommendations_insert_own" on module_recommendations
  for insert to authenticated
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = module_recommendations.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "module_recommendations_update_own" on module_recommendations
  for update to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = module_recommendations.transformation_id
        and o.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = module_recommendations.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "module_status_select_own" on module_status
  for select to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = module_status.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "module_status_insert_own" on module_status
  for insert to authenticated
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = module_status.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "module_status_update_own" on module_status
  for update to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = module_status.transformation_id
        and o.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = module_status.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "profiles_select_own" on profiles
  for select to authenticated
  using (id = auth.uid());

create policy "profiles_insert_own" on profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy "profiles_update_own" on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Realtime — let modules subscribe to live changes instead of polling.
-- Wrapped per-table in a DO block so re-running this migration (or a table
-- already being a publication member) doesn't error out.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'transformations', 'gaps', 'priorities', 'trajectories', 'risks',
    'matches', 'opportunities', 'module_recommendations', 'module_status'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then
      null; -- already a member, fine
    end;
  end loop;
end $$;
