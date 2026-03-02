-- PlexifyAEC Sprint 1: Momentum Demo Seed Data
-- 5 opportunities + events for Mel Wallace (SB1) tenant
--
-- Usage:
--   Paste this SQL into Supabase SQL editor.
--   Requires: Sprint 0 migration applied (events, opportunities tables exist)
--   Requires: Mel Wallace tenant exists in tenants table
--
-- IMPORTANT: Replace the tenant_id CTE below if Mel's UUID differs.

-- Step 1: Get Mel Wallace's tenant_id
-- (Adjust token if needed — this is the SB1 token from SPRINT_STATUS.md)
WITH mel AS (
  SELECT id AS tenant_id FROM public.tenants
  WHERE sandbox_token = 'pxs_c13a257e1701ca2b148733ac591381cd8a284f9b7bd47084'
  LIMIT 1
)

-- Step 2: Insert 5 opportunities
INSERT INTO public.opportunities (tenant_id, account_name, contact_name, contact_email, contact_title, deal_hypothesis, stage, warmth_score)
SELECT
  mel.tenant_id,
  v.account_name,
  v.contact_name,
  v.contact_email,
  v.contact_title,
  v.deal_hypothesis,
  v.stage,
  0  -- warmth starts at 0, will be recomputed from events
FROM mel, (VALUES
  ('Suffolk Construction', 'Mark Sullivan', 'msullivan@suffolk.com', 'Senior PM',
   'Suffolk has 3 active NYC projects needing reality capture. Meeting booked for next week.',
   'engaged'),
  ('Skanska USA', 'James O''Brien', 'jobrien@skanska.com', 'VP Operations',
   'Skanska exploring tech stack modernization. Clicked our case study link twice.',
   'warming'),
  ('Tishman Speyer', 'Sarah Chen', 'schen@tishmanspeyer.com', 'Project Executive',
   'One cold intro email sent 20 days ago. No response. May need different angle.',
   'prospecting'),
  ('Lendlease', 'Maria Rodriguez', 'mrodriguez@lendlease.com', 'BD Director',
   'Met at NYC Construction Tech conference. Exchanged cards, positive conversation.',
   'warming'),
  ('Turner Construction', 'David Park', 'dpark@turnerconstruction.com', 'Preconstruction Mgr',
   'Sent 3 emails over 2 weeks, no response. May be wrong contact or bad timing.',
   'prospecting')
) AS v(account_name, contact_name, contact_email, contact_title, deal_hypothesis, stage);

-- Step 3: Insert events for each opportunity
-- We'll use a DO block to reference the opportunity IDs

DO $$
DECLARE
  v_tenant_id UUID;
  v_suffolk_id UUID;
  v_skanska_id UUID;
  v_tishman_id UUID;
  v_lendlease_id UUID;
  v_turner_id UUID;
