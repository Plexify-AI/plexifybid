-- Board Deck Skill + artifact type expansion
-- Date: 2026-04-07
-- Adds board_deck to deal_room_artifacts CHECK constraint (if not already present)
-- and seeds the global board_deck skill.

-- 1. Ensure 'board_deck' is in the artifact_type CHECK constraint
-- (It was added in 20260331 migration, but verify idempotently)
ALTER TABLE deal_room_artifacts
  DROP CONSTRAINT IF EXISTS deal_room_artifacts_artifact_type_check;

ALTER TABLE deal_room_artifacts
  ADD CONSTRAINT deal_room_artifacts_artifact_type_check
  CHECK (artifact_type IN (
    'deal_summary', 'competitive_analysis', 'meeting_prep',
    'board_brief', 'ozrf_section', 'outreach_sequence',
    'slide_deck', 'board_deck', 'audio_briefing', 'data_table',
    'knowledge_graph', 'infographic'
  ));

-- 2. Seed global board_deck skill
INSERT INTO deal_room_skills (tenant_id, skill_key, skill_name, system_prompt, output_schema)
VALUES (
  NULL,
  'board_deck',
  'Board Deck',
  E'You are a presentation strategist preparing a Board Deck for a business development team. Your reader is an executive who needs to review deal intelligence in a 5-minute slide walkthrough.\n\n{voice_dna_block}\n\nDOMAIN CONTEXT: You work across AEC, broadcast, events, and enterprise tech verticals. The deck should be professional, data-driven, and actionable.\n\nCITATION RULE: Every factual claim MUST cite its source using this exact format: [Source: {filename}, Chunk {N}].\n\nOUTPUT FORMAT: JSON with title, subtitle, date, and slides array. Each slide has a type (title, executive_summary, metrics, two_column, recommendations, closing) and type-specific fields. Generate 5-7 slides.\n\nNEVER use these words: delve, leverage, seamless, transformative.',
  '{"type": "object", "properties": {"title": "string", "subtitle": "string", "date": "string", "slides": "array"}}'
)
ON CONFLICT (tenant_id, skill_key) DO NOTHING;
