# CLAUDE.md - PlexifyBID Repository Rules

## Who I Am
Ken, solo founder of Plexify AI. I coordinate development across:
- Claude Sonnet: Strategy, specs, prompts
- Code Droid (Factory.ai): Frontend implementation
- Claude Code: Backend development, architecture
- GitHub Desktop + VSCode: Local development

## Repository Architecture
This is NOT a traditional frontend/backend split. The app runs as React + Vite with backend middleware embedded in Vite's dev server.

### Backend Routes (Vite middleware):
- /api/agents/<id> — Claude-powered analysis
- /api/tts/generate — OpenAI text-to-speech
- /api/podcast/generate — ElevenLabs synthesis
- /api/export/docx — Word document export

## Current State
- Stable tag: v0.1.0-demo-ready
- Active branch: develop
- Backend readiness: ~40% (works for demos, not production)
- Known gaps: No database, no auth, no rate limiting, no tests

## Safety Rules (NON-NEGOTIABLE)

### Before ANY code changes:
1. State what you intend to change and why
2. Wait for my explicit approval
3. Never force push, never delete branches

### Branch discipline:
- Feature work: feature/[description]
- Backups before risky ops: backup/[description]-[date]
- PRs required for merging to develop

### NEVER do:
- Delete functionality without approval
- Modify .env files or commit secrets
- Push directly to develop or main
- Run destructive operations
- Install packages without stating why

## Known Technical Debt (Don't Fix Without Asking)
- @ts-nocheck in App.tsx — needs careful migration
- 85+ console.log statements — cleanup later
- as any casts — address incrementally
- Backup files in repo — cleanup later

## Current Priorities
1. Backend stability for pilot demos
2. NotebookBD RAG pipeline reliability
3. API error handling improvements
4. Security hardening (auth, rate limiting)

## Communication Style
- Be direct, not verbose
- Tables for comparisons
- Never use: delve, leverage, seamless, transformative
- Hit a blocker? Tell me immediately
- Uncertain? Propose 2-3 options, let me choose
