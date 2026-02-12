# PlexifySOLO Sprint Status
Last updated: 2026-02-12 (Session 4 committed: 99fab49)

## Current Sprint: Mel Sandbox Ship
Started: 2026-02-11
Goal: Ship a working PlexifySOLO sandbox URL to Mel Wallace (Hexagon/Multivista) by Feb 17.

## Next Up
- [ ] Deploy to Railway — Claude Code Session 5
  - Railway.app selected over AWS for speed
  - Prereqs: All backend sessions pass smoke test locally ✅
- [ ] UX polish + loading states — Claude Code Session 6
  - Branding, error handling, prospect card formatting
  - Blocked by: Deployed and accessible

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
- [x] Claude API integration — Claude Code Session 3 (25d9f20)
  - @anthropic-ai/sdk installed, Claude client with tool_use conversation loop
  - 3 AEC tools: search_prospects, draft_outreach, analyze_pipeline (server/tools/)
  - POST /api/ask-plexi/chat route with tenant auth fallback + conversation persistence
  - Vite dev middleware (src/server/askPlexiApi.ts) + production server wiring
  - AskPlexiInterface.tsx rewritten: real API calls, rotating loading states, tool badges
  - Lazy init for Claude + Supabase clients (Vite env var timing fix)
  - Tested live: all 3 tools query real Supabase data (47 prospects, contacts, case studies)
- [x] Sandbox auth + tenant isolation — Claude Code Session 4 (99fab49)
  - sandboxAuth middleware: token from Bearer header / ?token= query / X-Sandbox-Token header
  - Validates against Supabase tenants table, checks is_active + expires_at
  - Logs auth attempts (success + failure) to usage_events
  - POST /api/auth/validate: public endpoint returns tenant info or error
  - SandboxContext: React state-only auth (no localStorage, no cookies — token lost on refresh by design)
  - /sandbox?token=xxx entry → validates → redirects to /home; AccessRequired fallback
  - NavigationSidebar shows tenant name + company; ExecutiveFeed welcome banner + action chips
  - AskPlexiInterface sends Bearer token; ask-plexi route uses req.tenant (dev fallback removed)
  - Vite dev middleware + production server both enforce auth on all /api/ routes
  - Tested: health public ✅, auth validate ✅, ask-plexi rejects without token ✅, ask-plexi works with Bearer ✅, build passes (2351 modules) ✅

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
- Lazy client init: Anthropic + Supabase clients use lazy initialization because Vite loads .env.local vars after module imports. VITE_ANTHROPIC_API_KEY used as fallback since Vite's loadEnv doesn't reliably surface non-VITE_ prefixed vars. — 2026-02-12
- No streaming v1: Ask Plexi returns full response after Claude finishes (2-5s). Streaming deferred to Session 6 UX polish. — 2026-02-12
- Dev tenant fallback: In dev mode, Ask Plexi auto-uses Mel's tenant_id when no X-Sandbox-Token header sent. Production will require the header (Session 4). — 2026-02-12
- React state-only auth: Token stored in React context, not localStorage or cookies. Token lost on refresh — user re-enters via sandbox URL. Simpler, no stale token bugs. — 2026-02-12
- Dev fallback removed: sandboxAuth middleware enforces token on all /api/ routes in both dev and prod. No more silent Mel fallback. — 2026-02-12
- Token extraction priority: Authorization Bearer > ?token= query param > X-Sandbox-Token header. Bearer for API clients, query for URL entry, X-Sandbox-Token for backward compat. — 2026-02-12

## Environment Setup (Done)
- [x] .env.local created with Supabase URL + anon key + service role key + Anthropic API key
- [x] Migration applied to live Supabase project
- [x] Seed data loaded (1 tenant, 47 prospects, 47 contacts, 8 connections, 10 case studies, 1 ICP config)

## Next Session Should
1. Session 5: Deploy to Railway.app
2. Configure env vars (Supabase URL/keys, Anthropic API key) in Railway dashboard
3. Verify: /api/health, /sandbox?token=xxx → auth → /home → Ask Plexi works
4. Share sandbox URL with Mel: https://[railway-domain]/sandbox?token=pxs_...
