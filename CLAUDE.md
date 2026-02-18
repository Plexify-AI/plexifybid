# CLAUDE.md — PlexifySOLO

Solo founder project. Ask before changing anything. Read Safety Rules first.

## Product Overview
PlexifySOLO is an AI-powered sales intelligence platform for AEC (Architecture, Engineering, Construction) professionals. It combines prospect research, outreach drafting, deal room collaboration, and audio briefing generation into a single sandbox-authenticated workspace.

**Production URL:** https://plexifybid-production.up.railway.app
**Custom Domain:** solo.plexifyai.com
**Sandbox Entry:** /sandbox?token=pxs_c13a257e1701ca2b148733ac591381cd8a284f9b7bd47084

## Commands
- `npm run dev` — Start Vite dev server (port 5173)
- `npm run build` — Production build (Vite, ~3400 modules, 30s)
- `npm run preview` — Preview production build locally
- `npm test` — Run tests (Vitest, when test suite exists)
- `node server/index.mjs` — Start production Express server
- `docker build -t plexifysolo .` — Build Docker image
- `npx supabase db push` — Apply migrations to Supabase

## Tech Stack
- React 18 + Vite 5 + TypeScript
- TailwindCSS for styling
- Express 5 middleware (embedded in Vite dev, standalone in production via server/index.mjs)
- Supabase (PostgreSQL + Auth + RLS + Storage)
- Anthropic Claude API (claude-sonnet-4-20250514) for AI features — tool_use pattern
- ElevenLabs API (eleven_turbo_v2) for audio briefings + podcasts
- @react-pdf/renderer for client-side PDF export
- Node 20 LTS, npm (not yarn/pnpm)
- Railway.app + Docker for deployment (auto-deploy from GitHub main)

## Features Shipped (Sessions 1-11)
1. **Ask Plexi** — Claude-powered AI chat with 3 AEC tools (search_prospects, draft_outreach, analyze_pipeline), prospect cards, outreach preview, pipeline charts
2. **Deal Room** — Document upload (PDF, DOCX, TXT, MD, CSV) → Supabase Storage, RAG chunking + embedding, source-grounded AI chat with citations
3. **Deal Room Artifacts** — Claude generates structured Deal Summary, Competitive Analysis, Meeting Prep from uploaded sources; dark-themed card renderers; PDF export
4. **Deal Room Audio** — ElevenLabs TTS: Bloomberg-style single-voice briefings + two-voice host/analyst podcasts from artifacts; custom HTML5 player with seek, speed, download, script viewer
5. **PlexiCoS Agents** — Agent registry display, orchestration visual, activity feed
6. **Sandbox Auth** — Token-based tenant isolation, Bearer/query/header extraction, usage event logging
7. **Production Deployment** — Railway + Docker, helmet, CORS, rate limiting (30 req/min)

