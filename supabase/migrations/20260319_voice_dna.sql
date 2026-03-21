-- Voice DNA tables — Sprint 2
-- Run manually in Supabase SQL Editor

-- ---------------------------------------------------------------------------
-- voice_dna_profiles — stores the analyzed Voice DNA JSON profile
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS voice_dna_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  profile_name  TEXT NOT NULL,
  owner_name    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'pending_approval', 'active', 'archived')),
  profile_data  JSONB,          -- full Voice DNA JSON (meta, persona, dimensions, etc.)
  version       INT NOT NULL DEFAULT 1,
  confidence_score NUMERIC(4,2), -- 0.00–1.00 from analysis
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one active profile per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_dna_profiles_active
  ON voice_dna_profiles (tenant_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_voice_dna_profiles_tenant
  ON voice_dna_profiles (tenant_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_voice_dna_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_voice_dna_profiles_updated_at
  BEFORE UPDATE ON voice_dna_profiles
  FOR EACH ROW EXECUTE FUNCTION set_voice_dna_updated_at();

-- RLS
ALTER TABLE voice_dna_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on voice_dna_profiles"
  ON voice_dna_profiles FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Tenant read own voice_dna_profiles"
  ON voice_dna_profiles FOR SELECT
  USING (tenant_id = auth.uid());

-- ---------------------------------------------------------------------------
-- voice_dna_samples — raw writing samples used for analysis
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS voice_dna_samples (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    UUID NOT NULL REFERENCES voice_dna_profiles(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_type   TEXT NOT NULL,  -- direct_paste, linkedin_about, linkedin_post, email_import, etc.
  content_type  TEXT NOT NULL,  -- email, social_post, linkedin_about, proposal, other
  text          TEXT NOT NULL,
  word_count    INT NOT NULL DEFAULT 0,
  weight        NUMERIC(3,2) NOT NULL DEFAULT 1.00, -- 0.00–1.00 weighting for analysis
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voice_dna_samples_profile
  ON voice_dna_samples (profile_id);

CREATE INDEX IF NOT EXISTS idx_voice_dna_samples_tenant
  ON voice_dna_samples (tenant_id);

-- RLS
ALTER TABLE voice_dna_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on voice_dna_samples"
  ON voice_dna_samples FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Tenant read own voice_dna_samples"
  ON voice_dna_samples FOR SELECT
  USING (tenant_id = auth.uid());

-- ---------------------------------------------------------------------------
-- voice_dna_metrics — analysis metrics and scoring history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS voice_dna_metrics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    UUID NOT NULL REFERENCES voice_dna_profiles(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_type   TEXT NOT NULL,  -- analysis_run, dimension_override, consistency_check
  metric_data   JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voice_dna_metrics_profile
  ON voice_dna_metrics (profile_id);

CREATE INDEX IF NOT EXISTS idx_voice_dna_metrics_tenant
  ON voice_dna_metrics (tenant_id);

-- RLS
ALTER TABLE voice_dna_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on voice_dna_metrics"
  ON voice_dna_metrics FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Tenant read own voice_dna_metrics"
  ON voice_dna_metrics FOR SELECT
  USING (tenant_id = auth.uid());
