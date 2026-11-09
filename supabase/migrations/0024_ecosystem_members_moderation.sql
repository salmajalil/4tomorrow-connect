-- ecosystem_members moderation.
--
-- The shared directory is re-injected into the system prompt of EVERY user
-- (Connecter matching, Décider scenarios). Until now any authenticated user
-- could insert (and update) rows with no review — a cross-tenant prompt
-- injection vector. From now on a row only reaches a prompt once it has been
-- explicitly marked 'approved' (manually in the database for now — no admin
-- UI yet).
--
-- Existing rows also default to 'pending' (they were never reviewed either):
-- approve them manually after review, e.g.
--   update ecosystem_members set status = 'approved' where id in (...);

alter table ecosystem_members
  add column if not exists status text not null default 'pending'
  check (status in ('pending', 'approved', 'rejected'));

create index if not exists ecosystem_members_status_idx on ecosystem_members (status);

-- A contributor can only create a pending row, under their own identity —
-- never self-approve.
alter policy "ecosystem_members_insert_all" on ecosystem_members
  with check (created_by = auth.uid() and status = 'pending');

-- Previously open to every authenticated user on every row (anyone could
-- rewrite an approved entry). Now: only the contributor, on their own row,
-- and any edit puts it back to 'pending' for re-review.
alter policy "ecosystem_members_update_all" on ecosystem_members
  using (created_by = auth.uid())
  with check (created_by = auth.uid() and status = 'pending');
