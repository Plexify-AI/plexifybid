-- ============================================================================
-- PlexifySOLO — Sprint E / Task E4: Managed-agent workers
-- ============================================================================
-- - agents table: caches Anthropic-issued agent_id per agent_key so workers
--   don't re-sync on every boot.
-- - artifact_type CHECK extended with scan_memo + war_room_checklist (full
--   union, matches memory: always rebuild from latest).
-- ============================================================================

-- 1) Cached agent registry (Anthropic-issued IDs per local agent_key)
CREATE TABLE IF NOT EXISTS public.agents (
  agent_key TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  version INT NOT NULL,
  model TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.agents IS
  'Cache of Anthropic Managed Agent IDs keyed on local agent_key. Populated by server/agents/seed.mjs on startup. Truth lives in server/agents/definitions/*.mjs.';

-- 2) Extend deal_room_artifacts.artifact_type CHECK — full union
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
    'bid_oz_opportunity_brief', 'stakeholder_entry_map',
    -- Sprint E / E4 worker outputs
    'scan_memo', 'war_room_checklist'
  ));
