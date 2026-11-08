-- 0018 fixed the RLS recursion bug by introducing is_transformation_member()
-- and applied it to every table that existed at the time (transformations,
-- gaps, priorities, matches, trajectories, risks, opportunities,
-- roadmap_phases, module_recommendations, module_status,
-- capability_assessments). Every table created afterwards by a parallel
-- workstream (D04 weights, F01 skills, C02 suppliers, the transverse
-- actions table, L06 benefits, D05 business case, Connect meeting
-- requests) kept the original owner-only SELECT policy and never got the
-- same fix — an invited team member (consultant/client/expert role via
-- transformation_members) silently sees an empty screen on every one of
-- these tools instead of the organization owner's data. This migration
-- closes that gap for all of them, same pattern as 0018.
--
-- training_suggestions (organization-scoped catalog, not transformation-
-- scoped) and ceo_validation_tokens (single-use, recipient has no account)
-- are intentionally left untouched — this isn't a bug for either.

alter policy "decision_criteria_weights_select_own" on decision_criteria_weights
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = decision_criteria_weights.transformation_id
        and o.owner_id = auth.uid()
    )
    or is_transformation_member(decision_criteria_weights.transformation_id)
  );

alter policy "skill_assessments_select_own" on skill_assessments
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = skill_assessments.transformation_id
        and o.owner_id = auth.uid()
    )
    or is_transformation_member(skill_assessments.transformation_id)
  );

alter policy "supplier_assessments_select_own" on supplier_assessments
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = supplier_assessments.transformation_id
        and o.owner_id = auth.uid()
    )
    or is_transformation_member(supplier_assessments.transformation_id)
  );

alter policy "actions_select_own" on actions
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = actions.transformation_id
        and o.owner_id = auth.uid()
    )
    or is_transformation_member(actions.transformation_id)
  );

alter policy "benefit_expectations_select_own" on benefit_expectations
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = benefit_expectations.transformation_id
        and o.owner_id = auth.uid()
    )
    or is_transformation_member(benefit_expectations.transformation_id)
  );

alter policy "benefit_items_select_own" on benefit_items
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = benefit_items.transformation_id
        and o.owner_id = auth.uid()
    )
    or is_transformation_member(benefit_items.transformation_id)
  );

alter policy "benefit_observations_select_own" on benefit_observations
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = benefit_observations.transformation_id
        and o.owner_id = auth.uid()
    )
    or is_transformation_member(benefit_observations.transformation_id)
  );

alter policy "business_cases_select_own" on business_cases
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = business_cases.transformation_id
        and o.owner_id = auth.uid()
    )
    or is_transformation_member(business_cases.transformation_id)
  );

alter policy "meeting_requests_select_own" on meeting_requests
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = meeting_requests.transformation_id
        and o.owner_id = auth.uid()
    )
    or is_transformation_member(meeting_requests.transformation_id)
  );
