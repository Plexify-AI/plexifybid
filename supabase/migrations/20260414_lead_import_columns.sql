-- Lead Import feature: add columns to opportunities table + expand stage CHECK
-- Migration: 20260414_lead_import_columns.sql

-- 1. Add new columns for imported lead data
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS source_type TEXT,
  ADD COLUMN IF NOT EXISTS source_campaign TEXT,
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT,
  ADD COLUMN IF NOT EXISTS mql_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS school_type TEXT;

-- 2. Expand stage CHECK to include 'imported' for freshly imported leads
-- Drop old constraint and recreate with the new value
ALTER TABLE public.opportunities DROP CONSTRAINT IF EXISTS opportunities_stage_check;
ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_stage_check
  CHECK (stage IN (
    'prospecting',
    'warming',
    'engaged',
    'takeover_ready',
    'active_deal',
    'parked',
    'ejected',
    'imported'
  ));

-- 3. Index for querying by source_type (common filter after imports)
CREATE INDEX IF NOT EXISTS idx_opps_source_type
  ON public.opportunities (tenant_id, source_type)
  WHERE source_type IS NOT NULL;
