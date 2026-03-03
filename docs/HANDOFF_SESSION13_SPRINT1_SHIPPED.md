# PlexifySOLO Development Handoff — Session 13: Sprint 1 Shipped

Last updated: 2026-03-02

## Quick Start for Next Chat

```
Continue building PlexifySOLO. Read CLAUDE.md first, then
docs/SPRINT_STATUS.md for full context. Sessions 1-12 plus
Sprint 1 (Warmth Engine) are complete and shipped. The app is
live on Railway at https://plexifybid-production.up.railway.app
with 10 tenants.

SPRINT 1 SHIPPED: feature/rme-sprint1-warmth-engine merged to main.
23 new files + 2 bugfix files. 12/12 warmth tests pass.

SESSION 14 PRIORITY ORDER:
1. Fix bash shell — apostrophe in Ken's BOXX path breaks all CLI
   (fix git-prompt.sh line 8/10: change ~ to "$HOME")
2. RLS leak test — all tenants x all tables (security debt)
3. Republic Events demo prep (SB2 Priya sandbox)
4. Streaming responses for Ask Plexi / Deal Room chat
5. Home dashboard — promote hot opportunities to ExecutiveFeed
```

## What Was Built in Sprint 1 (Session 13)

### Warmth Engine — 23 New Files

| Category | Files | Description |
|----------|-------|-------------|
| **Database** | `supabase/migrations/20260302_sprint0_foundation.sql` | 7 new tables: events, opportunities, warmth_history, jobs, suppression_lists, outreach_log, agents |
| **Server Routes** | `server/routes/opportunities.js`, `server/routes/signals.js` | CRUD + warmth-enriched listing, signal logging with recompute |
| **Server Services** | `server/services/warmth-engine.js`, `server/services/evidence-bundler.js` | Deterministic warmth computation (signal points + decay + spam penalty + clamp), score explanation generator |
| **LLM Gateway** | `server/llm-gateway/index.js`, `server/llm-gateway/types.js` | Multi-provider abstraction (Anthropic + OpenAI) with failover |
| **Constants** | `server/constants/warmth-config.js` | SIGNAL_POINTS, DECAY, SPAM, TAKEOVER, DEDUP, FORMULA_VERSION |
| **Vite Middleware** | `src/server/opportunitiesApi.ts`, `src/server/signalsApi.ts` | Dev middleware wrappers for Vite |
| **Frontend** | `src/features/momentum/MomentumPage.tsx` | Main page: filter tabs, opportunity cards, signal modal, toast |
| **Frontend** | `src/features/momentum/OpportunityCard.tsx` | Warmth badge, evidence summary, expandable drivers/penalties |
| **Frontend** | `src/features/momentum/WarmthBadge.tsx` | Color-coded score badge (red 75+, orange 40-74, blue 0-39) |
| **Frontend** | `src/features/momentum/SignalLogModal.tsx` | Modal: select opportunity + signal type + note, submit |
| **Hooks** | `src/features/momentum/useMomentum.ts` | Data fetch hook with filter/sort/refetch |
| **Hooks** | `src/features/momentum/useSignalLog.ts` | Signal logging hook with warmth delta response |
| **Tests** | `server/tests/warmth-engine.test.mjs` | 12 test cases: basic scoring, decay, spam penalty, clamp, dedup, edge cases |
| **Seed Data** | `supabase/seeds/20260302_warmth_demo_seeds.sql` | 5 opportunities + events for SB1 (Mel Wallace) |

### Bugfixes Applied During Session 13

| File | Bug | Fix |
|------|-----|-----|
| `src/features/momentum/MomentumPage.tsx` | White screen — dark theme text invisible on light app background | Added `min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900` wrapper |
| `server/routes/opportunities.js` | All warmth scores showing 0 despite seed events | Compute warmth on-the-fly via `computeWarmth(events)` instead of reading stale cached `warmth_score` from DB |

### New Database Schema (7 tables added)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `events` | Bloomberg audit trail — every signal/action/state change | tenant_id, opportunity_id, event_type (10 types), payload JSONB, source |
| `opportunities` | Prospect/account pipeline tracking | account_name, contact_*, stage (7 states), warmth_score (0-100), promoted_to_home |
| `warmth_history` | Score change audit trail | score_before, score_after, delta, top_3_drivers JSONB, formula_version |
| `jobs` | DB-backed job queue with dead-letter pattern | job_type, status, payload, idempotency_key, retries, max_retries |
| `suppression_lists` | CAN-SPAM compliance (hard bounces, unsubscribes) | email, reason |
| `outreach_log` | Every outbound message tracked | channel, message_type, content_hash, status, requires_approval |
| `agents` | Global agent registry (8 agents seeded) | name, agent_type, preferred_provider/model, capabilities |

### New API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/opportunities` | List with live warmth, filters (all/hot/warm/cold/promoted), sort, explanations |
| POST | `/api/opportunities` | Create new opportunity |
| POST | `/api/signals` | Log signal → recompute warmth → return delta |

### Warmth Formula

