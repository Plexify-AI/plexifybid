# Sprint F — Handoff from Sprint E

Items Sprint E intentionally deferred. Each is written so a fresh session can pick it up without rereading the Sprint E thread.

## 1. War Room Prep idempotency — upgrade to partial unique index

**Sprint E shape:** app-layer check in `server/workers/war_room_prep.mjs → alreadyRanForRoom()` via `.filter('input->>deal_room_id', 'eq', dealRoomId)` before inserting the job row.

**Race condition:** two concurrent Deal Room creations for the same `deal_room_id` can both pass the check and both insert `war_room_prep` jobs, causing duplicate artifacts and doubled cost.

**Sprint F fix:**
```sql
CREATE UNIQUE INDEX IF NOT EXISTS jobs_war_room_prep_per_deal_room_unique
  ON public.jobs ((input->>'deal_room_id'))
  WHERE kind = 'war_room_prep' AND status IN ('queued','running','succeeded');
```
Then drop the app-layer `alreadyRanForRoom()` guard and catch the unique-violation error in `startJob()`, translating it to a friendly "already ran" message.

**Trigger:** only if pilot data shows any duplicate War Room Prep runs. Flag in pilot review.

## 2. Full IRS OZ CSV hydration

**Sprint E shape:** `server/data/oz_tracts_seed.mjs` ships ~20 real OZ tracts for demo surface. `server/data/oz_tracts.mjs.isOzDesignated()` falls back to `{ known: false }` for everything else.

**Sprint F fix:** place the full IRS CSV at `server/data/oz_tracts_2018.csv.gz` (~8,764 rows, ~100KB). Add a `scripts/hydrate_oz_tracts.mjs` that streams the CSV into `oz_tracts_cache`. One-time admin run.

## 3. BID address → tract resolver

**Sprint E shape:** `lookupByAddress(address)` returns `{ known: false, reason: 'address-lookup-not-implemented' }`.

**Sprint F fix:** integrate a geocoder (Census Geocoder API is free + authoritative). Returns tract GEOID from a street address.

## 4. Census API key

**Sprint E shape:** anonymous (~500/day per IP). Permanent cache mitigates but won't scale.

**Sprint F fix:** request a free key at https://api.census.gov/data/key_signup.html. Add `CENSUS_API_KEY` to `.env.local`. Code already reads it opportunistically via `process.env.CENSUS_API_KEY`.

## 5. Strategy output scroll UX polish

**Sprint E shape:** E3 capped expanded output at 50vh with internal scroll (commit `35a304c`). Ken noted this is acceptable but the UX could be more polished (e.g., modal overlay instead of inline panel).

**Sprint F fix:** evaluate during UI polish pass. Options: keep inline + add smooth scroll-into-view on run, OR switch to a side-drawer / modal overlay.

## 6. Real prospect eval data for all 7 strategy skills + 3 workers

**Sprint E shape:** eval files are stubs (`server/skills/evals/*.jsonl` + future `server/agents/evals/` for workers). Ken said he'd hand-pick prospects before Sprint F.

**Sprint F ask:** 2-3 entries per skill and per worker, with known-good expected outputs. Used as regression tests when skill/agent prompts change.

## 7. External MCPs for workers

**Sprint E scope:** Supabase read + `agent_toolset_20260401` (includes web_search). No external MCPs.

**Sprint F plan:** wire HubSpot MCP (Pipeline Analyst enrichment), Outlook/M365 MCP (Pipeline Analyst + War Room Prep document discovery), SAM.gov MCP (Research Scanner for federal opportunities), SharePoint MCP (War Room Prep past-performance retrieval).

## 8. Managed Agents model pin

**Sprint E shape:** all three agents use `claude-sonnet-4-5` (what Managed Agents supports today).

**Sprint F fix:** when Managed Agents enables `claude-sonnet-4-6` / `claude-opus-4-7`, revisit per-worker model selection. Research Scanner likely benefits from Opus tier for synthesis; Pipeline Analyst is fine on Sonnet.

## 9. Factual Auditor + Compliance Guard (E5)

Separate task — not a handoff, but flagging that E5 depends on all of the above being stable. Do not ship E5 until E4 has run clean for at least one pilot week.

## 10. Tenant-specific behavior now lives in three places

**Sprint E shape:** per-tenant customization accumulated across three different storage surfaces:
- `tenants.preferences` JSONB — email signature, price list, price_note, default_closing, and now `custom_lead_fields` (Ben's Xencelabs ICP mappings)
- `tenants.metro_tier` + `tenants.default_skill_set` — E1 additions for star_hub/emerging_center/regional tiering and skill scoping (logic unshipped, schema-only)
- `deal_room_skills` with `tenant_id IS NOT NULL` — tenant-override skills (E2-registry pattern, none shipped yet but the lookup path exists)

**Not a problem today.** All three are real uses with real boundaries. The risk is fragmentation: a fourth need lands, someone picks a fourth surface, and six months later nobody remembers where to look.

**Sprint F consolidation candidate.** Once another tenant-specific need appears, pick the two dominant surfaces and migrate the third. Likely winners: `tenants.preferences` for per-tenant config-as-code, `deal_room_skills` for per-tenant prompt/schema overrides. `metro_tier` stays as top-level columns since they're filter-critical.

## 11. Cross-platform env var loading

**Sprint E discovery:** on Windows + Vite, non-VITE_-prefixed env vars aren't always populated reliably. Agent seed + Managed Agents runtime both fall back to `VITE_ANTHROPIC_API_KEY` and trim trailing `\r` from CRLF line endings. Codified in both `server/agents/seed.mjs` and `server/runtimes/managed_agents.mjs`.

**Sprint F fix:** audit all other env reads across the codebase (there are ~40 grep hits on `process.env.`) and normalize to one helper: `server/lib/env.mjs` `getEnv(name)` with automatic VITE_ fallback + CR trim. Low-priority but removes a class of cross-platform bugs.
