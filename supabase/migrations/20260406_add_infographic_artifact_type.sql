-- Add 'infographic' to the allowed artifact_type values
-- Required for the Infographic visual one-pager feature (Day 3 Task 3)

ALTER TABLE deal_room_artifacts
  DROP CONSTRAINT IF EXISTS deal_room_artifacts_artifact_type_check;

ALTER TABLE deal_room_artifacts
  ADD CONSTRAINT deal_room_artifacts_artifact_type_check
  CHECK (artifact_type IN (
    'deal_summary', 'competitive_analysis', 'meeting_prep',
    'board_brief', 'ozrf_section', 'outreach_sequence',
    'slide_deck', 'audio_briefing', 'data_table', 'knowledge_graph',
    'infographic'
  ));