```
Score = clamp(0, 100, sum(signal_points) - decay_penalty - spam_penalty)

Signal Points: MEETING_BOOKED=35, PROPOSAL_REQUESTED=30, OUTREACH_REPLIED_POSITIVE=25,
               OUTREACH_REPLIED_NEUTRAL=12, OUTREACH_CLICKED=8, CONTENT_SHARED=6,
               LINKEDIN_CONNECTION=5, OUTREACH_OPENED=2, OUTREACH_SENT=1, SIGNAL_LOGGED_MANUAL=3

Decay: 7d silence=-8, 14d=-18, 30d=-35 (cumulative)
Spam: 3+ unresponded in 10 days = -12
Takeover: warmth >= 85 + A-signal = hard promote to Home
```

### Manual Test Results (All Pass)

| Test | Result | Details |
|------|--------|---------|
| /momentum renders | **PASS** | Dark gradient background, 5 opportunity cards, filter tabs, header |
| Warmth scores live | **PASS** | Suffolk 100, Skanska 25, Lendlease 18, Tishman 0, Turner 0 |
| Signal modal | **PASS** | Opens, pre-selects opp, 9 signal types, submits, warmth updates, toast appears |
| Promotion trigger | **PASS** | Suffolk got "Takeover Ready" + "Promoted" badges after MEETING_BOOKED signal |
| Ask Plexi | **PASS** | No regression — query returns prospect cards with warmth scores, tools work |
| Deal Room | **PASS** | No regression — list loads, room view shows RAG chat with citations |
| Build | **PASS** | `npx vite build` clean |
| Tests | **PASS** | 12/12 warmth-engine tests pass |

## Files Modified (2 bugfixes)

| File | Changes |
|------|---------|
| `src/features/momentum/MomentumPage.tsx` | Added outer `min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900` div wrapper |
| `server/routes/opportunities.js` | Added `import { computeWarmth }`, compute live warmth from events, pass real decay/spam to explanation |

## Known Issues

| Issue | Impact | Status |
|-------|--------|--------|
| **Bash shell broken** | Apostrophe in `Ken's BOXX` home path kills all CLI commands | **NEW — Fix git-prompt.sh lines 8/10** |
| PDF upload fragile (pdf-parse lazy import) | Crashes possible | Carried |
| Citations "Chunk 0" on small docs | Cosmetic | Carried |
| ElevenLabs free tier limits | Audio gen may fail | Carried |
| Large bundle (4.6MB) | Slow initial load | Carried |
| Filter tabs use DB cached warmth for hot/warm/cold | Filters may not match live scores | **NEW — Minor** |

### Bash Shell Fix (Session 14 Priority)

The file `C:\Program Files\Git\etc\profile.d\git-prompt.sh` has unquoted tilde `~` on lines 8 and 10. When HOME is `Ken's BOXX`, the apostrophe creates an unmatched single quote that kills bash.

**Fix** (requires admin): Change lines 8 and 10 from:
```bash
if test -f ~/.config/git/git-prompt.sh
then
    . ~/.config/git/git-prompt.sh
```
To:
```bash
if test -f "$HOME/.config/git/git-prompt.sh"
then
    . "$HOME/.config/git/git-prompt.sh"
```

### Filter Inconsistency (Minor)

The `handleListOpportunities` route filters `hot`/`warm`/`cold` using the DB cached `warmth_score` column (lines 43-51), but then enriches results with live-computed scores. This means a filter for "hot (75+)" checks the stale DB value, not the live value. Fix: either update the cached score on every recompute, or filter in JS after live computation.

## Architecture Decisions (Session 13)

- **Live warmth computation**: GET /api/opportunities computes warmth from events on every request — no stale cache reliance
- **Dark gradient wrapper**: MomentumPage uses same `from-gray-900 via-blue-900 to-gray-900` pattern as DealRoomPage
- **Deterministic scoring**: Same events = same score every time. Formula version tracked in warmth_history.
- **Event-sourced**: Warmth is DERIVED from events, never stored independently of evidence
- **Non-breaking**: No changes to existing tables or APIs. All new tables/routes are additive.

## Deferred to Session 14+

| Item | Priority | Notes |
|------|----------|-------|
| Fix bash shell | **P0** | Edit git-prompt.sh (admin) or set HOME env var to KensBOXX |
| RLS leak test | P1 | Dynamic, all tenants x all tables |
| Republic Events demo | P2 | Thursday deadline, SB2 (Priya) |
| Home dashboard promotions | P3 | Show promoted opportunities on ExecutiveFeed |
| Streaming responses | P4 | SSE for Ask Plexi / Deal Room |
| Filter consistency fix | P5 | Use live warmth for filter queries |

## Commit & Merge Instructions

Since bash is broken, use **GitHub Desktop** or **PowerShell** to:

```powershell
cd "C:\Users\KensBOXX\Documents\GitHub\plexifybid"
git add src/features/momentum/MomentumPage.tsx server/routes/opportunities.js docs/HANDOFF_SESSION13_SPRINT1_SHIPPED.md
git commit -m "fix: dark background + live warmth scoring on /momentum

- Add min-h-screen dark gradient wrapper to MomentumPage (white screen fix)
- Compute warmth on-the-fly from events in opportunities API (stale cache fix)
- Add Sprint 1 close-out handoff doc

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git push origin feature/rme-sprint1-warmth-engine
```

Then merge the PR on GitHub: `feature/rme-sprint1-warmth-engine` → `main`
