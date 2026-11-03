-- 4 Tomorrow — D04 decision matrix: deterministic weighting, veto, sensitivity.
--
-- Purely additive. `trajectories.scores` (the AI-generated radarScores, 0-10
-- per axis) is left untouched — it stays the AI's honest read of each
-- scenario's standing on each criterion. What this migration adds is the
-- part the brief requires to be user-controlled and calculated, never
-- invented by the model:
--   - a veto flag per scenario (a vetoed option can never rank first —
--     enforced in src/lib/decide-scenario-calc.ts, not here)
--   - user-adjustable weights per criterion (axis), one set per
--     transformation, shared across its 3 scenarios, required to sum to 100
--   - the weighted ranking and ±10pt sensitivity check are pure
--     computations (src/lib/decide-scenario-calc.ts, unit-tested) over
--     `trajectories.scores` × these weights — never AI output taken as
--     final.

alter table trajectories add column if not exists veto boolean not null default false;

create table if not exists decision_criteria_weights (
  id uuid primary key default gen_random_uuid(),
  transformation_id uuid not null references transformations (id) on delete cascade,
  axis text not null,
  weight integer not null check (weight between 0 and 100),
  updated_at timestamptz not null default now(),
  unique (transformation_id, axis)
);

create index if not exists decision_criteria_weights_transformation_id_idx
  on decision_criteria_weights (transformation_id);

alter table decision_criteria_weights enable row level security;

-- Same owner-only pattern as every other transformation-scoped table
-- (see 0001_init.sql / 0002_decide.sql / 0011_capability_assessment.sql).
create policy "decision_criteria_weights_select_own" on decision_criteria_weights
  for select to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = decision_criteria_weights.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "decision_criteria_weights_insert_own" on decision_criteria_weights
  for insert to authenticated
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = decision_criteria_weights.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "decision_criteria_weights_update_own" on decision_criteria_weights
  for update to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = decision_criteria_weights.transformation_id
        and o.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = decision_criteria_weights.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "decision_criteria_weights_delete_own" on decision_criteria_weights
  for delete to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = decision_criteria_weights.transformation_id
        and o.owner_id = auth.uid()
    )
  );
