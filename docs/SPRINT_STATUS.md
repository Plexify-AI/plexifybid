# PlexifySOLO Sprint Status
Last updated: 2026-02-21 (Session 12 committed: 74a2646)

## Current Sprint: Multi-Tenant Expansion
Started: 2026-02-11
Goal: Expand PlexifySOLO from 1 tenant to 6 across AEC, events, broadcast, and consumer-tech verticals with vocab skins, system prompt overrides, and Powerflow pipeline.

## Status: Sessions 1-12 Complete — Multi-Tenant Ready

### Production
- **URL:** https://plexifybid-production.up.railway.app
- **Domain:** solo.plexifyai.com
- **Sandbox (SB1):** /sandbox?token=pxs_c13a257e1701ca2b148733ac591381cd8a284f9b7bd47084
- **Railway:** 14 service variables + 8 Railway system vars
- **Supabase:** 15 tables, RLS enabled, Storage bucket (deal-room-files)
- **Tenants:** 10 (4 pre-existing + 6 from Session 12 migration)

### Tenant Roster — All 10 Sandbox URLs
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

## Features Live in Production
1. **Sandbox Auth** — Token-based tenant isolation, usage logging
2. **Ask Plexi** — Claude AI chat with 3 tools, prospect cards, outreach preview, pipeline charts
3. **Deal Room** — Document upload, RAG chunking, source-grounded AI chat with citations
4. **Deal Room Artifacts** — Deal Summary, Competitive Analysis, Meeting Prep generation; dark-themed renderers; PDF export
5. **Deal Room Audio** — ElevenLabs TTS briefings (single voice) + podcasts (two-voice host/analyst); custom audio player
6. **PlexiCoS Agents** — Agent registry, orchestration visual, activity feed
7. **Home Dashboard** — Executive feed with welcome banner, action chips, Powerflow pyramid
8. **Production Hardening** — Helmet security, CORS, rate limiting, Docker deployment
9. **Multi-Tenant** — 6 tenants, vocab skins (render-layer label overrides), system_prompt_override (server-side persona)
10. **Powerflow Pipeline** — Timezone-aware daily 6-stage pipeline with auto-triggers from AI actions

## Completed — All Sessions

### Session 1 — Fork + Rebrand + Docker
Commit: `f2a1564`
- PlexifyBID → PlexifySOLO rebrand (package.json, index.html, sidebar, routes, CSS)
- Multi-stage Node 20 alpine Dockerfile + server/index.mjs production server
- .dockerignore, SPA fallback, /api/health endpoint
- Verified: build ✅, dev server ✅, production server ✅, Docker ✅

### Session 2 — Supabase Schema + Seed Data
Commit: `39afada`
- Migration: 9 core tables (tenants, prospects, contacts, connections, case_studies, icp_configs, conversations, outreach_drafts, usage_events)
- RLS on all tables, service-role full access, anon read policies
- Seed data: 1 tenant, 47 prospects, 47 contacts, 8 connections, 10 case studies, 1 ICP config
- server/lib/supabase.js: service-role client, query helpers, tenant middleware

### Session 3 — Claude API Integration
Commit: `25d9f20`
- @anthropic-ai/sdk installed, Claude client with tool_use conversation loop
- 3 AEC tools: search_prospects, draft_outreach, analyze_pipeline (server/tools/)
- POST /api/ask-plexi/chat with conversation persistence
- AskPlexiInterface.tsx: real API calls, rotating loading states, tool badges
- Lazy init pattern for Claude + Supabase clients

### Session 4 — Sandbox Auth + Tenant Isolation
Commit: `99fab49`
- sandboxAuth middleware: Bearer header / ?token= query / X-Sandbox-Token header
- POST /api/auth/validate public endpoint
- SandboxContext: React state-only auth (token lost on refresh by design)
- /sandbox?token=xxx entry → validate → redirect to /home
- NavigationSidebar shows tenant name + company; ExecutiveFeed welcome banner

### Session 5 — Railway Deployment + Production Hardening
Commit: `ea6bfbf` + hotfixes (`ec7da4c`, `d37cdcc`, `28da80d`)
- railway.toml, helmet, CORS, rate limiting (30 req/min)
- Dockerfile ARG for VITE_ build-time vars
- docs/DEPLOY_CHECKLIST.md: 8-step deployment guide
- Deployed live, verified: health ✅, auth ✅, dashboard ✅, Ask Plexi ✅

