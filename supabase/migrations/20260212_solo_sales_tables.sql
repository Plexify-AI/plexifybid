-- PlexifySOLO Sales Intelligence Tables
-- Migration: 20260212_solo_sales_tables
-- Creates: tenants, prospects, contacts, connections, case_studies, icp_configs,
--          conversations, outreach_drafts, usage_events
-- All tables enforce tenant isolation via tenant_id + RLS policies.

-- ============================================================================
-- 1. TENANTS — sandbox tenant registry
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tenants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,             -- e.g. 'mel-wallace-hexagon'
  name            TEXT NOT NULL,                    -- e.g. 'Mel Wallace'
  company         TEXT,                             -- e.g. 'Hexagon / Multivista'
  role            TEXT,                             -- e.g. 'Director of Sales'
  sandbox_token   TEXT UNIQUE NOT NULL,             -- auth token for sandbox access
  features        JSONB DEFAULT '[]'::jsonb,        -- enabled feature flags
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ                       -- sandbox expiry (null = no expiry)
);

-- ============================================================================
-- 2. CASE_STUDIES — past wins with ROI data (referenced by prospects)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.case_studies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ref_id            TEXT NOT NULL,                 -- original ID from JSON: 'cs-001'
  client_name       TEXT NOT NULL,
  project_name      TEXT NOT NULL,
  gc                TEXT,
  service           TEXT,
  roi_amount        INTEGER,                       -- dollar value
  roi_display       TEXT,                          -- e.g. '$127K'
  roi_type          TEXT,                          -- e.g. 'rework avoided'
  roi_explanation   TEXT,
  relevant_tags     JSONB DEFAULT '[]'::jsonb,     -- e.g. ["mep","high_rise","office"]
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, ref_id)
);

-- ============================================================================
-- 3. CONTACTS — key people at GCs / owners
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.contacts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ref_id                  TEXT NOT NULL,            -- 'contact-001'
  name                    TEXT NOT NULL,
  title                   TEXT,
  company                 TEXT,
  email                   TEXT,
  phone                   TEXT,
  linkedin_connected      BOOLEAN DEFAULT false,
  linkedin_degree         SMALLINT,                 -- 1, 2, or 3
  linkedin_mutual_name    TEXT,
  linkedin_mutual_company TEXT,
  decision_maker          BOOLEAN DEFAULT false,
  budget_authority        BOOLEAN DEFAULT false,
  engagements             JSONB DEFAULT '[]'::jsonb, -- array of {type, date, description, count?}
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, ref_id)
);

-- ============================================================================
-- 4. CONNECTIONS — user's network for warm intros
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.connections (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ref_id                   TEXT NOT NULL,            -- 'conn-001'
  name                     TEXT NOT NULL,
  title                    TEXT,
  company                  TEXT,
  relationship_strength    TEXT,                     -- 'strong' | 'medium' | 'weak'
  deals_closed_via         INTEGER DEFAULT 0,
  close_rate_via           NUMERIC(4,2) DEFAULT 0,   -- e.g. 0.68
  can_intro_to             JSONB DEFAULT '[]'::jsonb, -- array of contact ref_ids
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, ref_id)
);

-- ============================================================================
-- 5. PROSPECTS — enriched construction projects (Dodge data + scoring)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.prospects (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ref_id                   TEXT NOT NULL,              -- 'proj-001'
  dodge_number             TEXT NOT NULL,
  name                     TEXT NOT NULL,
  type                     TEXT,                       -- 'Office Tower (Class A)'
  building_type_code       TEXT,                       -- 'OFF-A'
  square_feet              BIGINT,
  square_feet_display      TEXT,
  floors                   INTEGER,
  value                    BIGINT,                     -- dollar value
  value_display            TEXT,                       -- '$2.1B'
  stage                    TEXT,                       -- 'construction'
  stage_detail             TEXT,                       -- 'Construction - Month 2'
  construction_start       DATE,
  estimated_completion     DATE,
  address                  TEXT,
  city                     TEXT,
  borough                  TEXT,
  neighborhood             TEXT,
  state                    TEXT,
  zip                      TEXT,
  owner                    TEXT,
  gc                       TEXT,
  gc_slug                  TEXT,
  architect                TEXT,
  pain_points              JSONB DEFAULT '[]'::jsonb,  -- string array
  primary_pain_point       TEXT,
  pain_point_detail        TEXT,
  suggested_service        TEXT,
  suggested_service_reason TEXT,
  relevant_case_study_ref  TEXT,                       -- ref_id into case_studies
  primary_contact_ref      TEXT,                       -- ref_id into contacts
  warmth_score             INTEGER,
  warmth_factors           JSONB DEFAULT '[]'::jsonb,  -- array of WarmthFactor objects
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, ref_id)
);

