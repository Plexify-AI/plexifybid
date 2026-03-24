-- LinkedIn Import Jobs table
-- Tracks the state of each LinkedIn Data Export import pipeline run.
-- Phase A: upload + validation creates a row with status='pending'.
-- Phase B: processing updates steps, batches, results.

CREATE TABLE IF NOT EXISTS linkedin_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  status TEXT NOT NULL DEFAULT 'pending',
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 7,
  current_batch INTEGER DEFAULT 0,
  total_batches INTEGER DEFAULT 0,
  step_name TEXT,
  contact_count INTEGER,
  files_found TEXT[],
  files_missing TEXT[],
  column_mapping JSONB,
  thresholds JSONB DEFAULT '{"p0": 65, "p1": 45, "p2": 20}',
  results JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE linkedin_import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on linkedin_import_jobs"
  ON linkedin_import_jobs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Auto-update updated_at
CREATE TRIGGER set_updated_at_linkedin_import_jobs
  BEFORE UPDATE ON linkedin_import_jobs
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
