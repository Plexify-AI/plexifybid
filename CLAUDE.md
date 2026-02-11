# CLAUDE.md — PlexifySOLO

Solo founder project. Ask before changing anything. Read Safety Rules first.

## Commands
- `npm run dev` — Start Vite dev server (port 5173)
- `npm run build` — Production build (Vite)
- `npm run preview` — Preview production build locally
- `npm test` — Run tests (when test suite exists)
- `docker build -t plexifysolo .` — Build Docker image
- `docker-compose up` — Run full stack locally (app + Supabase)
- `npx supabase db push` — Apply migrations to Supabase

## Tech Stack
- React 18 + Vite 5 + TypeScript
- TailwindCSS for styling
- Express middleware (embedded in Vite dev, standalone in production)
- Supabase (PostgreSQL + Auth + RLS)
- Anthropic Claude API (claude-sonnet-4-20250514) for AI features
- Node 20 LTS, npm (not yarn/pnpm)

## Directory Structure
```
├── src/                    # React frontend
│   ├── components/         # Reusable UI components
│   ├── pages/              # Route-level page components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilities, API client, types
│   └── assets/             # Static assets
├── server/                 # Express backend
│   ├── routes/             # API route handlers
│   ├── middleware/          # Auth, guardrails, logging, rate limiting
│   ├── lib/                # Supabase client, Claude client, helpers
│   └── tools/              # Claude tool_use definitions for Ask Plexi
├── supabase/               # Database
│   ├── migrations/         # SQL migration files (numbered)
│   └── seed.sql            # Seed data for sandbox tenants
├── docker/                 # Dockerfile, docker-compose.yml
├── docs/                   # Specs, handoffs, sprint status
│   └── SPRINT_STATUS.md    # Living sprint document (update every session)
└── CLAUDE.md               # This file
```

## Key Patterns
- API routes: `server/routes/[resource].js` → REST conventions
- React components: PascalCase files, functional components + hooks only
- Supabase queries: Always filter by `tenant_id` for RLS enforcement
- Claude tool_use: Tools defined in `server/tools/`, registered in route handler
- Error handling: Try/catch in routes, user-friendly messages, log details server-side
- Environment variables: `.env.local` (never committed), validated at startup
- CSS: TailwindCSS utility classes, no custom CSS files unless unavoidable
- Imports: Use path aliases (`@/components`, `@/lib`) when configured

## Specifications (read when relevant)
@docs/SPRINT_STATUS.md
@docs/handoff-mel-demo.md
@docs/supabase-schema.md

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
- Backup files in repo — cleanup later
- OpenAI references in chat routes — migrating to Claude API

## Current Sprint
Goal: Ship Mel Wallace sandbox by Feb 17
See @docs/SPRINT_STATUS.md for task breakdown.

## Communication Style
- Be direct, not verbose
- Tables for comparisons
- Never use: delve, leverage, seamless, transformative
- Hit a blocker? Tell me immediately
- Uncertain? Propose 2-3 options, let me choose
