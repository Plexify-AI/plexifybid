-- ============================================================================
-- PlexifySOLO — Sprint E / Task E3: artifact_type CHECK extension
-- ============================================================================
-- Adds the four new strategy skill keys to the artifact_type CHECK constraint.
-- Constraint name confirmed as `deal_room_artifacts_artifact_type_check`
-- across all prior migrations (20260331, 20260406, 20260407, 20260417b).
-- The list below is the full union — the E2 migration's corrected union plus
-- the four E3 additions.
-- ============================================================================

ALTER TABLE public.deal_room_artifacts
  DROP CONSTRAINT IF EXISTS deal_room_artifacts_artifact_type_check;

ALTER TABLE public.deal_room_artifacts
  ADD CONSTRAINT deal_room_artifacts_artifact_type_check
  CHECK (artifact_type IN (
    'deal_summary', 'competitive_analysis', 'meeting_prep',
    'board_brief', 'ozrf_section', 'outreach_sequence',
    'slide_deck', 'board_deck', 'audio_briefing', 'data_table',
    'knowledge_graph', 'infographic',
    -- Sprint E / E2 strategy skills
    'pursuit_go_no_go', 'fee_strategy_architect', 'competitor_teardown',
    -- Sprint E / E3 strategy skills
    'acquisition_playbook', 'growth_plan_generator',
    'bid_oz_opportunity_brief', 'stakeholder_entry_map'
  ));
