-- 4 Tomorrow — persist Connect's full matching output
--
-- Same gap as the one fixed for Decide in 0006: /api/match generated and
-- returned strategicBrief and goodIdeas, but never wrote them to the
-- database — only gaps and matches were persisted. That meant Connect
-- could never rehydrate a past run's full output, only its inputs.
alter table transformations add column if not exists strategic_brief text;
alter table transformations add column if not exists good_ideas jsonb not null default '[]'::jsonb; -- string[]
