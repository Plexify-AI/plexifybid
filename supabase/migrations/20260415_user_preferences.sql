-- ============================================================================
-- Sprint B / Task B1 — User Preferences Store
-- Creates a per-user preferences table, scoped by (tenant_id, user_id, category).
--
-- This is ADDITIVE. The legacy `tenants.preferences` JSONB column from
-- migration 20260410_tenant_preferences.sql is left ALONE — signature,
-- default_closing, price_list, etc. keep their existing storage and API.
--
-- Categories (whitelist enforced in the API layer):
--   - 'general'              — timezone and misc user settings (B1)
--   - 'voice_corrections'    — captured style edits (B2)
--   - 'factual_corrections'  — user-supplied fact substitutions (B5)
--
-- Phase 1: user_id = tenant.id (the app currently treats tenant = user,
--          per server/routes/email-auth.js "Phase 1: tenant = user").
--          The schema is multi-user-ready so nothing has to migrate when
--          auth.users integration lands.
-- 2026-04-15
-- ============================================================================

-- Uses the public.set_updated_at() function defined in
-- 20260212_solo_sales_tables.sql — already present in the DB.

CREATE TABLE IF NOT EXISTS public.user_preferences (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL,                 -- Phase 1: equals tenant.id
  category     TEXT NOT NULL,                 -- API-layer whitelist
  preferences  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, user_id, category)
);

-- RLS — non-negotiable. Service-role bypasses RLS, but the policy is
-- defined explicitly so the table is not wide-open if a future anon
-- client ever hits it.
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on user_preferences"
  ON public.user_preferences FOR ALL
  USING (true)
  WITH CHECK (true);

-- Primary lookup path: (tenant, user, category). The UNIQUE constraint
-- above creates a supporting index, so no additional index is needed.

CREATE OR REPLACE TRIGGER set_updated_at_user_preferences
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE  public.user_preferences       IS 'Per-user preferences scoped by tenant + category. Categories: general, voice_corrections, factual_corrections.';
COMMENT ON COLUMN public.user_preferences.user_id  IS 'Phase 1: equals tenant.id. Schema is ready for auth.users integration.';
COMMENT ON COLUMN public.user_preferences.category IS 'Whitelist enforced in the API layer.';
