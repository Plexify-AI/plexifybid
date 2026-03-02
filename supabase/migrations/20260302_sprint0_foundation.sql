-- PlexifyAEC Sprint 0: Foundation Schema
-- Migration: 20260302_sprint0_foundation
-- Creates: events, opportunities, warmth_history, jobs, suppression_lists, outreach_log, agents
-- All tenant-scoped tables enforce tenant isolation via API layer + RLS.
--
-- SECURITY NOTE: Current architecture uses service-role key (bypasses RLS).
-- Tenant isolation enforced at API layer (Express middleware).
-- TODO (Pre-FedRAMP): Migrate to Supabase Auth with JWT-based RLS.
-- When migrated, replace these policies with:
--   USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID)
-- See: PlexifyAEC_Session15_Sprint0 spec for target RLS definitions.

-- ============================================================================
-- Ensure shared trigger function exists (idempotent)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. EVENTS — Bloomberg audit trail
-- Every signal, action, and state change emits an event.
-- Warmth scores are DERIVED from events.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  opportunity_id  UUID,                          -- nullable for system events
  event_type      TEXT NOT NULL CHECK (event_type IN (
    'SIGNAL_LOGGED',
    'OUTREACH_SENT',
    'OUTREACH_OPENED',
    'OUTREACH_CLICKED',
    'OUTREACH_REPLIED',
    'MEETING_BOOKED',
    'MEETING_COMPLETED',
    'PROPOSAL_SENT',
    'DEAL_WON',
    'DEAL_LOST'
  )),
  event_version   INTEGER NOT NULL DEFAULT 1,    -- for formula versioning
  payload         JSONB NOT NULL DEFAULT '{}',   -- signal-specific data
  source          TEXT NOT NULL DEFAULT 'manual' CHECK (source IN (
    'manual', 'agent', 'webhook', 'system'
  )),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Primary query: "all events for this opportunity, newest first"
CREATE INDEX IF NOT EXISTS idx_events_opp_time
  ON public.events (tenant_id, opportunity_id, created_at DESC);

-- Secondary: "all events for this tenant today"
CREATE INDEX IF NOT EXISTS idx_events_tenant_day
  ON public.events (tenant_id, created_at DESC);

-- ============================================================================
-- 2. OPPORTUNITIES — prospect/account pipeline tracking
-- Stage transitions emit events. Warmth score cached here, computed from events.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.opportunities (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  account_name      TEXT NOT NULL,
  contact_name      TEXT,
  contact_email     TEXT,
  contact_title     TEXT,
  deal_hypothesis   TEXT,                        -- "Why we think this is winnable"
  stage             TEXT NOT NULL DEFAULT 'prospecting' CHECK (stage IN (
    'prospecting',
    'warming',
    'engaged',
    'takeover_ready',
    'active_deal',
    'parked',
    'ejected'
  )),
  warmth_score      INTEGER NOT NULL DEFAULT 0 CHECK (warmth_score >= 0 AND warmth_score <= 100),
  warmth_updated_at TIMESTAMPTZ,
  promoted_to_home  BOOLEAN NOT NULL DEFAULT FALSE,
  promoted_at       TIMESTAMPTZ,
  promotion_reason  TEXT,                        -- human-readable "why this is on Home"
  enrichment_data   JSONB DEFAULT '{}',          -- account info gathered by enrichment agent
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Primary query: "what's promoted and hot?"
CREATE INDEX IF NOT EXISTS idx_opps_promoted
  ON public.opportunities (tenant_id, promoted_to_home, warmth_score DESC)
  WHERE promoted_to_home = TRUE;

-- Secondary: "all opps by stage"
CREATE INDEX IF NOT EXISTS idx_opps_stage
  ON public.opportunities (tenant_id, stage);

-- Auto-update trigger
CREATE TRIGGER set_opps_updated_at
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 3. WARMTH_HISTORY — warmth score change audit trail
-- Every recompute logs before/after/delta/drivers.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.warmth_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  opportunity_id  UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  score_before    INTEGER NOT NULL,
  score_after     INTEGER NOT NULL,
  delta           INTEGER NOT NULL,
  top_3_drivers   JSONB NOT NULL,                -- [{event_type, points, description}]
  formula_version INTEGER NOT NULL DEFAULT 1,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_warmth_hist_opp
  ON public.warmth_history (opportunity_id, computed_at DESC);

-- ============================================================================
-- 4. JOBS — DB-backed job queue with dead-letter pattern
-- No BullMQ/Redis needed at pilot scale. Includes circuit breaker support.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  opportunity_id  UUID REFERENCES public.opportunities(id),
  job_type        TEXT NOT NULL CHECK (job_type IN (
    'enrichment',
    'outreach_intro',
    'outreach_followup',
    'warmth_recompute',
    'deal_room_generate',
    'evidence_bundle'
  )),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'running', 'completed', 'failed', 'dead_letter'
  )),
  payload         JSONB NOT NULL DEFAULT '{}',
  idempotency_key TEXT UNIQUE,                   -- prevent duplicate processing
  retries         INTEGER NOT NULL DEFAULT 0,
  max_retries     INTEGER NOT NULL DEFAULT 3,
  run_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Job runner polls this: "give me pending jobs ready to run"