### Session 6 — UX Polish + Loading States
Commit: `e0a5721`
- Branding improvements, error handling, prospect card formatting
- Loading state animations for all AI operations
- Structured tool responses with prospect cards, outreach preview, pipeline charts

### Session 7 — Structured Tool Responses + Outreach
Commits: `0c35cea`, `dd96be5`
- Prospect cards with warmth scores and stage badges
- Outreach email preview with plain text email + styled analysis
- Pipeline analysis charts

### Session 8 — PlexiCoS Agents Page
Commit: `969a3b1`
- Agent registry with cards and status indicators
- Orchestration visualization
- Activity feed from usage_events

### Session 9 — Deal Room Core
Commits: `5a593d9`, `4bdbe54`, `9771b4a`, `ef92041`, `d30abbc`, `ed8648e`, `c2e558f`, `8e146ba`
- Deal Room CRUD (create, list, get)
- Document upload to Supabase Storage (PDF, DOCX, TXT, MD, CSV; max 10MB)
- RAG processing: text extraction → chunking → embedding storage
- Source-grounded AI chat with citations
- DealRoomPage: two-panel layout (40% sources / 60% chat)
- DealRoomListPage: card grid with create dialog
- Multiple hotfixes: pdf-parse lazy import, Docker cache busting, body limit increase

### Session 10 — Deal Room Artifacts
Commits: `b1e1d4d`, `5be2196`
- 3 artifact types: Deal Summary, Competitive Analysis, Meeting Prep
- ArtifactEnvelope<T> type pattern with JSON schema prompts
- Claude generates structured JSON from uploaded sources
- Dark-themed card renderers (DealSummaryRenderer, CompetitiveAnalysisRenderer, MeetingPrepRenderer)
- @react-pdf/renderer PDF export (ArtifactPDFDocument.tsx)
- Agent chip bar, artifact view toggle, artifact history in left panel
- Migration fix: trigger function name correction (set_updated_at)

### Session 11 — Deal Room Audio
Commit: `1cba74f`
- server/lib/elevenlabs.js: lazy-init client, generateBriefing (single voice), generatePodcast (two-voice via textToDialogue)
- Claude generates Bloomberg-style briefing scripts + host/analyst podcast dialogues
- ElevenLabs TTS → mp3 → Supabase Storage upload
- Audio streaming endpoint with Range header support
- AudioBriefingPlayer: custom HTML5 player (play/pause, seek, speed 1x-2x, download, expandable script with speaker labels)
- Audio + Podcast buttons on artifact header, audio history in left panel
- Supabase Storage bucket needed audio/mpeg MIME type added

### Session 12 — Multi-Tenant Expansion
Commits: `74a2646`, `2ef8b49` (docs), close-out commit TBD
- Migration: 9 new columns on tenants, powerflow_state table, source column on prospects
- 5 new tenants (SB2-SB6): Republic Events Australia, Rivera & Sons Mechanical, Gravity Media, NovaByte, Plexify Engineering
- SB1 (Mel Wallace) updated with persona_code, timezone, vocab_skin, powerflow_quick_start
- useTenantVocab hook: render-layer label translations (deal_room → "Board Report Workspace" for events)
- system_prompt_override: server-side persona injection into Ask Plexi (never returned to client)
- Powerflow API: GET /api/powerflow/today (timezone-aware), POST /api/powerflow/complete
- Powerflow auto-triggers: Ask Plexi → Stage 1/3/4, Deal Room chat → Stage 2, Artifacts → Stage 5
- PowerflowPyramid component on ExecutiveFeed home page with Quick-Start pill
- 30 Gravity Media broadcast prospect seeds (OB/Remote, Sports, Live Event, Graphics, Streaming)
- 4 superpowers CLI scripts: scaffold, activate, test (stub), ship
- Close-out: Ben D'Amprisi Jr. system_prompt_override backfill (SunnAx/Xencelabs context) — verified ✅
- Deployed + verified: all 10 tenants live, vocab skins active, Powerflow rendering ✅
- Verified: `npx vite build` ✅ (3446 modules, 33s)