BEGIN
  -- Get Mel's tenant_id
  SELECT id INTO v_tenant_id FROM public.tenants
  WHERE sandbox_token = 'pxs_c13a257e1701ca2b148733ac591381cd8a284f9b7bd47084';

  -- Get opportunity IDs
  SELECT id INTO v_suffolk_id FROM public.opportunities
  WHERE tenant_id = v_tenant_id AND account_name = 'Suffolk Construction' LIMIT 1;

  SELECT id INTO v_skanska_id FROM public.opportunities
  WHERE tenant_id = v_tenant_id AND account_name = 'Skanska USA' LIMIT 1;

  SELECT id INTO v_tishman_id FROM public.opportunities
  WHERE tenant_id = v_tenant_id AND account_name = 'Tishman Speyer' LIMIT 1;

  SELECT id INTO v_lendlease_id FROM public.opportunities
  WHERE tenant_id = v_tenant_id AND account_name = 'Lendlease' LIMIT 1;

  SELECT id INTO v_turner_id FROM public.opportunities
  WHERE tenant_id = v_tenant_id AND account_name = 'Turner Construction' LIMIT 1;

  -- ============================================================
  -- #1 Suffolk Construction — HOT (meeting booked, proposal stage)
  -- Expected warmth: 80-100
  -- ============================================================
  INSERT INTO public.events (tenant_id, opportunity_id, event_type, payload, source, created_at) VALUES
    (v_tenant_id, v_suffolk_id, 'OUTREACH_SENT', '{}', 'agent', NOW() - INTERVAL '18 days'),
    (v_tenant_id, v_suffolk_id, 'OUTREACH_OPENED', '{}', 'system', NOW() - INTERVAL '17 days'),
    (v_tenant_id, v_suffolk_id, 'OUTREACH_CLICKED', '{}', 'system', NOW() - INTERVAL '16 days'),
    (v_tenant_id, v_suffolk_id, 'OUTREACH_REPLIED', '{"sentiment": "positive"}', 'system', NOW() - INTERVAL '12 days'),
    (v_tenant_id, v_suffolk_id, 'MEETING_BOOKED', '{"description": "Demo scheduled for next Tuesday"}', 'manual', NOW() - INTERVAL '5 days'),
    (v_tenant_id, v_suffolk_id, 'MEETING_COMPLETED', '{"description": "Great meeting, they want a proposal"}', 'manual', NOW() - INTERVAL '2 days'),
    (v_tenant_id, v_suffolk_id, 'PROPOSAL_SENT', '{"description": "Sent reality capture proposal for 3 NYC projects"}', 'agent', NOW() - INTERVAL '1 day');

  -- ============================================================
  -- #2 Skanska USA — WARM (clicks but no reply)
  -- Expected warmth: 40-60
  -- ============================================================
  INSERT INTO public.events (tenant_id, opportunity_id, event_type, payload, source, created_at) VALUES
    (v_tenant_id, v_skanska_id, 'OUTREACH_SENT', '{}', 'agent', NOW() - INTERVAL '14 days'),
    (v_tenant_id, v_skanska_id, 'OUTREACH_OPENED', '{}', 'system', NOW() - INTERVAL '13 days'),
    (v_tenant_id, v_skanska_id, 'OUTREACH_CLICKED', '{}', 'system', NOW() - INTERVAL '13 days'),
    (v_tenant_id, v_skanska_id, 'OUTREACH_SENT', '{}', 'agent', NOW() - INTERVAL '8 days'),
    (v_tenant_id, v_skanska_id, 'OUTREACH_OPENED', '{}', 'system', NOW() - INTERVAL '7 days'),
    (v_tenant_id, v_skanska_id, 'OUTREACH_CLICKED', '{}', 'system', NOW() - INTERVAL '6 days'),
    (v_tenant_id, v_skanska_id, 'SIGNAL_LOGGED', '{"description": "VP Ops mentioned our name at industry event"}', 'manual', NOW() - INTERVAL '3 days');

  -- ============================================================
  -- #3 Tishman Speyer — COLD (1 email, 20 days silence)
  -- Expected warmth: 0-10
  -- ============================================================
  INSERT INTO public.events (tenant_id, opportunity_id, event_type, payload, source, created_at) VALUES
    (v_tenant_id, v_tishman_id, 'OUTREACH_SENT', '{}', 'agent', NOW() - INTERVAL '20 days');

  -- ============================================================
  -- #4 Lendlease — WARMING (conference touch, LinkedIn connect)
  -- Expected warmth: 30-50
  -- ============================================================
  INSERT INTO public.events (tenant_id, opportunity_id, event_type, payload, source, created_at) VALUES
    (v_tenant_id, v_lendlease_id, 'SIGNAL_LOGGED', '{"description": "Met at NYC Construction Tech conference"}', 'manual', NOW() - INTERVAL '10 days'),
    (v_tenant_id, v_lendlease_id, 'OUTREACH_SENT', '{"description": "Follow-up email after conference"}', 'agent', NOW() - INTERVAL '8 days'),
    (v_tenant_id, v_lendlease_id, 'OUTREACH_OPENED', '{}', 'system', NOW() - INTERVAL '7 days'),
    (v_tenant_id, v_lendlease_id, 'OUTREACH_REPLIED', '{"sentiment": "neutral"}', 'system', NOW() - INTERVAL '5 days');

  -- ============================================================
  -- #5 Turner Construction — PENALIZED (3 emails, no response)
  -- Expected warmth: 0
  -- ============================================================
  INSERT INTO public.events (tenant_id, opportunity_id, event_type, payload, source, created_at) VALUES
    (v_tenant_id, v_turner_id, 'OUTREACH_SENT', '{}', 'agent', NOW() - INTERVAL '9 days'),
    (v_tenant_id, v_turner_id, 'OUTREACH_SENT', '{}', 'agent', NOW() - INTERVAL '6 days'),
    (v_tenant_id, v_turner_id, 'OUTREACH_SENT', '{}', 'agent', NOW() - INTERVAL '3 days');

END $$;
