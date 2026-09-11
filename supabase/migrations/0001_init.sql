-- 4 Tomorrow — shared foundation schema
-- Supports all four modules (DECIDE, CONNECT, DELIVER, LEARN) from day one.
-- Only CONNECT is exercised by the application today; `trajectories` and
-- `risks` sit ready for DECIDE without any further migration work.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  industry text,
  created_at timestamptz not null default now()
);

create index if not exists organizations_owner_id_idx on organizations (owner_id);

-- ---------------------------------------------------------------------------
-- transformations
-- ---------------------------------------------------------------------------
create table if not exists transformations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  challenges text,
  objectives text,
  constraints text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create index if not exists transformations_organization_id_idx on transformations (organization_id);

-- ---------------------------------------------------------------------------
-- gaps (per-transformation, feeds DECIDE + the CONNECT matching prompt)
-- ---------------------------------------------------------------------------
create table if not exists gaps (
  id uuid primary key default gen_random_uuid(),
  transformation_id uuid not null references transformations (id) on delete cascade,
  name text not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists gaps_transformation_id_idx on gaps (transformation_id);

-- ---------------------------------------------------------------------------
-- priorities
-- ---------------------------------------------------------------------------
create table if not exists priorities (
  id uuid primary key default gen_random_uuid(),
  transformation_id uuid not null references transformations (id) on delete cascade,
  name text not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists priorities_transformation_id_idx on priorities (transformation_id);

-- ---------------------------------------------------------------------------
-- ecosystem_members — the shared, crowd-contributed directory.
-- Deliberately NOT scoped to an organization or a transformation: it is one
-- shared table across every user of the platform. See the matching route
-- (src/app/api/match/route.ts) for how this table is re-injected as model
-- context on every CONNECT run — that read -> inject -> label-the-source
-- loop is the "living directory" mechanism referenced in the IP note there.
-- ---------------------------------------------------------------------------
create table if not exists ecosystem_members (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users (id) on delete set null,
  name text not null,
  type text not null, -- free text: startup / technology / expert / partner / ... (never a closed enum, mirrors the onboarding "add your own" pattern)
  website text,
  description text,
  contact text,
  created_at timestamptz not null default now()
);

create index if not exists ecosystem_members_type_idx on ecosystem_members (type);

-- ---------------------------------------------------------------------------
-- matches — one row per recommendation returned by a CONNECT run
-- ---------------------------------------------------------------------------
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  transformation_id uuid not null references transformations (id) on delete cascade,
  category text not null, -- technology / startup / expert / partner
  name text not null,
  reason text,
  gap_addressed text,
  website text,
  contact_email text,
  ecosystem_member_id uuid references ecosystem_members (id) on delete set null,
  source text not null check (source in ('registry', 'web_search')),
  created_at timestamptz not null default now()
);

create index if not exists matches_transformation_id_idx on matches (transformation_id);
create index if not exists matches_ecosystem_member_id_idx on matches (ecosystem_member_id);

-- ---------------------------------------------------------------------------
-- trajectories — reserved for DECIDE, created now so the schema needs no
-- follow-up migration when that module is built in its own session.
-- ---------------------------------------------------------------------------
create table if not exists trajectories (
  id uuid primary key default gen_random_uuid(),
  transformation_id uuid not null references transformations (id) on delete cascade,
  name text not null,
  stance text,
  description text,
  cost_delta numeric,
  co2_reduction numeric,
  roi_years numeric,
  tech_stack jsonb not null default '[]'::jsonb, -- [{ name, maturity }]
  scores jsonb not null default '{}'::jsonb, -- { cost, co2, risk, roi, feasibility }
  created_at timestamptz not null default now()
);

create index if not exists trajectories_transformation_id_idx on trajectories (transformation_id);

-- ---------------------------------------------------------------------------
-- risks — reserved for DECIDE
-- ---------------------------------------------------------------------------
create table if not exists risks (
  id uuid primary key default gen_random_uuid(),
  transformation_id uuid not null references transformations (id) on delete cascade,
  name text not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists risks_transformation_id_idx on risks (transformation_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Brief only calls out `transformations` and `gaps`/`priorities` explicitly,
-- but `priorities`, `matches`, `trajectories` and `risks` all hang off a
-- transformation and can carry the same sensitive strategy content, so the
-- same owner-only policy is applied consistently to every transformation-
-- scoped table. `ecosystem_members` is the one deliberately shared table:
-- open read/write to any authenticated user, no per-row ownership check.
-- ---------------------------------------------------------------------------

alter table organizations enable row level security;
alter table transformations enable row level security;
alter table gaps enable row level security;
alter table priorities enable row level security;
alter table matches enable row level security;
alter table trajectories enable row level security;
alter table risks enable row level security;
alter table ecosystem_members enable row level security;

-- organizations: a user only ever sees/edits organizations they own.
create policy "organizations_select_own" on organizations
  for select to authenticated
  using (owner_id = auth.uid());

create policy "organizations_insert_own" on organizations
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy "organizations_update_own" on organizations
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "organizations_delete_own" on organizations
  for delete to authenticated
  using (owner_id = auth.uid());

-- transformations: scoped through the owning organization.
create policy "transformations_select_own" on transformations
  for select to authenticated
  using (
    exists (
      select 1 from organizations o
      where o.id = transformations.organization_id
        and o.owner_id = auth.uid()
    )
  );

create policy "transformations_insert_own" on transformations
  for insert to authenticated
  with check (
    exists (
      select 1 from organizations o
      where o.id = transformations.organization_id
        and o.owner_id = auth.uid()
    )
  );

create policy "transformations_update_own" on transformations
  for update to authenticated
  using (
    exists (
      select 1 from organizations o
      where o.id = transformations.organization_id
        and o.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from organizations o
      where o.id = transformations.organization_id
        and o.owner_id = auth.uid()
    )
  );

create policy "transformations_delete_own" on transformations
  for delete to authenticated
  using (
    exists (
      select 1 from organizations o
      where o.id = transformations.organization_id
        and o.owner_id = auth.uid()
    )
  );

-- Reusable shape for gaps / priorities / matches / trajectories / risks:
-- ownership is checked by joining transformation_id -> transformations -> organizations.

create policy "gaps_select_own" on gaps
  for select to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = gaps.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "gaps_insert_own" on gaps
  for insert to authenticated
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = gaps.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "gaps_update_own" on gaps
  for update to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = gaps.transformation_id
        and o.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = gaps.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "gaps_delete_own" on gaps
  for delete to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = gaps.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "priorities_select_own" on priorities
  for select to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = priorities.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "priorities_insert_own" on priorities
  for insert to authenticated
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = priorities.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "priorities_update_own" on priorities
  for update to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = priorities.transformation_id
        and o.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = priorities.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "priorities_delete_own" on priorities
  for delete to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = priorities.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "matches_select_own" on matches
  for select to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = matches.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "matches_insert_own" on matches
  for insert to authenticated
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = matches.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "matches_delete_own" on matches
  for delete to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = matches.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "trajectories_select_own" on trajectories
  for select to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = trajectories.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "trajectories_insert_own" on trajectories
  for insert to authenticated
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = trajectories.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "risks_select_own" on risks
  for select to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = risks.transformation_id
        and o.owner_id = auth.uid()
    )
  );

create policy "risks_insert_own" on risks
  for insert to authenticated
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = risks.transformation_id
        and o.owner_id = auth.uid()
    )
  );

-- ecosystem_members: shared directory. Any authenticated user can read and
-- contribute. Delete is intentionally NOT granted here (open write should
-- not mean anyone can wipe another contributor's entry) — add a policy
-- explicitly if the product later wants that.
create policy "ecosystem_members_select_all" on ecosystem_members
  for select to authenticated
  using (true);

create policy "ecosystem_members_insert_all" on ecosystem_members
  for insert to authenticated
  with check (true);

create policy "ecosystem_members_update_all" on ecosystem_members
  for update to authenticated
  using (true)
  with check (true);
