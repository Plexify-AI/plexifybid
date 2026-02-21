-- PlexifySOLO Session 12 — Multi-Tenant Expansion
-- Migration: 20260221_session12_multi_tenant
-- 1A. Adds new columns to tenants table
-- 1B. Creates powerflow_state table with RLS
-- 1C. Adds source column to prospects table
-- 2.  Inserts 5 new tenant records (SB2–SB6)
-- 7.  Updates SB1 (Mel Wallace) with new column values

-- ============================================================================
-- 1A. UPDATE TENANTS TABLE — add new columns
-- ============================================================================

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS persona_code TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS tyranny TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS maslow_entry INTEGER DEFAULT 1;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS system_prompt_override JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS vocab_skin JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS powerflow_quick_start TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS storefront_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS dev_mode BOOLEAN DEFAULT false;

-- ============================================================================
-- 1B. CREATE POWERFLOW_STATE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.powerflow_state (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  local_date            DATE NOT NULL,
  stage_1_completed     BOOLEAN DEFAULT false,
  stage_1_completed_at  TIMESTAMPTZ,
  stage_2_completed     BOOLEAN DEFAULT false,
  stage_2_completed_at  TIMESTAMPTZ,
  stage_3_completed     BOOLEAN DEFAULT false,
  stage_3_completed_at  TIMESTAMPTZ,
  stage_4_completed     BOOLEAN DEFAULT false,
  stage_4_completed_at  TIMESTAMPTZ,
  stage_5_completed     BOOLEAN DEFAULT false,
  stage_5_completed_at  TIMESTAMPTZ,
  stage_6_completed     BOOLEAN DEFAULT false,
  stage_6_completed_at  TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, local_date)
);

-- RLS — non-negotiable
ALTER TABLE public.powerflow_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on powerflow_state"
  ON public.powerflow_state FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for daily lookups
CREATE INDEX IF NOT EXISTS idx_powerflow_state_tenant_date
  ON public.powerflow_state(tenant_id, local_date);

-- Updated_at trigger
CREATE OR REPLACE TRIGGER set_updated_at_powerflow_state
  BEFORE UPDATE ON public.powerflow_state
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 1C. ADD SOURCE COLUMN TO PROSPECTS
-- ============================================================================

ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- ============================================================================
-- 7. UPDATE SB1 (Mel Wallace) WITH NEW COLUMNS
-- ============================================================================

UPDATE public.tenants SET
  persona_code = 'P3',
  tyranny = 'Bandwidth',
  timezone = 'America/New_York',
  maslow_entry = 2,
  features = '{"ask_plexi": true, "deal_room": true, "plexicos": true, "powerflow": true}'::jsonb,
  vocab_skin = '{}'::jsonb,
  dev_mode = false,
  storefront_enabled = false
WHERE name = 'Mel Wallace';

-- ============================================================================
-- 2. INSERT NEW TENANTS (SB2–SB6)
-- ============================================================================

-- SB2 — Ben D'Amprisi Jr. (SunnAx Technologies)
INSERT INTO public.tenants (
  id, slug, name, company, role, sandbox_token, persona_code, tyranny, timezone,
  maslow_entry, storefront_enabled, features,
  system_prompt_override, vocab_skin, expires_at
) VALUES (
  gen_random_uuid(),
  'ben-damprisi-sunnax',
  'Ben D''Amprisi Jr.',
  'SunnAx Technologies',
  'Solo Founder / XSense Labs Demo Seller',
  'pxs_' || encode(gen_random_bytes(24), 'hex'),
  'P5',
  'Execution',
  'America/New_York',
  1,
  true,
  '{"ask_plexi": true, "deal_room": true, "storefront": true, "plexicos": false, "powerflow": true}'::jsonb,
  '{"context": "You are Plexi, an AI business development assistant for SunnAx Technologies. Ben sells Xencelabs drawing tablets and AI-powered creative tools. He is the only brick-and-mortar XSense Labs demo seller in the USA. His approach is consultative — matching the right tablet + AI software stack to each buyer type (like a sommelier pairing wine). Products include: Xencelabs 24-inch All-in-One ($2,500), 16-inch All-in-One ($1,500), Standard Tablet, Puck Controller, Hotkeys Remote, and AI Pairing Consulting. Year 1 goal: 5 tablets/month for $100K-$200K gross. Competitors: Wacom, Apple iPad with Pencil, CDW, Amazon, B&H Photo. SunnAx wins on consultative product pairing, not price. Never use these words: leverage, seamless, transformative, delve."}'::jsonb,
  '{}'::jsonb,
  NOW() + INTERVAL '30 days'
);

