# PlexifySOLO Development Handoff — Session 12 Complete

Last updated: 2026-02-21

## Quick Start for Next Chat

Paste this into your next Claude Code session:

```
Continue building PlexifySOLO. Read CLAUDE.md first, then docs/SPRINT_STATUS.md
for full context. Sessions 1-12 are complete. The app is live on Railway at
https://plexifybid-production.up.railway.app. Session 12 expanded from 1 to 6
tenants across AEC, events, broadcast, and consumer-tech verticals. Added vocab
skins, system_prompt_override, timezone-aware Powerflow pipeline, and superpowers
CLI. All code is on main branch, commit 74a2646. Run the Session 12 migration
against Supabase before testing new tenants. Check SPRINT_STATUS.md for next steps.
```

## What Was Built in Session 12

| Item | Description | Key Files |
|------|-------------|-----------|
| Migration | 9 new tenants columns, powerflow_state table, source on prospects | `supabase/migrations/20260221_session12_multi_tenant.sql` |
| 5 New Tenants | SB2-SB6 across events, broadcast, consumer-tech, internal | Migration SQL (INSERT) |
| SB1 Update | Mel Wallace gets persona_code, timezone, vocab_skin, powerflow | Migration SQL (UPDATE) |
| Vocab Skin Hook | `useTenantVocab()` — render-layer label translations | `src/hooks/useTenantVocab.ts` |
| System Prompt Override | Server-side persona injection into Ask Plexi | `server/routes/ask-plexi.js` |
| Powerflow API | GET /api/powerflow/today, POST /api/powerflow/complete | `server/routes/powerflow.js` |
| Powerflow Triggers | Auto-mark stages from Ask Plexi + Deal Room actions | `server/routes/ask-plexi.js`, `server/routes/deal-rooms.js` |
| PowerflowPyramid | Inverted pyramid UI on ExecutiveFeed home page | `src/components/PowerflowPyramid.tsx` |
| Gravity Media Seeds | 30 broadcast production prospects for SB4 | `supabase/seeds/20260221_gravity_media_prospects.sql` |
| Superpowers CLI | scaffold, activate, test (stub), ship scripts | `scripts/superpowers/*.js` |

## New Tenant Roster

| Code | Name | Company | Industry | Persona | Timezone |
|------|------|---------|----------|---------|----------|
| SB1 | Mel Wallace | Hexagon / Multivista | AEC | mel-closer | America/New_York |
| SB2 | Priya Kapoor | Republic Events Australia | Events | priya-connector | Australia/Sydney |
| SB3 | Tomás Rivera | Rivera & Sons Mechanical | AEC (Subcontractor) | tomas-grinder | America/Chicago |
| SB4 | Josh Rosen | Gravity Media | Broadcast | josh-strategist | America/Los_Angeles |
| SB5 | Anika Chen | NovaByte Consumer Electronics | Consumer Tech | anika-launcher | America/Los_Angeles |
| SB6 | Internal Dev Playground | Plexify Engineering | Internal | dev-sandbox | America/New_York |

**Note:** Sandbox tokens for SB2-SB6 are generated dynamically in the migration via `gen_random_bytes(24)`. After running the migration, query the tenants table to get the actual tokens:
```sql
SELECT slug, sandbox_token FROM public.tenants ORDER BY created_at;
```

## New Database Schema

### Modified Tables
- **tenants** — 9 new columns: `persona_code`, `tyranny`, `timezone`, `maslow_entry`, `system_prompt_override`, `vocab_skin`, `powerflow_quick_start`, `storefront_enabled`, `dev_mode`
- **prospects** — new column: `source TEXT DEFAULT 'manual'`

### New Tables
- **powerflow_state** — daily pipeline tracking per tenant (tenant_id, local_date, stage_1_at through stage_6_at, completed_at, updated_at). RLS enabled. Unique constraint on (tenant_id, local_date).

### Total: 15 tables (was 14 + 1 new)

## New API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/powerflow/today` | Get today's powerflow state (timezone-aware) |
| POST | `/api/powerflow/complete` | Manually complete a stage (body: `{ stage: 1-6 }`) |

## Powerflow Stage Triggers

| Stage | Name | Triggered By |
|-------|------|-------------|
| 1 | Ask Plexi Query | Any Ask Plexi chat message |
| 2 | Deal Room Chat | Any Deal Room RAG chat |
| 3 | Outreach Draft | `draft_outreach` tool call in Ask Plexi |
| 4 | Pipeline Analysis | `analyze_pipeline` tool call in Ask Plexi |
| 5 | Artifact Generated | Any Deal Room artifact generation |
| 6 | Close It / Win Logged | Manual click in PowerflowPyramid UI |

## Vocab Skin Examples

| Tenant | `deal_room` | `prospects` | `outreach` | `pipeline` |
|--------|------------|-------------|------------|------------|
| SB1 Mel (AEC) | Deal Room | Prospects | Outreach | Pipeline |
| SB2 Priya (Events) | Board Report Workspace | Sponsors | Proposals | Sponsorship Pipeline |
| SB4 Josh (Broadcast) | Production Brief | Accounts | Pitch Deck | Revenue Pipeline |

## Architecture Decisions (Session 12)

