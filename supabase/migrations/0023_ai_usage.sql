-- ai_usage — one row per Anthropic call made on behalf of a user, used as a
-- simple per-user, per-route daily quota (see assertAiQuota in
-- src/lib/anthropic.ts). No Redis/Upstash: the count is a plain query on this
-- table over the last 24h.
--
-- Purely additive.
create table if not exists ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  route text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_user_route_created_idx on ai_usage (user_id, route, created_at desc);

alter table ai_usage enable row level security;

-- A user may only record usage for themselves.
create policy "ai_usage_insert_own" on ai_usage
  for insert to authenticated
  with check (user_id = auth.uid());

-- Required for the quota count itself: route handlers query through the
-- user's own session (RLS applies), so without a select policy the count
-- would always be 0 and the quota would never trigger. Own rows only.
-- Deliberately no update/delete policy: a user can't erase their own usage.
create policy "ai_usage_select_own" on ai_usage
  for select to authenticated
  using (user_id = auth.uid());