## Decisions Made
- Fork not turborepo: Ship speed > architecture elegance — 2026-02-11
- Real backend not mock: Mel needs real AI responses + persistence — 2026-02-11
- Railway over AWS: 15-min deploy vs 2-4 hours, Docker portability — 2026-02-11
- Claude API over OpenAI: Aligns with Anthropic partnership pitch — 2026-02-11
- Manual invoicing: Right for 1-3 pilot customers — 2026-02-11
- server/index.mjs: ESM extension avoids CJS/ESM conflicts — 2026-02-11
- Rich schema: Separate tables matching demo JSON for richer Claude responses — 2026-02-12
- Lazy client init: Vite loads .env.local after imports — 2026-02-12
- React state-only auth: No localStorage, no cookies, simpler — 2026-02-12
- No streaming v1: Full response after Claude finishes (2-5s) — 2026-02-12
- Permissive CORS: Allow-all for sandbox, lockable via ALLOWED_ORIGINS — 2026-02-12
- ArtifactEnvelope<T>: Shared type pattern for artifact consistency — 2026-02-14
- ElevenLabs textToDialogue: Native two-voice concatenation, no manual stitching — 2026-02-18
- Blob URL for audio: HTML5 audio can't send auth headers, fetch + blob workaround — 2026-02-18
- Single migration file: Combined Tasks 1/2/7 into one SQL for atomic execution — 2026-02-21
- Vocab skin render-only: Never modifies API queries, DB columns, or tool names — 2026-02-21
- system_prompt_override server-only: Never returned in auth/validate response — 2026-02-21
- Timezone via Intl.DateTimeFormat: No moment.js, IANA strings, no offset caching — 2026-02-21
- Powerflow triggers non-blocking: Fire-and-forget, never fail parent request — 2026-02-21
- Generated tokens for SB2-SB6: `gen_random_bytes(24)` for unique sandbox_tokens — 2026-02-21

## Known Issues
- **PDF upload fragile**: `createRequire` fix via lazy import of pdf-parse works but is brittle
- **Citations "Chunk 0"**: Small single-chunk documents show "Chunk 0" instead of meaningful ref
- **ElevenLabs free tier**: Character limits — monitor usage for Mel demo
- **Supabase Storage MIME**: Must manually add `audio/mpeg` to deal-room-files bucket allowed types
- **Large bundle**: 4.6MB main chunk — code-split when performance matters
- **BID-era scaffolding**: Unused files in src/server/ (ttsService.ts, podcastApi.ts, etc.)
- **SB2-SB6 tokens random**: Must query DB after migration to get sandbox URLs
- **Powerflow test missing**: No automated test at `server/tests/rls-leak-test.mjs` yet
- **Pre-existing deleted binaries**: Logos, PDFs, demo audio deleted locally but not committed

## Environment Variables (14 Railway + 8 system)
| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude |
| `ELEVENLABS_API_KEY` | No | ElevenLabs API key for audio |
| `NODE_ENV` | Yes | `production` |
| `ALLOWED_ORIGINS` | No | CORS origins |
| `PROCORE_CLIENT_ID` | No | Future Procore integration |
| `PROCORE_CLIENT_SECRET` | No | Future Procore integration |
| `VITE_ANTHROPIC_API_KEY` | Yes | Build-time for frontend |
| `VITE_APP_DESCRIPTION` | Yes | Build-time branding |
| `VITE_APP_NAME` | Yes | Build-time branding |
| `VITE_SUPABASE_ANON_KEY` | Yes | Build-time for frontend |
| `VITE_SUPABASE_URL` | Yes | Build-time for frontend |

## Next Steps — Session 13 Priority Order
1. **RLS leak test** — Dynamic, all 10 tenants × 15 tables (security debt, do FIRST)
2. **Republic Events demo prep** — Thursday deadline, SB2 (Priya) sandbox
3. **Streaming responses** — SSE for Ask Plexi / Deal Room chat
4. **My SalesPlex Flow page** — Ken's dogfooding sandbox
5. **Home dashboard improvements** — Activity feed, metrics per tenant
6. **Future**: Mobile responsive pass, Procore integration, Stripe billing, SOC 2 prep
