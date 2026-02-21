# PlexifySOLO Development Handoff — Session 12 Complete

Last updated: 2026-02-21

## Quick Start for Next Chat

Paste this into your next Claude Code session:

```
Continue building PlexifySOLO. Read CLAUDE.md first, then
docs/SPRINT_STATUS.md for full context. Sessions 1-12 are
complete and closed out. The app is live on Railway at
https://plexifybid-production.up.railway.app with 10 tenants
across AEC, events, broadcast, consumer-tech, and internal
verticals.

SESSION 13 PRIORITY ORDER:
1. RLS leak test — dynamic, all tenants × all 15 tables
   (security debt, do this FIRST)
2. Republic Events demo prep (Thursday deadline)
3. Streaming responses for Ask Plexi / Deal Room chat
4. My SalesPlex Flow page (Ken's dogfooding sandbox)
5. Home dashboard improvements
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
| Ben Backfill | system_prompt_override for SunnAx/Xencelabs context | SQL applied directly in Supabase |

## Full Tenant Roster — All 10 Sandbox URLs

Base URL: `https://plexifybid-production.up.railway.app/sandbox?token=`

| # | Name | Company | Industry | Sandbox Token | Origin |
|---|------|---------|----------|---------------|--------|
| 1 | Mel Wallace | Hexagon / Multivista | AEC | `pxs_c13a257e1701ca2b148733ac591381cd8a284f9b7bd47084` | Pre-existing (SB1) |
| 2 | Republic Events | Republic Events Australia | AEC (Event Construction) | `pxs_80b87ef1ae530bf4c34b6af0073d13404e6230fdd2532aec` | Pre-existing |
| 3 | Josh Rosen | Gravity Media | Broadcast | `pxs_32092a7dac0fd24cf45a728ae7bc985830bc15d6be27755d` | Pre-existing |
| 4 | Ken D'Amato | Plexify AI | Internal | `pxs_678b89a496e9a43f25e64ac3c8ef057db9cd7be48082ebd5` | Pre-existing |
| 5 | Dev Team | Plexify AI (External) | Internal | `pxs_889ba81e96de708a2fb86618c80663a0228e5c5264e426de` | Pre-existing |
| 6 | Ben D'Amprisi Jr. | SunnAx Technologies | Consumer Tech | `pxs_f07758ccc00e5b13b41615ec6af7c3e723699c24afb4f2ef` | Pre-existing + backfill |
| 7 | Tomás Rivera | Rivera & Sons Mechanical | AEC (Sub) | `pxs_caf994027c4d18aaae5bb9c178785444fc6d7f4b536b79dd` | Session 12 (SB3) |
| 8 | Anika Chen | NovaByte Consumer Electronics | Consumer Tech | `pxs_f744a6b1fe1e6dd1aefd8f88b49f7d31c939d0f9a81e0b33` | Session 12 (SB5) |
| 9 | Internal Dev Playground | Plexify Engineering | Internal | `pxs_4d8ab9c4c8f3cfd1fa5d97b051f6efda59c72ef4a030fba9` | Session 12 (SB6) |
| 10 | Priya Kapoor | Republic Events Australia | Events (Sponsorship) | `pxs_03890da9a8b9028b0df8aa69b482b04bbfc3f9d3ad1425d3` | Session 12 (SB2) |

**Pre-existing vs. Session 12:** Tenants 1-6 existed before Session 12. Republic Events (#2) uses default AEC vocab (their team does event construction). Priya Kapoor (#10) is the events/sponsorship vocab skin tenant. Ben D'Amprisi (#6) was backfilled with SunnAx system_prompt_override during close-out.

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

## Post-Deploy Steps (All Completed ✅)

1. ✅ **Migration applied** — SQL pasted in Supabase editor (partial re-run with idempotent WHERE NOT EXISTS)
2. ✅ **Gravity Media seeds** — 30 broadcast prospects loaded for SB4
3. ✅ **Sandbox tokens queried** — All 10 tenant URLs documented above
4. ✅ **Pushed to GitHub** — Railway auto-deploy triggered and completed
5. ✅ **Verified** — Health check 200, SB1 works, PowerflowPyramid renders, all 10 tenants accessible
6. ✅ **Ben backfill** — system_prompt_override applied, Ask Plexi responds with SunnAx/Xencelabs context

## Known Issues (Carried Forward + New)

| Issue | Impact | Status |
|-------|--------|--------|
| PDF upload fragile (pdf-parse lazy import) | Crashes possible | Carried |
| Citations "Chunk 0" on small docs | Cosmetic | Carried |
| ElevenLabs free tier limits | Audio gen may fail | Carried |
| Large bundle (4.6MB) | Slow initial load | Carried |
| BID-era unused files in src/server/ | Clutter | Carried |
| RLS leak test not yet created | Security debt — 10 tenants × 15 tables = 150 checks | **Session 13 Priority 1** |
| Pre-existing deleted binary files in working tree | Git status noise | Pre-existing |

## Deferred to Session 13+

| Item | Priority | Notes |
|------|----------|-------|
| RLS leak test | **P1 — Do FIRST** | Dynamic, all tenants × all 15 tables (150 isolation checks) |
| Republic Events demo prep | P2 | Thursday deadline, SB2 (Priya) sandbox |
| Streaming responses | P3 | SSE for Ask Plexi / Deal Room chat |
| My SalesPlex Flow page | P4 | Ken's dogfooding sandbox |
| Home dashboard improvements | P5 | Activity feed, metrics per tenant |
| Mobile responsive pass | P6 | Sidebar collapse, touch-friendly controls |
| Procore integration | Future | OAuth flow, project sync |
| Stripe billing | Future | Self-serve for post-pilot customers |

## Backup Branches
- `backup/pre-session12` — Sessions 1-11 state (before multi-tenant expansion)
- `backup/pre-deal-room` — Sessions 1-8 state
- `backup/pre-plexifyken-20260117` — Original PlexifyBID state
- `main` — Current production (Session 12, commit 74a2646)

## Git Tags
- `v0.1.0-demo-ready` — Original BID stable demo
- `v0.2.0-mel-demo` — Mel Demo Live Prospecting Agent (Feb 2026)
