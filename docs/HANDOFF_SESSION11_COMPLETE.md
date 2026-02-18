# PlexifySOLO Development Handoff — Sessions 1-11 Complete

Last updated: 2026-02-18

## Quick Start for Next Chat

Paste this into your next Claude Code session:

```
Continue building PlexifySOLO. Read CLAUDE.md first, then docs/SPRINT_STATUS.md
for full context. Sessions 1-11 are complete. The app is live on Railway at
https://plexifybid-production.up.railway.app with sandbox auth, Ask Plexi AI chat,
Deal Room (document upload, RAG chat, artifact generation, PDF export, audio
briefings + podcasts). All code is on main branch. Start with `npm run dev` to
verify the dev server works, then check SPRINT_STATUS.md for next steps.
```

## What Was Accomplished (Sessions 1-11)

| Session | Feature | Commit | Key Files |
|---------|---------|--------|-----------|
| 1 | Fork + Rebrand + Docker | `f2a1564` | Dockerfile, server/index.mjs, package.json |
| 2 | Supabase Schema + Seed | `39afada` | supabase/migrations/20260212*.sql, seed.sql, server/lib/supabase.js |
| 3 | Claude API + AEC Tools | `25d9f20` | server/routes/ask-plexi.js, server/tools/*.js, server/lib/claude.js |
| 4 | Sandbox Auth | `99fab49` | server/middleware/sandboxAuth.js, src/contexts/SandboxContext.tsx |
| 5 | Railway Deploy | `ea6bfbf` | railway.toml, docs/DEPLOY_CHECKLIST.md |
| 6 | UX Polish | `e0a5721` | AskPlexiInterface.tsx, ProspectCard.tsx |
| 7 | Structured Responses | `0c35cea` | OutreachPreview.tsx, PipelineAnalysis.tsx |
| 8 | PlexiCoS Agents | `969a3b1` | src/pages/PlexiCosAgentsPage.tsx |
| 9 | Deal Room Core | `5a593d9` | server/routes/deal-rooms.js, server/lib/rag.js, DealRoomPage.tsx |
| 10 | Deal Room Artifacts | `b1e1d4d` | src/types/artifacts.ts, src/components/artifacts/*.tsx |
| 11 | Deal Room Audio | `1cba74f` | server/lib/elevenlabs.js, AudioBriefingPlayer.tsx |

## Current System Architecture

```
                    ┌─────────────────┐
                    │   Railway.app   │
                    │   (Docker)      │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼──────┐ ┌────▼─────┐ ┌─────▼──────┐
     │ Express Server │ │ Vite Dist│ │   SPA      │
     │ (index.mjs)   │ │ (static) │ │ (React)    │
     └──────┬─┬──────┘ └──────────┘ └────────────┘
            │ │
   ┌────────┘ └──────────────┐
   │                         │
┌──▼──────────┐   ┌─────────▼──────────┐
│  Supabase   │   │   External APIs    │
│  PostgreSQL │   │                    │
│  Storage    │   │  Claude (Anthropic)│
│  RLS        │   │  ElevenLabs (TTS)  │
└─────────────┘   └────────────────────┘
```

- **Frontend:** React 18 + Vite 5 + TailwindCSS + TypeScript
- **Backend:** Express 5 + Supabase (PostgreSQL + Storage + RLS)
- **AI:** Claude API (claude-sonnet-4-20250514) with tool_use + ElevenLabs (eleven_turbo_v2)
- **Deploy:** Railway + Docker, auto-deploy from GitHub main
- **Domain:** solo.plexifyai.com → https://plexifybid-production.up.railway.app
- **Auth:** Token-based sandbox with tenant isolation (React state only, no cookies)

## Key Files and Directories

### Backend (server/)
```
server/
├── index.mjs                    # Production Express server (all routes wired here)
├── routes/
│   ├── ask-plexi.js             # Claude AI chat with tool_use loop
│   ├── deal-rooms.js            # Deal Room CRUD, upload, RAG chat, artifacts, audio
│   ├── auth.js                  # Token validation endpoint
│   └── usage-events.js          # Activity feed
├── lib/
│   ├── supabase.js              # Service-role client + ALL query helpers (40+ functions)
│   ├── claude.js                # Claude client with tool dispatch loop
│   ├── elevenlabs.js            # ElevenLabs TTS: briefing + podcast generation
│   └── rag.js                   # Text chunking, embedding, similarity search
├── middleware/
│   └── sandboxAuth.js           # Token extraction + tenant validation
└── tools/
    ├── search-prospects.js      # Search 47 NYC AEC prospects
    ├── draft-outreach.js        # Generate personalized outreach emails
    ├── analyze-pipeline.js      # Pipeline analysis with win probability
    └── index.js                 # Tool registry
```

### Frontend (src/)
```
src/
├── App.tsx                      # Route definitions (has @ts-nocheck)
├── main.tsx                     # React entry point
├── index.css                    # Global styles + Tailwind
├── components/
│   ├── AskPlexiInterface.tsx    # AI chat UI with tool badges
│   ├── AudioBriefingPlayer.tsx  # Custom HTML5 audio player
│   ├── DealRoomSourceCard.tsx   # Source document card
│   ├── NavigationSidebar.tsx    # Main sidebar navigation
│   ├── ProspectCard.tsx         # Prospect display card
│   ├── OutreachPreview.tsx      # Email preview component
│   ├── PipelineAnalysis.tsx     # Pipeline chart component
│   └── artifacts/
│       ├── DealSummaryRenderer.tsx
│       ├── CompetitiveAnalysisRenderer.tsx
│       ├── MeetingPrepRenderer.tsx
│       └── ArtifactPDFDocument.tsx  # PDF export via @react-pdf/renderer
├── pages/
│   ├── DealRoomPage.tsx         # Two-panel Deal Room (sources + chat/artifacts/audio)
│   ├── DealRoomListPage.tsx     # Deal Room listing with create dialog
│   ├── PlexiCosAgentsPage.tsx   # Agent registry page
│   ├── SandboxEntry.tsx         # /sandbox?token= auth entry
│   └── AccessRequired.tsx       # Auth fallback page
├── contexts/
│   └── SandboxContext.tsx       # Token auth state (useSandbox hook)
├── types/
│   └── artifacts.ts             # ArtifactEnvelope<T>, output types, ARTIFACT_CHIPS
├── server/                      # Vite dev middleware wrappers
│   ├── askPlexiApi.ts
│   ├── dealRoomsApi.ts          # Routes: CRUD, sources, chat, artifacts, audio, stream
│   ├── authApi.ts
│   └── usageEventsApi.ts
└── features/
    ├── executive/ExecutiveFeed.tsx  # Home page
    ├── mel-demo/                   # Original demo (DemoEngine, mock data)
    └── agent-management/           # Agent registry + sessions
```

### Database Migrations
```
supabase/migrations/
├── 20260212_solo_sales_tables.sql     # tenants, prospects, contacts, connections,
│                                       # case_studies, icp_configs, conversations,
│                                       # outreach_drafts, usage_events
├── 20260213_deal_rooms.sql            # deal_rooms, deal_room_sources, deal_room_messages
├── 20260214_deal_room_artifacts.sql   # deal_room_artifacts
└── 20260218_deal_room_audio.sql       # deal_room_audio
```

## Database Schema

| Table | Records | Purpose |
|-------|---------|---------|
| `tenants` | 1 (Mel Wallace) | Sandbox accounts, token auth, features, expiry |
| `prospects` | 47 | NYC AEC projects with warmth_score, stage, value |
| `contacts` | 47 | People linked to prospects |
| `connections` | 8 | Relationship mapping |
| `case_studies` | 10 | Win stories for outreach |
| `icp_configs` | 1 | Ideal customer profile |
| `conversations` | dynamic | Ask Plexi chat history |
| `outreach_drafts` | dynamic | Generated emails |
| `usage_events` | dynamic | Auth + activity logging |
| `deal_rooms` | dynamic | Deal workspaces |
| `deal_room_sources` | dynamic | Uploaded documents (storage_path, chunks JSONB) |
| `deal_room_messages` | dynamic | RAG chat with citations |
| `deal_room_artifacts` | dynamic | Generated artifacts (content JSONB) |
| `deal_room_audio` | dynamic | Audio files (storage_path, script, podcast_script JSONB) |

All tables: UUID PKs, tenant_id FK, RLS enabled, `set_updated_at()` triggers.

**Supabase Storage:** `deal-room-files` bucket with audio/mpeg + document MIME types.

## Environment Variables Required

### Railway Service Variables (14)
| Variable | Required | Example |
|----------|----------|---------|
| `SUPABASE_URL` | Yes | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Yes | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | `eyJ...` |
| `ANTHROPIC_API_KEY` | Yes | `sk-ant-...` |
| `ELEVENLABS_API_KEY` | No | `sk_...` |
| `NODE_ENV` | Yes | `production` |
| `ALLOWED_ORIGINS` | No | `https://plexifybid-production.up.railway.app` |
| `PROCORE_CLIENT_ID` | No | Future |
| `PROCORE_CLIENT_SECRET` | No | Future |
| `VITE_ANTHROPIC_API_KEY` | Yes | Same as ANTHROPIC_API_KEY |
| `VITE_APP_NAME` | Yes | `PlexifySOLO` |
| `VITE_APP_DESCRIPTION` | Yes | `AI-powered sales intelligence` |
| `VITE_SUPABASE_URL` | Yes | Same as SUPABASE_URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Same as SUPABASE_ANON_KEY |

### Local Dev (.env.local)
Same keys without VITE_ prefix variants (Vite auto-loads from .env.local).

## Known Issues

| Issue | Impact | Workaround |
|-------|--------|------------|
| pdf-parse `createRequire` | Crashes on import in Vite | Lazy import via dynamic `import()` |
| Citations show "Chunk 0" | Cosmetic on small docs | Only affects single-chunk files |
| ElevenLabs free tier limits | Audio generation may fail | Monitor character usage |
| Supabase Storage MIME types | Audio upload fails without config | Manually add `audio/mpeg` to bucket |
| Large bundle (4.6MB) | Slow initial load | Code-split in future session |
| BID-era unused files | Clutter in src/server/ | Don't touch — cleanup session later |
| @ts-nocheck in App.tsx | No type checking on routes | Careful migration needed |

## Next Phase Goals

### Immediate
1. **Republic Events Australia** — Demo prep for Thursday meeting
2. **Send Mel sandbox URL** — Email with login instructions + Deal Room walkthrough
3. **Gather Mel feedback** — First real user testing

### Session 12+
4. **My SalesPlex Flow page** — Sales process workflow visualization
5. **Home dashboard improvements** — Activity feed, quick actions, metrics
6. **Mobile responsive pass** — Sidebar collapse, touch-friendly controls
7. **Streaming responses** — SSE for Ask Plexi and Deal Room chat
8. **Procore integration** — OAuth flow, project sync
9. **Stripe billing** — Self-serve for post-pilot customers

### Long-term
10. **SOC 2 prep** — AWS migration when Hexagon requires it
11. **Multi-tenant** — Beyond sandbox, proper user accounts
12. **Code splitting** — Dynamic imports for bundle size

## Backup Branches
- `backup/pre-deal-room` — Sessions 1-8 state (before Deal Room)
- `backup/pre-plexifyken-20260117` — Original PlexifyBID state
- `main` — Current production (Session 11, commit 1cba74f)

## Git Tags
- `v0.1.0-demo-ready` — Original BID stable demo
- `v0.2.0-mel-demo` — Mel Demo Live Prospecting Agent (Feb 2026)
