-- 4 Tomorrow — scannable highlights for the dense paragraph fields
--
-- The diagnostic's maturity reading, starting recommendation, and each
-- scenario's executive briefing were a single prose paragraph each —
-- fine as a model output, bad as the first thing a reader sees. Rather
-- than replacing the paragraphs (full detail still matters), the AI now
-- also returns 2-4 short bullet highlights alongside each one; the UI
-- shows the bullets up front and tucks the full paragraph into the
-- existing "detail" sections. Learn's equivalent (summaryHighlights)
-- needs no migration — it lives inside the existing executive_summary
-- jsonb blob.
alter table transformations add column if not exists maturity_highlights jsonb; -- string[]
alter table transformations add column if not exists starting_actions jsonb; -- string[]
alter table trajectories add column if not exists briefing_highlights jsonb; -- string[]