CREATE INDEX IF NOT EXISTS idx_jobs_pending
  ON public.jobs (status, run_at)
  WHERE status = 'pending';

-- Dead letter monitoring: "how many dead letters per tenant per hour?"
CREATE INDEX IF NOT EXISTS idx_jobs_dead_letter
  ON public.jobs (tenant_id, created_at)
  WHERE status = 'dead_letter';

-- ============================================================================
-- 5. SUPPRESSION_LISTS — CAN-SPAM compliance
-- Hard bounces, unsubscribes, manual DNC. Checked before every outreach send.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.suppression_lists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  reason      TEXT NOT NULL CHECK (reason IN (
    'hard_bounce', 'unsubscribe', 'manual_dnc', 'complaint'
  )),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

-- ============================================================================
-- 6. OUTREACH_LOG — every outbound message tracked
-- Content hash prevents duplicate sends. Approval workflow for follow-up #2+.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.outreach_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  opportunity_id    UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  channel           TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email')),
  message_type      TEXT NOT NULL CHECK (message_type IN (
    'intro', 'followup_1', 'followup_2_plus',
    'content_share', 'meeting_request', 'proposal_intro'
  )),
  content_hash      TEXT NOT NULL,               -- SHA-256 of message body
  recipient_email   TEXT NOT NULL,
  sent_at           TIMESTAMPTZ,
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'pending_approval', 'approved', 'sent',
    'bounced', 'delivered', 'opened', 'clicked'
  )),
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by       UUID,
  approved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_opp
  ON public.outreach_log (tenant_id, opportunity_id, sent_at DESC);

-- ============================================================================
-- 7. AGENTS — global agent registry (no tenant_id)
-- Configuration source for PlexiCoS orchestrator.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL UNIQUE,
  display_name        TEXT NOT NULL,
  description         TEXT,
  agent_type          TEXT NOT NULL CHECK (agent_type IN (
    'orchestrator', 'specialist', 'assistant', 'utility'
  )),
  preferred_provider  TEXT NOT NULL DEFAULT 'anthropic',
  preferred_model     TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  fallback_provider   TEXT DEFAULT 'openai',
  fallback_model      TEXT DEFAULT 'gpt-4o',
  capabilities        TEXT[] NOT NULL DEFAULT '{}',
  system_prompt_key   TEXT,
  max_tokens          INTEGER DEFAULT 1024,
  temperature         NUMERIC(3,2) DEFAULT 0.7,
  model_dependencies  JSONB DEFAULT '{}',
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'deprecated', 'experimental'
  )),
  performance_metrics JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update trigger
CREATE TRIGGER set_agents_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY — match existing pattern
-- ============================================================================

-- Events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.events
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon read access" ON public.events
  FOR SELECT USING (true);

