-- ============================================================================
-- PlexifySOLO — Demo Reset Script
-- ============================================================================
--
-- PURPOSE:  Reset a tenant's powerflow_state so the pyramids show 0/6 fresh.
--           Use before demos, recordings, or testing.
--
-- WHERE:    Run in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
--
-- SAFETY:   Only deletes powerflow_state rows. Does NOT touch prospects,
--           contacts, conversations, deal rooms, or any other data.
--
-- ALSO:     After running the SQL, clear browser click counters by opening
--           DevTools Console on the sandbox page and running:
--
--           Object.keys(localStorage).filter(k => k.startsWith('powerflow_clicks_')).forEach(k => localStorage.removeItem(k));
--
-- ============================================================================


-- ── Step 1: Find the tenant ─────────────────────────────────────────────────
-- Mel Wallace (default demo tenant):
--   id:    00000000-0000-0000-0000-000000000001
--   token: pxs_c13a257e1701ca2b148733ac591381cd8a284f9b7bd47084
--
-- To find a different tenant, uncomment and run:
--
-- SELECT id, name, company, sandbox_token
-- FROM tenants
-- WHERE name ILIKE '%mel%'
--    OR company ILIKE '%hexagon%'
--    OR company ILIKE '%multivista%'
-- LIMIT 5;


-- ── Step 2: Delete today's powerflow state ──────────────────────────────────
-- Replace the tenant_id if resetting a different tenant.

DELETE FROM powerflow_state
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND local_date = CURRENT_DATE;


-- ── Step 3: Confirm the reset ───────────────────────────────────────────────
-- Should return no row for today's date. Previous days are preserved.

SELECT id, local_date,
       stage_1_completed, stage_2_completed, stage_3_completed,
       stage_4_completed, stage_5_completed, stage_6_completed
FROM powerflow_state
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
ORDER BY local_date DESC
LIMIT 3;


-- ── All 10 Tenant IDs (for reference) ──────────────────────────────────────
-- Uncomment to see all tenants:
--
-- SELECT id, name, company FROM tenants WHERE is_active = true ORDER BY name;
--
-- Known tenant IDs:
--   Mel Wallace (SB1):       00000000-0000-0000-0000-000000000001
--   See docs/SPRINT_STATUS.md for full tenant roster with sandbox tokens.


-- ── powerflow_state Schema Reference ────────────────────────────────────────
--
-- | column_name          | data_type                |
-- |----------------------|--------------------------|
-- | id                   | uuid                     |
-- | tenant_id            | uuid                     |
-- | local_date           | date                     |
-- | stage_1_completed    | boolean                  |
-- | stage_1_completed_at | timestamp with time zone |
-- | stage_2_completed    | boolean                  |
-- | stage_2_completed_at | timestamp with time zone |
-- | stage_3_completed    | boolean                  |
-- | stage_3_completed_at | timestamp with time zone |
-- | stage_4_completed    | boolean                  |
-- | stage_4_completed_at | timestamp with time zone |
-- | stage_5_completed    | boolean                  |
-- | stage_5_completed_at | timestamp with time zone |
-- | stage_6_completed    | boolean                  |
-- | stage_6_completed_at | timestamp with time zone |
-- | created_at           | timestamp with time zone |
-- | updated_at           | timestamp with time zone |
