-- 4 Tomorrow — LEARN: workshop prep mode
--
-- A 4th Learn mode alongside rapide/document/diagnostic: instead of a
-- training package (flashcards/quiz/video) for individual self-study, a
-- "workshop" run takes the workshop's objective as input and produces
-- facilitation material — support content to present plus an ordered,
-- timed step-by-step agenda — for someone running a live group session.
-- Additive only: existing rapide/document/diagnostic trainings keep
-- workshop_intro/workshop_support/workshop_steps null and render exactly
-- as before.
alter table trainings drop constraint if exists trainings_mode_check;
alter table trainings add constraint trainings_mode_check
  check (mode in ('rapide', 'document', 'diagnostic', 'workshop'));

alter table trainings add column if not exists workshop_intro jsonb; -- { context, expectedOutcome }
alter table trainings add column if not exists workshop_support jsonb; -- [{ title, content }]
alter table trainings add column if not exists workshop_steps jsonb; -- [{ order, title, durationMinutes, description, materials: string[] }]
