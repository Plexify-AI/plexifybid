# PlexifySOLO Sprint Status
Last updated: 2026-02-12 10:30 AM EST

## Current Sprint: Mel Sandbox Ship
Started: 2026-02-11
Goal: Ship a working PlexifySOLO sandbox URL to Mel Wallace (Hexagon/Multivista) by Feb 17.

## In Progress
- [ ] Claude API integration (replace OpenAI) — Claude Code Session 3
  - Status: NOT STARTED. Tool definitions designed for search_prospects, draft_outreach, analyze_pipeline.
  - Blocked by: Need .env.local with Supabase + Anthropic keys.
- [ ] Sandbox auth + tenant isolation — Claude Code Session 4
  - Status: PARTIALLY DONE. Tenant middleware created in server/lib/supabase.js. Needs integration into production server.
  - Blocked by: Claude API must be working.
- [ ] Deploy to Railway — Claude Code Session 5
  - Status: NOT STARTED. Railway.app selected over AWS for speed.
  - Blocked by: All backend sessions must pass smoke test locally.
- [ ] UX polish + loading states — Claude Code Session 6
  - Status: NOT STARTED. Branding, error handling, prospect card formatting.
  - Blocked by: Deployed and accessible.

## Completed This Sprint
- [x] Critical Analysis + Build Plan document — manual (Claude Opus chat)
- [x] CLAUDE.md rewritten for PlexifySOLO best practices — manual
- [x] SPRINT_STATUS.md created — manual
- [x] Deployment decision: Railway.app over AWS — manual
- [x] Architecture decision: Claude API over OpenAI — manual
- [x] Architecture decision: Simple fork over turborepo (monorepo later) — manual
- [x] Architecture decision: Real backend over mock data for sandbox — manual
- [x] Payment decision: Manual invoicing for pilots, Stripe post-pilots — manual
- [x] Fork PlexifyBID → PlexifySOLO rebrand — Claude Code Session 1
  - package.json: name=plexifysolo, version=0.1.0, updated desc/keywords/repo
  - index.html: title + meta description → PlexifySOLO branding
  - NavigationSidebar: trimmed to 5 SOLO-relevant items (Home, SalesPlex Flow, Ask Plexi, Settings, Integrations)
  - App.tsx: removed BID-specific routes, updated placeholder copy
  - CSS/Tailwind/vite.config: all PlexifyBID → PlexifySOLO references updated
  - IntegrationsPage: branding updated
- [x] Dockerfile + production server — Claude Code Session 1
  - Multi-stage Node 20 alpine Dockerfile (build + production stages)
  - server/index.mjs: standalone Express server serving dist/ + /api/health + SPA fallback
  - .dockerignore created
- [x] Verification passed — Claude Code Session 1
  - npm run build: succeeds (14s, 2348 modules)
  - npm run dev: Vite dev server starts, /api/health returns 200
  - node server/index.mjs: production server starts, health=200, app=200, /demo/mel=200 (SPA fallback)
  - Docker build + run: all 3 endpoints verified (health, app, /demo/mel)
- [x] Supabase schema + seed data — Claude Code Session 2
  - Migration: supabase/migrations/20260212_solo_sales_tables.sql
  - 9 tables: tenants, prospects (47), contacts (47), connections (8), case_studies (10), icp_configs (1), conversations, outreach_drafts, usage_events
  - All tables: tenant_id FK, RLS enabled, service-role full access + anon read policies
  - Indexes on tenant_id, warmth_score, stage, gc_slug, event_type
  - updated_at triggers on all tables with that column
  - Tenant has sandbox_token auth, features JSONB, expires_at
- [x] Seed data generated — Claude Code Session 2
  - supabase/seed.sql: 149 lines, all 113 records from Mel demo JSON data
  - scripts/generate-seed-sql.mjs: deterministic generator from JSON files
  - Mel Wallace tenant with sandbox_token, 30-day expiry, 3 feature flags
- [x] Server Supabase client — Claude Code Session 2
  - server/lib/supabase.js: service-role client, query helpers for all tables, tenant middleware
  - tenantMiddleware(): validates X-Sandbox-Token header, checks expiry, attaches req.tenant
  - Query helpers: getProspects, getContacts, getConnections, getCaseStudies, getICPConfig, etc.
  - Conversation + outreach CRUD helpers
  - Usage event logging

## Decisions Made
- Fork not turborepo: Ship speed > architecture elegance. Monorepo when 2+ products cause real maintenance pain. — 2026-02-11
- Real backend not mock: Mel already saw the deterministic demo. A sandbox with mock data is a second demo, not a trial. He needs real AI responses + real persistence. — 2026-02-11
- Railway over AWS: 15-min deploy vs 2-4 hours. Docker portability means zero lock-in. Migrate to AWS when Hexagon requires SOC 2. — 2026-02-11
- Claude API over OpenAI: Aligns with Anthropic partnership pitch. Existing tool registry maps to Claude tool_use format. — 2026-02-11
- Manual invoicing: Right for 1-3 pilot customers. Stripe self-serve is Sprint 4+. — 2026-02-11
- Minimal process adoption: One Superpowers command (execute-plan for multi-file features), one BMAD artifact (this file). No full framework adoption. — 2026-02-11
- server/index.mjs not .js: Package.json is CJS (no "type":"module"), so production server uses .mjs extension for ESM imports. Avoids cascading CJS/ESM conflicts with Vite, PostCSS, Tailwind configs. — 2026-02-11
- Rich schema over flat table: Kept separate prospects/contacts/connections/case_studies tables matching demo JSON rather than a flat prospects-only table. Richer data = better Claude tool responses. — 2026-02-12
- ref_id pattern: Each table has a text ref_id (e.g. 'proj-001') alongside the UUID primary key, so existing demo components can reference data by familiar IDs while the database uses proper UUIDs. — 2026-02-12

## Next Session Should
1. Add .env.local with Supabase URL + anon key + service role key + Anthropic API key
2. Apply migration: run SQL in Supabase dashboard or via npx supabase db push
3. Run seed.sql in Supabase SQL editor
4. Session 3: Claude API integration — replace OpenAI, create tool definitions for search_prospects, draft_outreach, analyze_pipeline
5. Wire tenant middleware into production server
