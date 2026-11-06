-- Connecter — "Demander un rendez-vous" sur une fiche partenaire/expert.
--
-- Purely additive. No mailer exists anywhere in this codebase (same finding
-- as the team-invite feature, src/app/api/control-tower/invite-member) — this
-- only records the request server-side; the UI says plainly that no
-- automatic email goes out yet, same honesty as teamInviteNotice.
--
-- match_id is nullable: a request can target a match that was never
-- persisted to `matches` (e.g. a web-sourced candidate not saved by the
-- user) — partner_name is always stored as plain text so the request
-- stands on its own either way.
create table if not exists meeting_requests (
  id uuid primary key default gen_random_uuid(),
  transformation_id uuid not null references transformations (id) on delete cascade,
  match_id uuid references matches (id) on delete set null,
  partner_name text not null,
  requester_name text not null,
  requester_email text not null,
  message text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists meeting_requests_transformation_id_idx on meeting_requests (transformation_id);

alter table meeting_requests enable row level security;

-- Same owner-only pattern as every other transformation-scoped table (see
-- 0001_init.sql / 0011_capability_assessment.sql).
create policy "meeting_requests_select_own" on meeting_requests
  for select to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = meeting_requests.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "meeting_requests_insert_own" on meeting_requests
  for insert to authenticated
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = meeting_requests.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "meeting_requests_delete_own" on meeting_requests
  for delete to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = meeting_requests.transformation_id
        and o.owner_id = auth.uid()
    )
  );
