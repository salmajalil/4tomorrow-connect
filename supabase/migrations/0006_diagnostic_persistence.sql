-- 4 Tomorrow — persist the diagnostic's full narrative output
--
-- The diagnostic API response (maturityReading, rootCauses, decisionCriteria,
-- startingRecommendation) was never written to the database — only
-- gaps/priorities/risks/domains were. That meant leaving the Decide page
-- (or reloading it) permanently lost that content; there was no way to
-- reconstruct it from what was stored. This closes that gap so
-- /decide can rehydrate a past diagnostic in full.
alter table transformations add column if not exists maturity_reading text;
alter table transformations add column if not exists root_causes jsonb not null default '[]'::jsonb; -- [{ name, reason }]
alter table transformations add column if not exists decision_criteria jsonb not null default '[]'::jsonb; -- [string]
alter table transformations add column if not exists starting_recommendation text;

-- Same gap on priorities: the diagnostic's 0-100 weight per priority (used
-- for the weighted-bar visualization) was computed and shown once, never
-- saved.
alter table priorities add column if not exists weight integer;
