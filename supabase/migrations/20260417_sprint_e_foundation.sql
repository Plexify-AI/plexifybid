-- ============================================================================
-- PlexifySOLO — Sprint E / Task E1: PlexiCoS Orchestration Foundation
-- ============================================================================
-- Day 0 decisions baked in (see docs/SPRINT_STATUS.md when E1 ships):
--   * Legacy `jobs` table (opportunity pipeline retry queue, empty at cutover)
--     is renamed to `legacy_jobs`. server/routes/system-status.js is patched
--     in the same commit to point at legacy_jobs.
--   * New `jobs` table is a runtime abstraction for inline + Managed Agent work.
--   * RLS follows existing codebase convention: FOR ALL USING (true) +
--     service-role access. Tenant isolation lives in the application layer
--     (every query filters by .eq('tenant_id', tenantId)). This matches the
--     pattern in 20260213_deal_rooms.sql and others. A session-var approach
--     ('app.current_tenant_id') would require a broader auth refactor.
--   * Prospects: reuse existing warmth_score + warmth_factors jsonb. No new
--     column for composite scoring (F1 decision).
--   * Tenants: add metro_tier + default_skill_set (F2 decision — no collision).
--   * Artifacts: factual_audits FKs existing deal_room_artifacts (F3 decision).
--   * Scheduling: node-cron in Express, no pg_cron extension (F4 decision).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Rename legacy jobs table (retry queue for opportunity pipeline — empty)
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.jobs RENAME TO legacy_jobs;

COMMENT ON TABLE public.legacy_jobs IS
  'Pre-Sprint-E opportunity pipeline retry queue. Empty at Sprint E cutover (2026-04-17). Read by server/routes/system-status.js only. Do not write new code against this table. New async work goes through the jobs table (runtime abstraction for inline + Managed Agent jobs).';

-- ---------------------------------------------------------------------------
-- 2. New jobs table — runtime abstraction for PlexiCoS orchestration
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  runtime TEXT NOT NULL CHECK (runtime IN ('inline','managed_agent')),
  revenue_loop_stage TEXT CHECK (revenue_loop_stage IN ('identify','enrich','personalize','automate','close')),
  external_id TEXT,
  depends_on UUID[],
  input JSONB,
  output JSONB,
  cost_cents INT DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_tenant_status ON public.jobs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_kind_status ON public.jobs(kind, status);