- **Single migration file**: Combined Tasks 1, 2, 7 into one SQL file for atomic execution — 2026-02-21
- **Vocab skin is render-only**: Never modifies API queries, DB columns, or tool names — 2026-02-21
- **system_prompt_override server-side only**: Never returned in auth/validate response — 2026-02-21
- **Timezone via Intl.DateTimeFormat**: No moment.js, no offset caching, IANA strings only — 2026-02-21
- **Powerflow triggers are non-blocking**: Fire-and-forget, never fail the parent request — 2026-02-21
- **Generated tokens**: SB2-SB6 use `gen_random_bytes(24)` for unique tokens — 2026-02-21

## Files Created (10 new)

```
scripts/superpowers/
├── activate.js              # Load domain vocab + persona
├── scaffold.js              # Generate boilerplate (agent, route, component, migration, tenant)
├── ship.js                  # Handoff doc template + deploy checklist
└── test.js                  # STUB — "coming in Session 13"

server/routes/
└── powerflow.js             # Powerflow API (today, complete, markPowerflowStage)

src/
├── components/
│   └── PowerflowPyramid.tsx # Inverted pyramid UI on home page
├── hooks/
│   └── useTenantVocab.ts    # Render-layer vocab translation hook
└── server/
    └── powerflowApi.ts      # Vite dev middleware for powerflow routes

supabase/
├── migrations/
│   └── 20260221_session12_multi_tenant.sql  # Combined migration
└── seeds/
    └── 20260221_gravity_media_prospects.sql  # 30 broadcast prospects for SB4
```

## Files Modified (9)

| File | Changes |
|------|---------|
| `server/index.mjs` | Added powerflow route imports + route handlers |
| `server/lib/supabase.js` | Added getOrCreatePowerflowState, updatePowerflowStage, getTenantById |
| `server/routes/ask-plexi.js` | Renamed to DEFAULT_SYSTEM_PROMPT, added buildSystemPrompt(), powerflow triggers |
| `server/routes/auth.js` | Added vocab_skin, timezone, persona_code, powerflow_quick_start, dev_mode, storefront_enabled to response |
| `server/routes/deal-rooms.js` | Added powerflow triggers (Stage 2 on chat, Stage 5 on artifacts) |
| `src/components/NavigationSidebar.tsx` | Applied vocab skin to Deal Room label |
| `src/contexts/SandboxContext.tsx` | Extended TenantInfo interface with new fields |
| `src/features/executive/ExecutiveFeed.tsx` | Added PowerflowPyramid, Quick-Start pill, vocab skin on action cards |
| `vite.config.ts` | Added powerflowMiddleware import + registration |

## Post-Deploy Steps

1. **Run migration** against Supabase:
   ```
   npx supabase db push
   ```
   Or paste `supabase/migrations/20260221_session12_multi_tenant.sql` into the Supabase SQL editor.

2. **Run Gravity Media seeds** (optional, SB4 only):
   Paste `supabase/seeds/20260221_gravity_media_prospects.sql` into the Supabase SQL editor.

3. **Query sandbox tokens** for new tenants:
   ```sql
   SELECT name, company, slug, sandbox_token FROM public.tenants ORDER BY created_at;
   ```

4. **Push to GitHub** to trigger Railway auto-deploy:
   ```
   git push origin main
   ```

5. **Verify** after deploy:
   - `/api/health` returns 200
   - SB1 sandbox URL still works
   - PowerflowPyramid renders on home page
   - New tenant tokens work (after migration runs)

## Known Issues (Carried Forward + New)

| Issue | Impact | Status |
|-------|--------|--------|
| PDF upload fragile (pdf-parse lazy import) | Crashes possible | Carried |
| Citations "Chunk 0" on small docs | Cosmetic | Carried |
| ElevenLabs free tier limits | Audio gen may fail | Carried |
| Large bundle (4.6MB) | Slow initial load | Carried |
| BID-era unused files in src/server/ | Clutter | Carried |
| SB2-SB6 tokens are random | Must query DB after migration | New — by design |
| Powerflow test file not yet created | No automated test coverage | New |
| Pre-existing deleted binary files in working tree | Git status noise | Pre-existing |

## Next Steps (Session 13+)

1. **Run migration + push to deploy** — Verify all 6 tenants work in production
2. **My SalesPlex Flow page** — Sales process workflow visualization
3. **Home dashboard improvements** — Activity feed, metrics per tenant
4. **Mobile responsive pass** — Sidebar collapse, touch-friendly controls
5. **Streaming responses** — SSE for Ask Plexi and Deal Room chat
6. **RLS leak test** — Vitest test at `server/tests/rls-leak-test.mjs`
7. **Procore integration** — OAuth flow, project sync
8. **Stripe billing** — Self-serve for post-pilot customers

## Backup Branches
- `backup/pre-session12` — Sessions 1-11 state (before multi-tenant expansion)
- `backup/pre-deal-room` — Sessions 1-8 state
- `backup/pre-plexifyken-20260117` — Original PlexifyBID state
- `main` — Current production (Session 12, commit 74a2646)

## Git Tags
- `v0.1.0-demo-ready` — Original BID stable demo
- `v0.2.0-mel-demo` — Mel Demo Live Prospecting Agent (Feb 2026)
