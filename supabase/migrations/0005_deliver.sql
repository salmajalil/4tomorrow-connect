-- 4 Tomorrow — DELIVER module
-- Purely additive on top of 0001-0004. Every prior module keeps working
-- unchanged.
--
-- Design notes:
--   * DECIDE's "Choisir ce scénario" button was previously UI-only state
--     (never written to the database) — DELIVER needs to know which
--     trajectory was actually chosen to know what to execute, so this
--     migration persists it on `transformations`.
--   * `roadmap_phases` gains real-vs-planned execution tracking — DECIDE's
--     roadmap is a read-only preview used to compare scenarios; DELIVER's
--     Gantt becomes pilotable (per-phase status, actual dates) on the same
--     rows rather than a parallel copy.
--   * `risks` already lacked the `module_origin` column that `opportunities`
--     already had — DELIVER's execution risks need to be visibly distinct
--     from DECIDE's strategic risks the same way opportunities already are.
--   * `deliverables` content is schemaless jsonb for the same reason as
--     every other module's generated content: shape varies per kind and is
--     enforced in application code (src/lib/deliver.ts), not the database.
--   * `mission_feedback` stores the AI's recalibration proposal separately
--     from applying it — `applied` stays false until the user explicitly
--     confirms, never a silent automatic rewrite of the roadmap.

alter table transformations add column if not exists selected_trajectory_id uuid references trajectories (id) on delete set null;

alter table roadmap_phases add column if not exists actual_start_date date;
alter table roadmap_phases add column if not exists actual_end_date date;
alter table roadmap_phases add column if not exists execution_status text not null default 'upcoming' check (execution_status in ('upcoming', 'in_progress', 'done'));

alter table risks add column if not exists module_origin text not null default 'decide';

create table if not exists deliverables (
  id uuid primary key default gen_random_uuid(),
  transformation_id uuid not null references transformations (id) on delete cascade,
  trajectory_id uuid not null references trajectories (id) on delete cascade,
  kind text not null check (kind in ('roadmap', 'action_plan', 'kpi_dashboard', 'risk_map', 'executive_report', 'toolkit')),
  title text not null,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (transformation_id, trajectory_id, kind)
);

create index if not exists deliverables_transformation_id_idx on deliverables (transformation_id);

alter table deliverables enable row level security;

create policy "deliverables_select_own" on deliverables
  for select to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = deliverables.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "deliverables_insert_own" on deliverables
  for insert to authenticated
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = deliverables.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "deliverables_update_own" on deliverables
  for update to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = deliverables.transformation_id
        and o.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = deliverables.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create table if not exists mission_feedback (
  id uuid primary key default gen_random_uuid(),
  transformation_id uuid not null references transformations (id) on delete cascade,
  trajectory_id uuid not null references trajectories (id) on delete cascade,
  feedback_text text not null,
  ai_summary jsonb not null default '{}'::jsonb,
  applied boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists mission_feedback_transformation_id_idx on mission_feedback (transformation_id);

alter table mission_feedback enable row level security;

create policy "mission_feedback_select_own" on mission_feedback
  for select to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = mission_feedback.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "mission_feedback_insert_own" on mission_feedback
  for insert to authenticated
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = mission_feedback.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "mission_feedback_update_own" on mission_feedback
  for update to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = mission_feedback.transformation_id
        and o.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = mission_feedback.transformation_id
        and o.owner_id = auth.uid()
    )
  );

-- Missing until now: DECIDE's roadmap preview was read-only (select/insert/
-- delete-for-regenerate), so no update policy existed. DELIVER's Gantt
-- needs to update execution_status/actual dates per phase in place.
create policy "roadmap_phases_update_own" on roadmap_phases
  for update to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = roadmap_phases.transformation_id
        and o.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = roadmap_phases.transformation_id
        and o.owner_id = auth.uid()
    )
  );

do $$
begin
  begin
    execute 'alter publication supabase_realtime add table deliverables';
  exception when duplicate_object then
    null;
  end;
  begin
    execute 'alter publication supabase_realtime add table mission_feedback';
  exception when duplicate_object then
    null;
  end;
end $$;