CREATE INDEX IF NOT EXISTS idx_jobs_loop_stage ON public.jobs(tenant_id, revenue_loop_stage, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON public.jobs(tenant_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. Extend deal_room_skills with E2-ready columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.deal_room_skills
  ADD COLUMN IF NOT EXISTS input_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS eval_path TEXT,
  ADD COLUMN IF NOT EXISTS revenue_loop_stage TEXT;

-- CHECK constraint added separately so an existing row without the column (now
-- NULL) doesn't trip the check. New writes are required to supply the stage.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'deal_room_skills_revenue_loop_stage_check'
  ) THEN
    ALTER TABLE public.deal_room_skills
      ADD CONSTRAINT deal_room_skills_revenue_loop_stage_check
      CHECK (revenue_loop_stage IS NULL OR revenue_loop_stage IN ('identify','enrich','personalize','automate','close'));
  END IF;
END$$;

COMMENT ON COLUMN public.deal_room_skills.revenue_loop_stage IS
  'BD Revenue Loop stage this skill serves. North-star framing: Identify -> Enrich -> Personalize -> Automate -> Close.';

-- ---------------------------------------------------------------------------
-- 4. Extend tenants with metro_tier + default_skill_set (schema hook, Sprint F logic)
-- ---------------------------------------------------------------------------
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS metro_tier TEXT,
  ADD COLUMN IF NOT EXISTS default_skill_set TEXT[] DEFAULT ARRAY[]::TEXT[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_metro_tier_check'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_metro_tier_check
      CHECK (metro_tier IS NULL OR metro_tier IN ('star_hub','emerging_center','regional'));
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 5. Factual audits — one per artifact generation (E5 writes, E1 ships table)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.factual_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id UUID NOT NULL REFERENCES public.deal_room_artifacts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  passed BOOLEAN NOT NULL,
  findings JSONB NOT NULL,
  auditor_version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_factual_audits_artifact ON public.factual_audits(artifact_id);
CREATE INDEX IF NOT EXISTS idx_factual_audits_tenant ON public.factual_audits(tenant_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 6. Tenant usage — per-call metering (rolls in Sprint B's B4 concept)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID,
  kind TEXT NOT NULL,
  worker_kind TEXT,
  cost_cents INT NOT NULL DEFAULT 0,
  tokens_in INT,
  tokens_out INT,
  session_seconds INT,
  tool_calls INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tenant_usage_tenant_month ON public.tenant_usage(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tenant_usage_worker ON public.tenant_usage(tenant_id, worker_kind, created_at);

-- ---------------------------------------------------------------------------
-- 7. Past performance — claim verification backstop for E5 Factual Auditor
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.past_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  project_name TEXT NOT NULL,
  client_name TEXT,
  completion_date DATE,
  contract_value_cents BIGINT,
  project_type TEXT,
  role TEXT,
  description TEXT,
  verified BOOLEAN DEFAULT false,
  source TEXT,
  raw JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_past_performance_tenant ON public.past_performance(tenant_id);

-- ---------------------------------------------------------------------------
-- 8. Home feed cards — autonomous work surface on Home
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.home_feed_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID,
  job_id UUID REFERENCES public.jobs(id),
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  artifact_id UUID REFERENCES public.deal_room_artifacts(id),
  dismissed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_home_feed_tenant_active ON public.home_feed_cards(tenant_id, dismissed, created_at DESC);

-- ---------------------------------------------------------------------------
-- 9. Research notes — Research Scanner output (E4 populates)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.research_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  job_id UUID REFERENCES public.jobs(id),
  query TEXT NOT NULL,
  content TEXT NOT NULL,
  citations JSONB,
  tokens_used INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_research_notes_tenant ON public.research_notes(tenant_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 10. Gate override audit log (E5 populates, E1 ships table)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gate_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  user_id UUID NOT NULL,
  artifact_id UUID NOT NULL REFERENCES public.deal_room_artifacts(id),
  gate_kind TEXT NOT NULL CHECK (gate_kind IN ('factual_auditor','compliance_guard')),
  original_findings JSONB NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gate_overrides_tenant ON public.gate_overrides(tenant_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 11. Public data caches — OZ tracts + ACS demographics (E3 populates)
-- Not tenant-scoped; public data shared across all tenants.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.oz_tracts_cache (
  tract_id TEXT PRIMARY KEY,
  state_fips TEXT NOT NULL,
  county_fips TEXT NOT NULL,
  is_oz_designated BOOLEAN NOT NULL,
  designation_date DATE,
  raw JSONB,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.acs_data_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tract_id TEXT NOT NULL,
  year INT NOT NULL,
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tract_id, year)
);

-- ---------------------------------------------------------------------------
-- 12. Row Level Security — match existing codebase convention
-- (service role bypasses RLS; tenant isolation enforced at app layer via
-- .eq('tenant_id', tenantId) on every query. See 20260213_deal_rooms.sql.)
-- ---------------------------------------------------------------------------
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factual_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.past_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_feed_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gate_overrides ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Service-role full access (matches pattern from 20260213_deal_rooms.sql)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'jobs' AND policyname = 'Service role full access') THEN
    CREATE POLICY "Service role full access" ON public.jobs FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'factual_audits' AND policyname = 'Service role full access') THEN
    CREATE POLICY "Service role full access" ON public.factual_audits FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tenant_usage' AND policyname = 'Service role full access') THEN
    CREATE POLICY "Service role full access" ON public.tenant_usage FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'past_performance' AND policyname = 'Service role full access') THEN
    CREATE POLICY "Service role full access" ON public.past_performance FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'home_feed_cards' AND policyname = 'Service role full access') THEN
    CREATE POLICY "Service role full access" ON public.home_feed_cards FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'research_notes' AND policyname = 'Service role full access') THEN
    CREATE POLICY "Service role full access" ON public.research_notes FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gate_overrides' AND policyname = 'Service role full access') THEN
    CREATE POLICY "Service role full access" ON public.gate_overrides FOR ALL USING (true) WITH CHECK (true);
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 13. Test skill — lets E1 acceptance test run before E2 ships real skills.
-- Flagged inactive and prefixed [TEST] so it does not surface on the E2
-- Strategy tab tomorrow. Removed or promoted in a later sprint.
-- ---------------------------------------------------------------------------
-- Postgres UNIQUE allows multiple NULLs, so ON CONFLICT won't dedupe here.
-- Use NOT EXISTS to make this idempotent when the migration re-runs.
INSERT INTO public.deal_room_skills
  (tenant_id, skill_key, skill_name, system_prompt, output_schema,
   input_schema, version, revenue_loop_stage, is_active)
SELECT
  NULL,
  'test_inline_echo',
  '[TEST] Inline echo',
  'You are an echo. Return the user input verbatim as a JSON object with a single "echo" key.',
  '{"type":"object","properties":{"echo":{"type":"string"}},"required":["echo"]}'::jsonb,
  '{"type":"object","properties":{"message":{"type":"string"}},"required":["message"]}'::jsonb,
  1,
  'identify',
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.deal_room_skills
  WHERE tenant_id IS NULL AND skill_key = 'test_inline_echo'
);

-- ============================================================================
-- End of Sprint E / Task E1 migration
-- ============================================================================
