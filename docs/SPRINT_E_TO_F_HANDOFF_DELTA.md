# Sprint E → F Handoff Delta

**Addendum to the April 20 handoff — the April 20 document remains canonical. This delta captures the 24-hour bug-chain closure and Sprint F scope clarification that followed.**

Date: 2026-04-21
Author: Claude Code (under Ken's direction)
Supersedes: nothing — read alongside the April 20 handoff.

---

## 1. TL;DR

The AskPlexi campaign-filter bug chain opened on April 20 and closed on April 21. Ben's SunnAx session now returns the correct 10 post-show Tennessee leads for the query "Provide me the top 10 leads post-Animation Yall for an email outreach campaign," with Alina Negrila (Homeschooler / Graphic Designer–Comics) flagged HIGH VALUE as the only working creative professional in the 122-row post-show cohort — the signature outcome Ben's CMDA pitch needs.

Deferred to Sprint F: a unified architectural refactor covering the 1000-row Supabase default cap, the post-fetch filter intersection with structured filters, and temporal-query routing. These three symptoms share one root cause and should be addressed as a single coordinated Sprint F work item rather than three separate ones. PR #47's Railway build-failure logs remain pending review as tooling hygiene.

---

## 2. What Shipped April 20 Evening → April 21 Afternoon

| Layer | PR | Commit SHA on main | Description | Verified by |
|---|---|---|---|---|
| L1 / L2 / L3 | [#45](https://github.com/Plexify-AI/plexifybid/pull/45) | `6d17b03` | `source_campaign` schema exposure on `search_opportunities` + Layer 4 ACTIVE CAMPAIGNS injection (paginated via new `getCampaignCounts` helper) + SQL `.eq()` push-down before LIMIT | Node script against prod Supabase; Ben browser-verify surfaced Bug A/B |
| Fix A | [#47](https://github.com/Plexify-AI/plexifybid/pull/47) | `74c5bf2` | Skip keyword text filter when any structured filter (`source_campaign`/`industry`/`region`/`stage`/`warm_status`/`source`/`has_email`) is set. Unblocks 13→122 post-show count. | Node self-verify + Ben browser-verify Step 1/2 |
| B1 | #47 | `74c5bf2` | Add `'campaign'` to `analyze_opportunity_pipeline` `group_by` enum with case on `source_campaign`; distinguish `source` (import batch) from `campaign` (user-facing) in tool description | Node self-verify |
| B1.1 | #47 | `74c5bf2` | Paginated campaign counts via extended `getCampaignCounts({ includeNull: true })`. Surfaces zero-warmth campaigns (Animation Yall cohort) that otherwise fall outside the 1000-row warmth-DESC cap | Node self-verify (3552 rows total, exact match) |
| B2 — Option X | [#48](https://github.com/Plexify-AI/plexifybid/pull/48) | `462206e` | Hardened `analyze_opportunity_pipeline` tool description with IMPORTANT directive: always `group_by='campaign'` for campaign questions, never `'source'` | Ben browser-verify Step 3 |
| B2 — Option Y | #48 | `462206e` | Added campaign-routing directive to `DEFAULT_SYSTEM_PROMPT`: campaign questions → `analyze_opportunity_pipeline` with `group_by='campaign'`; per-prospect lookups → `search_opportunities` with `filters.source_campaign` | Ben browser-verify Steps 1/2/3 + non-regressions |
| Option Q | [#49](https://github.com/Plexify-AI/plexifybid/pull/49) | `d6b27b7` | `-pre-show` / base-name naming convention hint injected into Layer 2 ACTIVE CAMPAIGNS block when the tenant's data actually contains the pattern. Reduces LLM ambiguity on "post-X" vs "pre-X" phrasing. Ken SOLO tenant correctly skips the block. | Node self-verify (Ben block present, Ken block absent) |
| Bundle-freshness workaround | — | — | Fresh sandbox link forced Ben's SPA to reload the post-#48 bundle and re-validate `SandboxContext`. Resolved a "looks pre-fix" false alarm that was entirely client-side stale cache. Codified as Lesson 40. | Ben's confirmation against the fresh link |

---

## 3. Ben's Demo-Ready State

SunnAx tenant (UUID `d49d21b2-d7a6-476e-b309-a23aec73ff7b`) post-fix:

- **3,552 total opportunities** across 4 distinct campaign values plus NULL.
- **Animation Yall TN 2026-04** (122 rows, post-show cohort) — correctly queryable by `filters.source_campaign` or by `group_by='campaign'`.
- **Animation Yall TN 2026-04-pre-show** (160 rows, pre-show cohort) — correctly queryable.
- **Yes** (1,167 rows, column-mapping bug cohort — out of scope, Sprint F cleanup).
- **No campaign** (2,103 rows — 1,585 March 18 NULLs + 514 Xencelabs GA + misc).
- **AskPlexi routes campaign questions deterministically** to `group_by='campaign'` via combined tool-description + system-prompt directive (Option Z).
- **Alina Negrila** (Homeschooler / Graphic Designer–Comics) flagged HIGH VALUE as the only working creative professional in the TN post-show cohort — the signature outcome for Ben's CMDA pitch. Surfaces consistently across the Top-10 post-show query.

The three browser-verify questions all pass on Ben's own session:

1. `Provide me the top 10 leads post-Animation Yall for an email outreach campaign` → 10 post-show TN rows with emails, single `search_opportunities` call.
2. `Top 10 prospects from campaign 'Animation Yall TN 2026-04' ranked by warmth score` → same cohort, different phrasing, same correct result.
3. `What campaigns do I have leads from?` → four real campaign names (not `sunnax_import` / `unknown`) via `analyze_opportunity_pipeline` with `group_by='campaign'`.

Non-regression: `Show me my pipeline by stage` still routes to `group_by='stage'` (directive correctly scoped).

---

## 4. Sprint F Architectural Bucket — Unified Scope

**Root cause.** AskPlexi's read path was never refactored after Sprint D added the lead-import columns (`source_campaign`, `source_type`, `lifecycle_stage`, `mql_date`). Three symptoms share this root:

1. **1000-row Supabase default cap** across `getOpportunities`-backed paths. `getOpportunities(tenantId, { limit: 2000 })` is silently truncated to 1000 rows by the Supabase client's default response cap. All tools fed by `getOpportunities` inherit the cap: `search_opportunities` (500-row slice → already capped before our layer), `analyze_opportunity_pipeline` (1000-row slice for all groupings except `campaign`, which now paginates via `getCampaignCounts`). Symptom: `with_email` / `with_linkedin` / `warm` / `avg_warmth` per campaign group are best-effort from the capped slice; only `count` is accurate for campaigns whose rows sit outside the cap.
2. **Post-fetch filter architecture.** Every filter on `search_opportunities` except `source_campaign` (which this sprint pushed into SQL) and the implicit `tenant_id` / `stage != 'ejected'` is applied as JavaScript `.filter()` on the already-fetched 500-row array. Filters never narrow the SQL query; they narrow what's already in memory. This composes as AND with the keyword text filter (Lesson 38) and silently truncates results for tenants where the target rows don't sit in the warmth-DESC top slice.
3. **Temporal routing gap (eval seed-2).** AskPlexi has no path to route "today" / "this week" / "recent" / "latest" to `created_at` filters. The underlying filter architecture doesn't support `created_at` push-down, so even if we added the routing directive, the tool couldn't honor it.

**Recommended Sprint F shape.** One coordinated refactor rather than three separate fixes:

- Lift `getOpportunities` to accept a structured filter object and push every filter into the Supabase query builder before `.limit()`.
- Paginate past the 1000-row default via `.range()` when the caller asks for more than one page (explicit opt-in, backward-compatible default).
- Add `created_at` range filters to the signature so temporal routing has somewhere to land.
- Update `search_opportunities` and `analyze_opportunity_pipeline` to pass filters through the new signature rather than applying them post-fetch.
- Add the temporal routing directive to `DEFAULT_SYSTEM_PROMPT` once the underlying filter architecture supports it — this is a smaller companion change, not a separate work item.

Estimated scope: 1-2 focused sessions. Not a trivial change, but bounded — one function + two tool callers + one prompt addition. Holds on CMDA window per April 20 handoff.

---

## 5. Lessons Added (37-40)

### Lesson 37 — AskPlexi Tool Schema Must Evolve With Lead-Import Columns

**Origin:** April 21 Ben tenant. `source_campaign` was added to `opportunities` in Sprint D for lead import, but AskPlexi's `search_opportunities` tool schema wasn't updated. The LLM had no `input_schema` path to pass the filter. Ben's campaign queries silently returned warmth-ranked NYC leads from the March 18 column-mapping-bug batch for approximately 24 hours before the failure surfaced in browser-verify.

**Parallel to Lesson 25** (Voice DNA schema must match its injection function). Same structural pattern, different consumer.

**Rule:** any PR adding a user-queryable column to `opportunities` / `prospects` / any queryable table must include matching updates to:
- AskPlexi tool `input_schema` (so the LLM has a path to pass the filter)
- AskPlexi tool `description` (so the LLM knows when to use it)
- Layer 4 pipeline summary (`buildOpportunitySummary` in `ask-plexi.js`) if the column is aggregatable — so the LLM has context for the column's existence without a tool call

Lead-import PRs without these three updates should be flagged in review.

### Lesson 38 — Keyword + Structured Filter Composition

**Origin:** April 21 Fix A. `search_opportunities` had a keyword text-search filter that ran post-SQL and intersected with structured filters via AND, stripping valid rows. Ben's query `"Provide me the top 10 leads post-Animation Yall..."` with `filters.source_campaign='Animation Yall TN 2026-04'` kept only the 13 of 122 rows whose text fields contained 'animation'. The other 109 Tennessee school contacts were silently dropped.

**Rule:** when a tool accepts both free-form keyword search and structured filters, they compose as AND by default, which over-narrows. Explicit structured filters should **skip** keyword narrowing — the user has already expressed their narrowing intent. The keyword filter remains useful as a fallback when no structured filter is present.

This pattern applies to any tool with both modes. Fix A's implementation in `search-opportunities.js` is the reference.

### Lesson 39 — Tool Descriptions Alone Don't Steer LLM Routing

**Origin:** April 21 B2. After B1 added `'campaign'` to `analyze_opportunity_pipeline`'s `group_by` enum and distinguished `source` from `campaign` in the tool description with soft language ("Use 'campaign' when the user asks about campaigns"), the LLM still picked `group_by='source'` on Ben's browser-verify. Step 3 returned `sunnax_import (819)` labeled as "Campaign Breakdown".

**Distinction:** tool descriptions inform HOW to call a tool once the LLM has decided to call it. System prompts inform WHETHER and WHICH tool to route to in the first place.

**Rule:** when a new grouping or filter option semantically overlaps with an existing one (e.g., two fields both called "source-ish" in a user's mental model), budget for **dual-layer steering** from the start:
- Tool description with an authoritative directive ("IMPORTANT: For campaign questions, ALWAYS pass `group_by='campaign'`...")
- System prompt directive with the routing rule

Do not expect tool description alone to override habituated LLM preference. The B2 ship pattern (X + Y together, defense-in-depth) is the reference.

### Lesson 40 — Verify Session/Bundle Freshness Before LLM Post-Mortem

**Origin:** April 21 B2 cycle. "Looks pre-fix" cost roughly 30 minutes of strategy-lane attention chasing an LLM regression that didn't exist. The actual cause surfaced only when Ken sent Ben a fresh sandbox link: Ben's browser was on a stale pre-#48 SPA bundle with cached session state. The deploy was correct; the client just hadn't refreshed.

**Rule:** before opening a post-mortem on "fix looks reverted" behavior, run this three-step diagnostic first:

1. Confirm Railway deploy is green at a SHA at or beyond the fix commit.
2. Force client reload via a fresh sandbox link (best) or hard refresh with cache-clear (weaker).
3. Confirm the user's session is refreshed — new conversation_id, re-validated tenant context.

If all three hold and behavior still looks pre-fix, **then** post-mortem. This is the cheap diagnostic layer; always run it first. Skipping it burns strategy-lane attention on fictitious bugs.

---

## 6. Eval Log Additions (beyond the lessons)

- **Temporal routing (seed-2)** — existing entry, stays open, folded into the Sprint F architectural bucket rather than treated as standalone.
- **Sprint F architectural bucket** — new entry, high priority, `cross_cutting` tag. Scope per section 4 above.
- **PR #47 Railway build-failure logs** — new entry, low priority, `tooling_hygiene` tag. Build failed once; #48's build succeeded on essentially the same base plus B2 additions. Likely transient but worth reviewing the log tail to confirm no latent regression in the build pipeline.

---

## 7. PilotLab Backlog Signal

The B2 failure cycle is the canonical PilotLab use case. A pre-flight fixture running the three browser-verify questions against a Ben-shaped tenant (large row count, multi-campaign with `-pre-show` / base-name pair, zero-warmth cohorts) after any AskPlexi tool change would have caught the routing preference miss before Railway deploy — and before Ken's strategy-lane attention got pulled in.

**Fixture scope for PilotLab v1:** AskPlexi multi-turn routing regression tests on representative tenant shapes. Coverage matrix:

- Row counts: small (~100), medium (~1k), large (~3.5k).
- Campaign presence: none, single campaign, multiple with `-pre-show` / base-name pair.
- NULL distribution: zero NULLs, mixed, NULL-dominant (Ben's `No campaign` at 2,103 is the representative shape).
- Query phrasings per feature: exact tool-friendly phrasing + one ambiguous phrasing per feature.

Success criterion for the fixture: tool call sequence (which tool, which parameters) matches expectation, **not** final LLM prose — LLM wording will always drift but tool routing should be deterministic.

---

## 8. Non-Blocking Housekeeping

- **PR #47 Railway build logs** — pending review when convenient. Not blocking anything currently in flight.
- **PlexifyFeatureGuide.jsx** — next refresh cycle, no urgent update needed from this bug chain.
- **Option Q (`-pre-show` / base-name naming convention hint)** — shipped in PR #49, logged here for visibility. Pattern-detected injection, Ken SOLO tenant correctly unaffected.

---

## 9. Rhythm Retro

- **Surprise gate fired cleanly at B2 post-mortem moment** — the three-AI discipline held. Option Z was explicitly unblocked with reference to the browser-verify evidence rather than shipped speculatively.
- **Strategy-lane miss on B2 self-verify prompt** — the original ship instructions didn't request a Node script for LLM-facing content verification, so no direct test existed to catch the Step 3 routing failure before Ben's browser did. Lesson 40 codifies the fix (bundle/session freshness check first), but there's a second-order lesson worth tracking: LLM-routing changes have a verification gap between "prompt string assembles correctly" (Node-testable) and "LLM actually routes as intended" (browser-only). PilotLab v1 closes this gap.
- **Bundle-freshness workaround** — net-new diagnostic technique worth preserving. The "send a fresh sandbox link" move is cheap, fast, and eliminates the most common "looks reverted" false alarm. Encoded as Lesson 40 and folded into the PilotLab pre-flight scope.

---

## 10. What the Next Claude Chat Session Needs To Know

- **Bug chain closed.** Ben demo-ready. CMDA window intact — approximately 11 days out per April 20 handoff.
- **Sprint F shape still on hold until post-CMDA** per April 20 handoff. This delta defines the unified scope but does not move up the timeline.
- **Dogfooding continues this week.** Eval log captures signals. If additional AskPlexi routing or filter issues surface in Ben's or other pilot tenants' usage, file them as eval entries — do not ship fixes without Ken's explicit unblock.
- **PilotLab reveal still pending from Ken.** The fixture scope in section 7 is a working proposal; final v1 scope waits on the reveal.
- **Four new lessons (37-40) are not yet in `PlexifyAI_Lessons_Learned_Updated.md`.** That update is a separate commit after Ken reviews this delta — do not auto-merge.

---

*End of delta. For canonical sprint status, read the April 20 handoff alongside this document.*
