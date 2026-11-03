-- 4 Tomorrow — C02 pertinence fournisseur: deterministic supplier assessment
--
-- Purely additive: `matches` (the AI-assisted discovery output — see the
-- doc comment at the top of src/lib/matching.ts) is left untouched. This
-- new table carries the structured, numeric part of the assessment that
-- the brief's C02 rule requires to be calculated, never invented by the
-- model: prerequisites are eliminatory, only criteria proven "vérifié"
-- count toward the score, and a supplier is never "recommandé" without
-- every justificatif. The numbers are computed in
-- src/lib/connect-supplier-calc.ts (pure, unit-tested) and written here
-- as-is by the API route — this table never receives a value chosen by
-- the AI.
--
-- Structured as jsonb arrays (prerequisites/criteria) rather than child
-- tables: the set of prerequisites/criteria is project-specific and
-- user-defined (no fixed taxonomy exists today), matching the existing
-- precedent of jsonb-array columns elsewhere in this schema (e.g.
-- transformations.good_ideas).
create table if not exists supplier_assessments (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches (id) on delete cascade,
  transformation_id uuid not null references transformations (id) on delete cascade,
  -- [{ "label": text, "met": boolean }]
  prerequisites jsonb not null default '[]'::jsonb,
  -- [{ "label": text, "score": integer|null, "proofStatus": "vérifié"|"manquant"|"périmé", "proofDate": text|null }]
  criteria jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (match_id)
);

create index if not exists supplier_assessments_transformation_id_idx
  on supplier_assessments (transformation_id);

alter table supplier_assessments enable row level security;

-- Same owner-only pattern as every other transformation-scoped table (see
-- 0001_init.sql / 0011_capability_assessment.sql). Broader team-role
-- access (consultant/client/expert/ceo) will layer on top once the
-- separate team/role-architecture work lands — this stays owner-only like
-- everything else in the schema today.
create policy "supplier_assessments_select_own" on supplier_assessments
  for select to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = supplier_assessments.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "supplier_assessments_insert_own" on supplier_assessments
  for insert to authenticated
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = supplier_assessments.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "supplier_assessments_update_own" on supplier_assessments
  for update to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = supplier_assessments.transformation_id
        and o.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = supplier_assessments.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "supplier_assessments_delete_own" on supplier_assessments
  for delete to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = supplier_assessments.transformation_id
        and o.owner_id = auth.uid()
    )
  );
