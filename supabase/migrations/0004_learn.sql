-- 4 Tomorrow — LEARN module
-- Purely additive on top of 0001/0002/0003. Every prior module keeps
-- working unchanged.
--
-- Design notes:
--   * `trainings.transformation_id` is NOT NULL — even a training opened
--     standalone (not from an existing Decide diagnostic) gets its own
--     transformation row (same "reuse-or-create one org per user" pattern
--     already used everywhere else), so it's never an orphan run outside
--     the connected-project model.
--   * Content fields are schemaless jsonb for the same reason as DECIDE's
--     scenario fields: shape adapts to the subject and is enforced in
--     application code (src/lib/learn.ts), not the database.
--   * The "fiche Qualiopi" (objectifs, prérequis, public, méthode, preuve
--     d'évaluation) is NOT a separate blob — it's derived at render time
--     from columns that already exist for another reason (objectives,
--     prerequisites, audience, comprehension_check), so there is nothing
--     to keep in sync.

create table if not exists trainings (
  id uuid primary key default gen_random_uuid(),
  transformation_id uuid not null references transformations (id) on delete cascade,
  topic text not null,
  mode text not null default 'rapide' check (mode in ('rapide', 'document', 'diagnostic')),
  domains jsonb not null default '[]'::jsonb,
  audience text,
  objectives jsonb not null default '[]'::jsonb,       -- string[] — Qualiopi C2
  prerequisites text,                                    -- Qualiopi C3
  duration_minutes integer,
  executive_summary jsonb not null default '{}'::jsonb,  -- { addressedChallenge, summary, actionPlan: string[] }
  key_insights jsonb not null default '[]'::jsonb,       -- [{ text, source? }]
  business_implications jsonb not null default '[]'::jsonb, -- [{ text }]
  flashcards jsonb not null default '[]'::jsonb,         -- [{ question, answer, category }]
  comprehension_check jsonb not null default '[]'::jsonb, -- [{ question, options:[{id,text}], correctOptionId, explanation }] — Qualiopi C7
  video_script jsonb not null default '{}'::jsonb,       -- { title, scenes:[{sceneNumber, narration, visualSuggestion, durationSeconds}] }
  source_doc_name text,
  created_at timestamptz not null default now()
);

create index if not exists trainings_transformation_id_idx on trainings (transformation_id);

alter table trainings enable row level security;

create policy "trainings_select_own" on trainings
  for select to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = trainings.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "trainings_insert_own" on trainings
  for insert to authenticated
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = trainings.transformation_id
        and o.owner_id = auth.uid()
    )
  );

do $$
begin
  begin
    execute 'alter publication supabase_realtime add table trainings';
  exception when duplicate_object then
    null;
  end;
end $$;