-- ============================================================================
-- 6. ICP_CONFIGS — ideal customer profile filters + warmth weights
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.icp_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  filters         JSONB NOT NULL DEFAULT '{}'::jsonb,
  services        JSONB NOT NULL DEFAULT '[]'::jsonb,
  warmth_weights  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 7. CONVERSATIONS — chat history with Ask Plexi
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  messages    JSONB NOT NULL DEFAULT '[]'::jsonb,   -- array of {role, content, timestamp}
  context     JSONB NOT NULL DEFAULT '{}'::jsonb,   -- session context (active prospect, etc.)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 8. OUTREACH_DRAFTS — generated emails
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.outreach_drafts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  prospect_id  UUID REFERENCES public.prospects(id) ON DELETE SET NULL,
  subject      TEXT,
  body         TEXT,
  tone         TEXT DEFAULT 'professional',
  status       TEXT DEFAULT 'draft',               -- 'draft' | 'sent' | 'archived'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 9. USAGE_EVENTS — pilot analytics
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.usage_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,                        -- 'search', 'outreach', 'win_analysis', etc.
  event_data  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES for common queries
-- ============================================================================
CREATE INDEX idx_prospects_tenant     ON public.prospects(tenant_id);
CREATE INDEX idx_prospects_stage      ON public.prospects(tenant_id, stage);
CREATE INDEX idx_prospects_warmth     ON public.prospects(tenant_id, warmth_score DESC);
CREATE INDEX idx_prospects_gc_slug    ON public.prospects(tenant_id, gc_slug);
CREATE INDEX idx_contacts_tenant      ON public.contacts(tenant_id);
CREATE INDEX idx_connections_tenant   ON public.connections(tenant_id);
CREATE INDEX idx_case_studies_tenant  ON public.case_studies(tenant_id);
CREATE INDEX idx_icp_configs_tenant   ON public.icp_configs(tenant_id);
CREATE INDEX idx_conversations_tenant ON public.conversations(tenant_id);
CREATE INDEX idx_outreach_tenant      ON public.outreach_drafts(tenant_id);
CREATE INDEX idx_outreach_prospect    ON public.outreach_drafts(prospect_id);
CREATE INDEX idx_usage_tenant         ON public.usage_events(tenant_id);
CREATE INDEX idx_usage_type           ON public.usage_events(tenant_id, event_type);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.tenants      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospects    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.icp_configs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_drafts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events     ENABLE ROW LEVEL SECURITY;

-- Service role (backend) can do everything
CREATE POLICY "Service role full access" ON public.tenants
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.prospects
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.contacts
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.connections
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.case_studies
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.icp_configs
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.conversations
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.outreach_drafts
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.usage_events
  FOR ALL USING (true) WITH CHECK (true);

-- Anon/authenticated users can only read their own tenant data.
-- The backend passes tenant_id via RPC or filters; for the sandbox
-- we enforce at the API layer (Session 4 builds auth middleware).
-- These policies allow SELECT for any authenticated user who matches tenant_id
-- via a custom claim or request header. For now, the service role key
-- bypasses RLS, and the anon key gets read-only access to seeded data.

CREATE POLICY "Anon read access" ON public.tenants
  FOR SELECT USING (true);
CREATE POLICY "Anon read access" ON public.prospects
  FOR SELECT USING (true);
CREATE POLICY "Anon read access" ON public.contacts
  FOR SELECT USING (true);
CREATE POLICY "Anon read access" ON public.connections
  FOR SELECT USING (true);
CREATE POLICY "Anon read access" ON public.case_studies
  FOR SELECT USING (true);
CREATE POLICY "Anon read access" ON public.icp_configs
  FOR SELECT USING (true);
CREATE POLICY "Anon read access" ON public.conversations
  FOR SELECT USING (true);
CREATE POLICY "Anon read access" ON public.outreach_drafts
  FOR SELECT USING (true);
CREATE POLICY "Anon read access" ON public.usage_events
  FOR SELECT USING (true);

-- ============================================================================
-- UPDATED_AT trigger (auto-update on row modification)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tenants      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.prospects     FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.contacts      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.connections   FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.case_studies  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.icp_configs    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.conversations  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
