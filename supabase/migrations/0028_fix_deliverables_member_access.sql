-- deliverables was created in 0005, before the member-access fix in 0018,
-- and was missed by 0022's sweep (which caught the 9 tables that existed by
-- then: decision_criteria_weights, skill_assessments, supplier_assessments,
-- actions, benefit_expectations/items/observations, business_cases,
-- meeting_requests). An invited team member (consultant/client/expert)
-- still sees an empty screen on every tool that reads from deliverables
-- (L06 roadmap/KPI/risk map, D05 business case export, the executive
-- report) — same bug, same fix, same pattern as 0022.
--
-- INSERT/UPDATE stay owner-only, consistent with every other table 0022
-- touched: write access to these operational tables is not yet extended to
-- members anywhere in the schema, so this isn't a new gap to close here.

alter policy "deliverables_select_own" on deliverables
  using (
    exists (
      select 1 from transformations t
      join organizations o on o.id = t.organization_id
      where t.id = deliverables.transformation_id
        and o.owner_id = auth.uid()
    )
    or is_transformation_member(deliverables.transformation_id)
  );
