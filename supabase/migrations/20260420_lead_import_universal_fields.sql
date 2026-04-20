-- ============================================================================
-- Lead import — universal Bucket 1 columns (city, country, phone)
-- ============================================================================
-- Ad-hoc post-Sprint-E: Ben's Xencelabs Animation Y'all TN import + every
-- future tenant benefits from first-class city/country/phone on opportunities.
-- Tenant-specific signals (software_used, pen_tablet_used for SunnAx) stay in
-- opportunities.enrichment_data.<namespace> via the custom-field mapper.
-- ============================================================================

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN public.opportunities.country IS
  'ISO 3166-1 alpha-2 country code (US, CA, MX, ...). Normalized on import via normalizeCountry().';
