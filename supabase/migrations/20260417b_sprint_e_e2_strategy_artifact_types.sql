-- ============================================================================
-- PlexifySOLO — Sprint E / Task E2: Strategy skill artifact types
-- ============================================================================
-- E2 ships three prospect-backed strategy skills. Their outputs persist to
-- deal_room_artifacts, so artifact_type CHECK must include the new keys.
-- Four more types land in E3 (acquisition_playbook, growth_plan_generator,
-- bid_oz_opportunity_brief, stakeholder_entry_map) — add them at that time.
-- ============================================================================

ALTER TABLE public.deal_room_artifacts
  DROP CONSTRAINT IF EXISTS deal_room_artifacts_artifact_type_check;

ALTER TABLE public.deal_room_artifacts
  ADD CONSTRAINT deal_room_artifacts_artifact_type_check
  CHECK (artifact_type IN (
    'deal_summary', 'competitive_analysis', 'meeting_prep',
    'board_brief', 'ozrf_section', 'outreach_sequence',
    'slide_deck', 'audio_briefing', 'data_table', 'knowledge_graph',
    -- Sprint E / E2 strategy skills
    'pursuit_go_no_go', 'fee_strategy_architect', 'competitor_teardown'
  ));
