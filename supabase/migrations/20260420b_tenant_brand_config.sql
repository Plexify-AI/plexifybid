-- ============================================================================
-- Tenant Brand Config — email-slice foundation for the Brand DNA backlog
-- ============================================================================
-- First concrete piece of the Brand DNA infrastructure (backlog since Sprint A,
-- required by the Video Engine recipe). Scoped tightly to email hero/footer
-- images; future slices (colors, fonts, logo variants) extend the same JSONB.
--
-- Shape this migration establishes (documentation only — JSONB is free-form):
--   tenants.brand_config = {
--     email_hero_image_url: string,     -- public Supabase Storage URL
--     email_hero_alt_text: string,
--     email_footer_image_url: string,
--     email_footer_alt_text: string,
--     // future: logo_variants, colors, fonts, etc.
--   }
-- ============================================================================

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS brand_config JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.tenants.brand_config IS
  'Brand DNA JSONB. Email slice (v1): email_hero_image_url, email_hero_alt_text, email_footer_image_url, email_footer_alt_text. Expandable for colors/fonts/logo variants in Sprint F+.';
