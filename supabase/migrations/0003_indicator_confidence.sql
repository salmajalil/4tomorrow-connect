-- 4 Tomorrow — DECIDE indicator confidence & validation loop
-- Purely additive on top of 0002_decide.sql.
--
-- Why: scenario indicators (cost delta, CO2 reduction, ROI...) were being
-- presented as flat facts even though the model can only ever be certain
-- about a number it found via web search — everything else is an estimate,
-- and some figures genuinely can't be estimated at all from the intake
-- alone. Presenting all three the same way is a credibility risk. Fix:
-- `trajectories.indicators` now stores, per key, { value, confidence,
-- source? } instead of a bare value (application-level shape, still jsonb —
-- schemaless on purpose, same reasoning as the original DECIDE migration).
-- Confidence is one of "verified" (found with a source) / "estimate"
-- (model's best reasoning) / "unknown" (value is null, needs a human to
-- fill it in). This migration only adds the column that captures what a
-- human decided about an estimate — it does not reshape `indicators`
-- itself, since that column is already schemaless jsonb and the new shape
-- is enforced by the application (src/lib/decide.ts), not the database.

alter table trajectories add column if not exists indicators_feedback jsonb not null default '{}'::jsonb;
-- { [indicatorKey]: "confirmed" | "disputed" } — set by the transformation
-- owner validating an "estimate"-confidence indicator in the UI.

-- Owner can now correct an "unknown" indicator's value (expert input) or
-- overwrite indicators_feedback — insert/select already existed, update
-- did not.
create policy "trajectories_update_own" on trajectories
  for update to authenticated
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = trajectories.transformation_id
        and o.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = trajectories.transformation_id
        and o.owner_id = auth.uid()
    )
  );