## Directory Structure
```
├── src/                           # React frontend
│   ├── components/                # Reusable UI components (28 files)
│   │   └── artifacts/             # DealSummaryRenderer, CompetitiveAnalysisRenderer, MeetingPrepRenderer, ArtifactPDFDocument
│   ├── pages/                     # Route-level pages (11 files)
│   │   ├── DealRoomPage.tsx       # Two-panel Deal Room workspace
│   │   ├── DealRoomListPage.tsx   # Deal Room listing
│   │   ├── PlexiCosAgentsPage.tsx # Agent registry
│   │   ├── SandboxEntry.tsx       # /sandbox?token= entry point
│   │   └── AccessRequired.tsx     # Auth fallback
│   ├── features/                  # Feature modules
│   │   ├── executive/             # ExecutiveFeed (home page)
│   │   ├── mel-demo/              # Original Mel demo (DemoEngine, mock data)
│   │   ├── agent-management/      # Agent registry + session tracker
│   │   └── ecosystem/             # PlaceGraph visualization
│   ├── contexts/                  # SandboxContext (auth), RealDocsContext
│   ├── server/                    # Vite dev middleware wrappers (16 files)
│   │   ├── askPlexiApi.ts         # Ask Plexi dev middleware
│   │   ├── dealRoomsApi.ts        # Deal Rooms dev middleware (CRUD, artifacts, audio)
│   │   ├── authApi.ts             # Auth validation dev middleware
│   │   └── usageEventsApi.ts      # Usage events dev middleware
│   ├── types/                     # TypeScript types
│   │   └── artifacts.ts           # ArtifactEnvelope<T>, output schemas, ARTIFACT_CHIPS
│   └── lib/                       # Frontend utilities (Supabase client)
├── server/                        # Express backend
│   ├── index.mjs                  # Production server (helmet, CORS, rate limit, routes)
│   ├── routes/                    # API route handlers
│   │   ├── ask-plexi.js           # Claude AI chat with tool_use loop
│   │   ├── deal-rooms.js          # CRUD, file upload, RAG chat, artifacts, audio gen
│   │   ├── auth.js                # POST /api/auth/validate
│   │   └── usage-events.js        # GET /api/usage-events
│   ├── lib/                       # Server libraries
│   │   ├── supabase.js            # Service-role client, all query helpers, tenant middleware
│   │   ├── claude.js              # Claude API client with tool_use loop
│   │   ├── elevenlabs.js          # ElevenLabs TTS (briefing + podcast generation)
│   │   └── rag.js                 # Text chunking, embedding, similarity search
│   ├── middleware/
│   │   └── sandboxAuth.js         # Token validation, tenant isolation
│   └── tools/                     # Claude tool_use definitions
│       ├── search-prospects.js
│       ├── draft-outreach.js
│       ├── analyze-pipeline.js
│       └── index.js               # Tool registry
├── supabase/                      # Database
│   ├── migrations/                # 6 SQL migration files
│   │   ├── 20260212_solo_sales_tables.sql    # Core 9 tables
│   │   ├── 20260213_deal_rooms.sql           # Deal rooms + sources + messages
│   │   ├── 20260214_deal_room_artifacts.sql  # Artifact storage
│   │   └── 20260218_deal_room_audio.sql      # Audio records
│   └── seed.sql                   # Mel Wallace sandbox data (113 records)
├── docs/                          # Documentation
│   ├── SPRINT_STATUS.md           # Living sprint document
│   ├── DEPLOY_CHECKLIST.md        # Railway deployment guide
│   └── specs/                     # Feature specs, prompts
├── Dockerfile                     # Multi-stage Node 20 alpine
├── railway.toml                   # Railway deployment config
└── CLAUDE.md                      # This file
```

## API Routes

### Public
- `GET  /api/health` — Health check (version, environment)
- `POST /api/auth/validate` — Validate sandbox token, return tenant info

### Protected (require sandbox token)
- `POST /api/ask-plexi/chat` — Claude AI chat with tool_use
- `GET  /api/usage-events` — Agent activity feed
- `POST /api/deal-rooms` — Create deal room
- `GET  /api/deal-rooms` — List deal rooms
- `GET  /api/deal-rooms/:id` — Get deal room with sources + messages
- `POST /api/deal-rooms/:id/sources` — Upload source document (multipart)
- `DELETE /api/deal-rooms/:id/sources/:sourceId` — Delete source
- `POST /api/deal-rooms/:id/chat` — RAG-grounded chat
- `POST /api/deal-rooms/:id/artifacts` — Generate artifact (Claude)
- `GET  /api/deal-rooms/:id/artifacts` — List artifacts
- `POST /api/deal-rooms/:id/audio` — Generate audio briefing/podcast (Claude + ElevenLabs)
- `GET  /api/deal-rooms/:id/audio` — List audio records
- `GET  /api/deal-rooms/:id/audio/:audioId/stream` — Stream audio (Range support)