-- SB3 — Republic Events Australia
INSERT INTO public.tenants (
  id, slug, name, company, role, sandbox_token, persona_code, tyranny, timezone,
  maslow_entry, features,
  system_prompt_override, vocab_skin, expires_at
) VALUES (
  gen_random_uuid(),
  'republic-events-australia',
  'Republic Events',
  'Republic Events Australia',
  'Events BD Director',
  'pxs_' || encode(gen_random_bytes(24), 'hex'),
  'P1',
  'Ambiguity',
  'Australia/Melbourne',
  3,
  '{"ask_plexi": true, "deal_room": true, "plexicos": false, "powerflow": true}'::jsonb,
  '{"context": "You are Plexi, an AI business development assistant for Republic Events Australia, based at Level 23 HWT Tower, 40 City Road, Southbank VIC 3006. Republic Events produces major events including the Australian Open and F1 Grand Prix Melbourne. You speak event production and sponsorship language. When the user says prospects, they mean sponsors. When they say pipeline, they mean event portfolio. When they say deal, they mean partnership. When they say outreach, they mean sponsor outreach. Frame all advice in terms of event partnerships, sponsorship value, and board-level reporting. Never use these words: leverage, seamless, transformative, delve."}'::jsonb,
  '{"prospects": "sponsors", "pipeline": "event portfolio", "outreach": "sponsor outreach", "deal": "partnership", "lead": "sponsor lead", "deal_room": "board report workspace", "artifact": "board report", "outreach_draft": "partnership proposal"}'::jsonb,
  NOW() + INTERVAL '30 days'
);

-- SB4 — Gravity Media (Josh Rosen)
INSERT INTO public.tenants (
  id, slug, name, company, role, sandbox_token, persona_code, tyranny, timezone,
  maslow_entry, features,
  system_prompt_override, vocab_skin, expires_at
) VALUES (
  gen_random_uuid(),
  'josh-rosen-gravity-media',
  'Josh Rosen',
  'Gravity Media',
  'VP of Production & Content',
  'pxs_' || encode(gen_random_bytes(24), 'hex'),
  'P2',
  'Bandwidth',
  'America/Chicago',
  2,
  '{"ask_plexi": true, "deal_room": true, "plexicos": true, "powerflow": true}'::jsonb,
  '{"context": "You are Plexi, an AI business development assistant for Gravity Media, a global broadcast production company with 30+ years of heritage spanning Gearhouse, HyperActive, Input Media, EMG, Aerial Camera Systems, Boost Graphics, Origins Digital, and 8+ other brands. Josh Rosen is VP of Production & Content based in Nashville. Gravity Media has no CRM and faces 6+ month sales cycles with no shared prospect intelligence across offices. Focus areas: OB/remote production, sports broadcast, live event coverage, aerial camera systems, graphics/virtual studio, and streaming/digital delivery. Help Josh identify the highest-value broadcast production prospects and build systematic outreach. Never use these words: leverage, seamless, transformative, delve."}'::jsonb,
  '{}'::jsonb,
  NOW() + INTERVAL '30 days'
);

-- SB5 — Ken D'Amato (Dogfooding)
INSERT INTO public.tenants (
  id, slug, name, company, role, sandbox_token, persona_code, tyranny, timezone,
  maslow_entry, dev_mode, features,
  system_prompt_override, vocab_skin,
  powerflow_quick_start, expires_at
) VALUES (
  gen_random_uuid(),
  'ken-damato-plexify',
  'Ken D''Amato',
  'Plexify AI',
  'Solo Founder',
  'pxs_' || encode(gen_random_bytes(24), 'hex'),
  'KDEV',
  'Bandwidth',
  'America/New_York',
  6,
  false,
  '{"ask_plexi": true, "deal_room": true, "plexicos": true, "powerflow": true, "superpowers": true}'::jsonb,
  '{"context": "You are Plexi, Ken D''Amato''s AI business development co-pilot for Plexify AI. Ken is the solo founder building an AI-powered BD platform for AEC, media, and event production professionals. He has 6 active pilot sandboxes: SB1 Mel Wallace (Hexagon/Multivista, AEC), SB2 Ben D''Amprisi Jr (SunnAx Technologies, consumer tech), SB3 Republic Events (Australia, events), SB4 Josh Rosen (Gravity Media, broadcast), SB5 Ken himself (dogfooding), SB6 Dev Team (external builders). Help Ken track pilot status, identify follow-up priorities, and make product decisions. Never use these words: leverage, seamless, transformative, delve."}'::jsonb,
  '{}'::jsonb,
  'What is the status of all 6 pilot sandboxes and who needs follow-up today?',
  NOW() + INTERVAL '365 days'
);

-- SB6 — Dev Team (External Builders)
INSERT INTO public.tenants (
  id, slug, name, company, role, sandbox_token, persona_code, tyranny, timezone,
  maslow_entry, dev_mode, features,
  system_prompt_override, vocab_skin,
  powerflow_quick_start, expires_at
) VALUES (
  gen_random_uuid(),
  'dev-team-plexify',
  'Dev Team',
  'Plexify AI (External)',
  'Agent Builder / Sub-Feature Dev',
  'pxs_' || encode(gen_random_bytes(24), 'hex'),
  'KDEV2',
  'Execution',
  'America/New_York',
  4,
  true,
  '{"ask_plexi": true, "deal_room": true, "plexicos": true, "powerflow": true, "superpowers": true}'::jsonb,
  '{"context": "You are Plexi, an AI assistant for the Plexify AI dev team. All 6 PlexiCoS agents should be shown as ACTIVE in this sandbox (dev preview). Help developers understand the agent registry, build sub-features, and plan implementation tasks. When asked about agents, report their current status and suggest next build priorities. Never use these words: leverage, seamless, transformative, delve."}'::jsonb,
  '{}'::jsonb,
  'What agents are in COMING SOON status and what are the next build tasks?',
  NOW() + INTERVAL '365 days'
);
