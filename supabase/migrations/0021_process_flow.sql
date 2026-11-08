-- 4 Tomorrow — D02 cartographie dynamique (délai / goulot / leviers « et
-- si »). Purely additive. Numbers are computed in
-- src/lib/decide-flow-calc.ts (pure, unit-tested) and written as-is by the
-- API route — this table never receives a value invented by the AI.
--
-- One row per transformation: `steps`/`demand`/`levers` are the current,
-- user-entered data (manual edit or CSV import); `result` is the last
-- computed FlowResult for exactly that data. A client that edits
-- steps/demand/levers without recomputing shows those edits immediately but
-- flags the still-displayed `result` as « à revoir » (src/components/decide/
-- flow-view.tsx compares a signature of the current inputs to the ones the
-- stored result was computed from) — never silently stale.
create table if not exists process_flows (
  transformation_id uuid primary key references transformations (id) on delete cascade,
  demand numeric not null default 0,
  steps jsonb not null default '[]'::jsonb,
  levers jsonb not null default '{"waitCut": {}, "capAdd": {}}'::jsonb,
  result jsonb, -- null tant qu'aucun calcul n'a réussi
  updated_at timestamptz not null default now()
);

alter table process_flows enable row level security;

create policy "process_flows_select_own" on process_flows
  for select to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = process_flows.transformation_id
        and o.owner_id = auth.uid()
    )
    or is_transformation_member(process_flows.transformation_id)
  );

create policy "process_flows_insert_own" on process_flows
  for insert to authenticated
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = process_flows.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "process_flows_update_own" on process_flows
  for update to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = process_flows.transformation_id
        and o.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = process_flows.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "process_flows_delete_own" on process_flows
  for delete to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = process_flows.transformation_id
        and o.owner_id = auth.uid()
    )
  );