## Database Schema (11 tables)
- `tenants` — Sandbox accounts with token auth, features JSONB, expires_at
- `prospects` — 47 NYC AEC projects with warmth_score, stage, gc_slug
- `contacts` — 47 contacts linked to prospects
- `connections` — 8 connection records
- `case_studies` — 10 case studies for outreach
- `icp_configs` — Ideal customer profile config
- `conversations` — Ask Plexi conversation history
- `outreach_drafts` — Generated outreach emails
- `usage_events` — Auth + activity logging
- `deal_rooms` — Deal rooms with name, description, status
- `deal_room_sources` — Uploaded documents (storage_path, chunks JSONB)
- `deal_room_messages` — RAG chat messages with citations
- `deal_room_artifacts` — Generated artifacts (content JSONB, status)
- `deal_room_audio` — Audio briefings + podcasts (storage_path, script, status)

All tables: UUID primary keys, tenant_id FK, RLS enabled, service-role full access.

## Key Patterns
- API routes: `server/routes/[resource].js` → REST conventions
- Vite dev middleware: `src/server/[resource]Api.ts` wraps server routes for Vite dev
- React components: PascalCase files, functional components + hooks only
- Supabase queries: Always filter by `tenant_id` for RLS enforcement
- Claude tool_use: Tools defined in `server/tools/`, registered in route handler
- Lazy client init: Claude, Supabase, ElevenLabs clients initialized on first use (Vite env timing)
- Auth: SandboxContext provides token via `useSandbox()` hook; API calls use `Authorization: Bearer ${token}`
- Error handling: Try/catch in routes, user-friendly messages, log details server-side
- Dark theme: `bg-gray-900 via-blue-900` gradients, `bg-gray-800/40` panels, `border-gray-700/40` borders
- Environment variables: `.env.local` (never committed), validated at startup
- CSS: TailwindCSS utility classes, no custom CSS files unless unavoidable
- File storage: Supabase Storage `deal-room-files` bucket, blob URL pattern for auth'd playback

## Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (full access) |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude |
| `ELEVENLABS_API_KEY` | No | ElevenLabs API key for audio briefings + podcasts |
| `NODE_ENV` | Yes (prod) | Set to `production` for Railway |
| `PORT` | No | Railway sets automatically |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins |

Also requires `VITE_` prefixed versions of Supabase vars for frontend build.

## Specifications (read when relevant)
@docs/SPRINT_STATUS.md
@docs/DEPLOY_CHECKLIST.md
@docs/HANDOFF_SESSION11_COMPLETE.md

## Safety Rules (NON-NEGOTIABLE)

### Before ANY code changes:
1. State what you intend to change and why
2. Wait for my explicit approval
3. Never force push, never delete branches

### Branch discipline:
- Feature work: `feature/[description]`
- Backups before risky ops: `backup/[description]-[date]`
- PRs required for merging to develop

### NEVER do:
- Delete functionality without approval
- Modify .env files or commit secrets
- Push directly to develop or main
- Run destructive operations
- Install packages without stating why first

## Known Technical Debt (Don't Fix Without Asking)
- @ts-nocheck in App.tsx — needs careful migration
- 85+ console.log statements — cleanup later
- `as any` casts — address incrementally
- Backup files in repo (App.tsx.backup, index_backup.css, NavigationSidebar_backup.tsx) — cleanup later
- BID-era scaffolding in src/server/ (ttsService.ts, ttsApi.ts, elevenLabsService.ts, podcastApi.ts) — unused, don't touch
- Large bundle (4.6MB) — code-split when performance becomes a concern
- OpenAI references in some chat routes — migrated to Claude API but traces remain

## Known Issues
- PDF upload: `createRequire` fix via lazy import of pdf-parse (works but fragile)
- Citations show "Chunk 0" on small single-chunk documents
- ElevenLabs free tier character limits — monitor usage
- Supabase Storage bucket must have `audio/mpeg` in allowed MIME types

## Current Sprint Status
Sessions 1-11 complete. Mel sandbox live and functional.
See @docs/SPRINT_STATUS.md for full breakdown.

## Communication Style
- Be direct, not verbose
- Tables for comparisons
- Never use: delve, leverage, seamless, transformative
- Hit a blocker? Tell me immediately
- Uncertain? Propose 2-3 options, let me choose