-- Opportunities
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.opportunities
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon read access" ON public.opportunities
  FOR SELECT USING (true);

-- Warmth History
ALTER TABLE public.warmth_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.warmth_history
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon read access" ON public.warmth_history
  FOR SELECT USING (true);

-- Jobs
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.jobs
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon read access" ON public.jobs
  FOR SELECT USING (true);

-- Suppression Lists
ALTER TABLE public.suppression_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.suppression_lists
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon read access" ON public.suppression_lists
  FOR SELECT USING (true);

-- Outreach Log
ALTER TABLE public.outreach_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.outreach_log
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon read access" ON public.outreach_log
  FOR SELECT USING (true);

-- Agents (global — no tenant_id)
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.agents
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon read access" ON public.agents
  FOR SELECT USING (true);

-- ============================================================================
-- SEED DATA — Initial Agent Registry (8 agents)
-- ============================================================================
INSERT INTO public.agents (name, display_name, description, agent_type, preferred_provider, preferred_model, fallback_provider, fallback_model, capabilities, status)
VALUES
  ('plexicos', 'PlexiCoS Chief of Staff',
   'Orchestrates all sub-agents, enforces guardrails, computes warmth, manages job queue',
   'orchestrator', 'anthropic', 'claude-sonnet-4-20250514', 'openai', 'gpt-4o',
   ARRAY['orchestration', 'warmth_computation', 'job_scheduling', 'guardrail_enforcement'], 'active'),

  ('ask_plexi', 'Ask Plexi',
   'Natural language interface for BD executives — answers questions, runs queries, generates content',
   'assistant', 'anthropic', 'claude-sonnet-4-20250514', 'openai', 'gpt-4o',
   ARRAY['natural_language_query', 'prospect_search', 'outreach_draft', 'pipeline_analysis'], 'active'),

  ('enrichment_agent', 'Account Enrichment',
   'Researches accounts — gathers company info, contacts, projects, pain points via web + data sources',
   'specialist', 'openai', 'gpt-4o', 'anthropic', 'claude-sonnet-4-20250514',
   ARRAY['account_research', 'contact_discovery', 'project_intelligence'], 'active'),

  ('outreach_agent', 'Outreach Generator',
   'Generates personalized intro emails, follow-ups, content shares — checks caps and suppression before send',
   'specialist', 'anthropic', 'claude-sonnet-4-20250514', 'openai', 'gpt-4o',
   ARRAY['email_generation', 'personalization', 'cap_checking'], 'active'),

  ('deal_room_agent', 'Deal Room Architect',
   'Pre-builds Deal Room artifacts — meeting briefs, proposal bullets, stakeholder maps, fact summaries',
   'specialist', 'anthropic', 'claude-sonnet-4-20250514', 'openai', 'gpt-4o',
   ARRAY['meeting_brief', 'proposal_generation', 'stakeholder_mapping', 'fact_summary'], 'active'),

  ('notebook_bd', 'NotebookBD',
   'RAG-powered document analysis — ingests RFPs, proposals, meeting notes and generates structured outputs',
   'specialist', 'anthropic', 'claude-sonnet-4-20250514', 'openai', 'gpt-4o',
   ARRAY['document_ingestion', 'rag_query', 'structured_output'], 'active'),

  ('warmth_engine', 'Warmth Engine',
   'Computes and decays warmth scores on schedule — pure deterministic computation, no LLM needed',
   'utility', 'anthropic', 'claude-sonnet-4-20250514', 'openai', 'gpt-4o',
   ARRAY['warmth_computation', 'decay_check', 'score_history'], 'active'),

  ('evidence_bundler', 'Evidence Bundler',
   'Generates human-readable "why promoted" explanations from event history and warmth drivers',
   'specialist', 'anthropic', 'claude-sonnet-4-20250514', 'openai', 'gpt-4o',
   ARRAY['evidence_generation', 'explainability'], 'active')
ON CONFLICT (name) DO NOTHING;
