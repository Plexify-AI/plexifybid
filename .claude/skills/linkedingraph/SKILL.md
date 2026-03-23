---
name: linkedingraph
description: >
  Imports and classifies a user's LinkedIn network into scored BD opportunities.
  Accepts a LinkedIn Data Export ZIP or individual CSVs. Runs tier classification,
  vertical tagging, multi-dimensional warmth scoring, LLM batch enrichment, and
  priority scoring to produce a review queue for human approval before import.
  Use when a user says "import LinkedIn," "process my connections," "LinkedIn pipeline,"
  or "analyze my network."
version: 1.0.0
context: fork
agent: general-purpose
allowed-tools: Read, Write, Grep, Glob, Bash
---

# LinkedInGraph Agent

## Mission

Transform a LinkedIn Data Export into prioritized, warmth-scored BD opportunities
ready for import into PlexifyAEC. Every contact gets a composite warmth score (0-100)
computed from message history, endorsements, recommendations, invitation direction,
and company follows.

## Critical Guardrails

- NEVER use `split(',')` on LinkedIn CSVs — use a proper state-machine parser (csv-parse or papaparse). LinkedIn exports have commas inside quoted fields.
- NEVER overwrite the original input files. All pipeline stages write to NEW files.
- NEVER depend on bash for script execution. All scripts run via `node script.mjs` from PowerShell.
- ALL batch API calls MUST be resume-safe with progress JSON files saved after each batch.
- Model string for LLM classification: `claude-haiku-4-5-20251001` — pin this, do not use latest.
- Batch size for LLM calls: 50 companies per batch. Larger risks truncated JSON responses.
- POST delay: 1500ms between API calls. Backoff: 65s on 429 rate limit.
- Express route registration: any new routes must register BEFORE the catch-all `:id` route in `server/index.mjs`.
- Windows path rule: always use `C:\Users\KensBOXX\` (junction), never `C:\Users\Ken's BOXX\`.

## Workflow

### Phase 1: Extract & Validate

**Goal:** Accept input, identify available data files, validate required files present.

**Ingestion paths (in priority order):**

**Path A — Full LinkedIn Data Export ZIP (recommended)**

1. User provides the ZIP downloaded from LinkedIn Settings > Data Privacy > Get a copy of your data
2. Extract to working directory `data/linkedingraph/{tenant_slug}/`
3. Inventory all CSVs found — report which warmth signal files are available
4. Required: `Connections.csv` — FAIL if missing
5. Required: `messages.csv` — WARN if missing (pipeline runs but warmth will be connection-tenure only)
6. Optional warmth files: `Endorsement_Given_Info.csv`, `Endorsement_Received_Info.csv`, `Recommendations_Given.csv`, `Recommendations_Received.csv`, `Invitations.csv`, `Company Follows.csv`, `Events.csv`
7. Optional context files: `Profile.csv`, `Positions.csv`, `Ad_Targeting.csv`, `Skills.csv`

**Path B — Individual CSV Upload**

1. User provides `Connections.csv` at minimum
2. Optionally provides `messages.csv` for warmth cross-reference
3. Limited warmth scoring — message count + connection tenure only

**Validation checkpoint — present to user:**

```
LinkedIn Data Export Inventory:
  Connections:     {N} contacts found
  Messages:        {N} conversations ({M} total messages)
  Endorsements:    {N} given / {M} received
  Recommendations: {N} given / {M} received
  Invitations:     {N} sent/received
  Company Follows: {N} companies followed
  Events:          {N} events attended

  Warmth signal coverage: {X}/7 dimensions available
  Proceed with pipeline? [Y/n]
```

### Phase 2: Profile Context

**Goal:** Parse the user's own profile for context needed in warmth analysis.

Read from `Profile.csv`:
- Owner name (for sent/received message matching)
- Owner LinkedIn URL (for SENDER PROFILE URL matching in messages.csv)
- Headline and industry (for vertical affinity weighting)

Read from `Positions.csv`:
- Career history with dates (for relationship-timing context)

**This data stays in memory — not stored, not sent to LLM.**

### Phase 3: Classify Connections

**Goal:** Tier classification + vertical tagging using rule-based methods.

Run the existing pipeline scripts in sequence:

1. Parse `Connections.csv` with proper CSV parser
2. **Tier Classification** (Rule-based): Decision Maker / Influencer / Other based on Position field
   Reference: `references/tier-rules.md`
3. **Vertical Tagging — Pass 1** (Keyword matching): Company name keywords
4. **Vertical Tagging — Pass 2** (Expanded heuristics): Additional keyword patterns
5. **Vertical Tagging — Pass 3** (Position inference): Classify by position title patterns
   Reference: `references/vertical-taxonomy.json`

**Checkpoint — present to user:**

```
Classification Results (Heuristics):
  Total Tier 1 contacts: {N}
  Tagged by keywords:    {N} ({%})
  Tagged by heuristics:  {N} ({%})
  Tagged by position:    {N} ({%})
  Remaining untagged:    {N} ({%})

  Vertical Distribution:
  | Vertical            | Count | % |
  |---------------------|-------|---|
  | GC                  | ...   |   |
  | AEC Tech            | ...   |   |
  | Developer           | ...   |   |
  | MEP/Engineering     | ...   |   |
  | Architecture/Design | ...   |   |
  | BID/EcoDev          | ...   |   |
  | (untagged)          | ...   |   |

  Proceed to warmth extraction? [Y/n]
```

### Phase 4: Warmth Signal Extraction

**Goal:** Cross-reference ALL available warmth source files to compute per-contact signals.

This is the core enhancement over Recipe v0.2.0. For each contact in Connections.csv, match
against warmth source files by LinkedIn profile URL (primary key) or name+company (fallback).

Reference: `references/data-schema.md` for column specs and URL normalization rules.

#### 4a. Message Cross-Reference (from `messages.csv`)

- Match contact LinkedIn URL to SENDER PROFILE URL or RECIPIENT PROFILE URLS
- Filter out: FOLDER=SPAM, CONVERSATION TITLE='Sponsored Conversation', null SENDER PROFILE URL (system messages)
- Compute per contact:
  - `msg_total`: total message count
  - `msg_sent`: messages FROM the owner TO this contact
  - `msg_received`: messages FROM this contact TO the owner
  - `msg_reciprocity`: ratio of min(sent,received)/max(sent,received) — 0.0=one-way, 1.0=balanced
  - `msg_last_date`: most recent message timestamp
  - `msg_recency_days`: days since last message (from pipeline run date)
- Build Notes field: `"{msg_total} msgs ({msg_sent} sent, {msg_received} received), last: {month} {year}"`

#### 4b. Endorsement Cross-Reference (from `Endorsement_Given_Info.csv` + `Endorsement_Received_Info.csv`)

- Match contact by `Endorsee Public Url` (given) or `Endorser Public Url` (received)
- URL normalization: endorsement files use `www.linkedin.com/in/...` (no https://), Connections uses full URLs. Strip protocol and normalize before matching.
- Compute per contact:
  - `endorsements_given`: count of skills the owner endorsed on this contact
  - `endorsements_received`: count of skills this contact endorsed on the owner
  - `endorsement_mutual`: true if both directions exist

#### 4c. Recommendation Cross-Reference (from `Recommendations_Given.csv` + `Recommendations_Received.csv`)

- Match by First Name + Last Name (these files don't contain profile URLs)
- Compute per contact:
  - `recommendation_given`: boolean
  - `recommendation_received`: boolean
  - `recommendation_mutual`: true if both directions

#### 4d. Invitation Direction (from `Invitations.csv`)

- Match by `inviterProfileUrl` or `inviteeProfileUrl`
- Compute per contact:
  - `invitation_direction`: 'outgoing' (owner invited them), 'incoming' (they invited owner), or 'unknown'
  - `invitation_message`: boolean — was a custom message included?

#### 4e. Company Follow Cross-Reference (from `Company Follows.csv`)

- Match contact's Company field against Organization field in Company Follows
- Case-insensitive, strip Inc./LLC/Corp. suffixes before matching
- Compute per contact:
  - `company_followed`: boolean
  - `company_follow_date`: when the follow happened (if available)

#### 4f. Event Co-Attendance (from `Events.csv`)

- Secondary signal — events don't directly link to contacts
- Store events list for potential future matching against message content
- For now: flag as available but not scored (v1.1 enhancement)

### Phase 5: Composite Warmth Scoring

**Goal:** Compute a single 0-100 warmth score per contact from all extracted signals.

Reference: `references/warmth-scoring-spec.md` for full algorithm.

**Scoring formula:**

```
warmth_score = (
  message_score * 0.30 +
  reciprocity_score * 0.15 +
  recency_score * 0.15 +
  endorsement_score * 0.15 +
  recommendation_score * 0.10 +
  invitation_score * 0.10 +
  company_follow_score * 0.05
)
```

**Output per contact — add to enrichment_data JSON:**

```json
{
  "warmth_composite": 72,
  "warmth_dimensions": {
    "message_count": { "raw": 44, "score": 100 },
    "reciprocity": { "raw": 0.55, "score": 75 },
    "recency": { "raw": 120, "score": 75 },
    "endorsements": { "raw": { "given": 3, "received": 1 }, "score": 100 },
    "recommendations": { "raw": { "given": true, "received": false }, "score": 75 },
    "invitation": { "raw": "outgoing", "score": 100 },
    "company_follow": { "raw": true, "score": 100 }
  },
  "warmth_label": "Strong"
}
```

**Warmth labels:** 0-25: Cold, 26-50: Warm, 51-75: Strong, 76-100: Hot

**Backward-compatible Warm field derivation:**
- warmth_composite >= 51 -> Warm = "Y"
- warmth_composite 26-50 -> Warm = "Maybe"
- warmth_composite <= 25 -> Warm = "" (empty)

### Phase 6: LLM Batch Classification

**Goal:** Classify remaining untagged companies via Claude Haiku.

Run existing scripts in sequence:

1. `scripts/linkedingraph/extract-untagged.mjs` — extract untagged companies
2. `scripts/linkedingraph/classify-companies-llm.mjs` — LLM classification
   - Model: `claude-haiku-4-5-20251001`
   - Batch size: 50 companies per batch
   - Delay: 1500ms between batches
   - Backoff: 65s on 429 rate limit
   - Resume-safe: progress saved to `data/linkedingraph_llm_progress.json`
   - Cost: <$0.50 for 3,000 contacts
3. `scripts/linkedingraph/merge-classifications.mjs` — merge LLM results back
4. `scripts/linkedingraph/classification-report.mjs` — generate report

**Expect ~55% untagged after LLM pass.** Many companies genuinely can't be classified from name + position alone.

**Checkpoint — present to user:**

```
LLM Classification Complete:
  Companies classified: {N} ({%} of untagged)
  Returned "Unknown":  {N} ({%})
  Batches processed:   {N}
  Estimated cost:      ${X}

  Updated Vertical Distribution:
  | Vertical            | Count | % | Change |
  |---------------------|-------|---|--------|
  ...

  Proceed to priority scoring? [Y/n]
```

### Phase 7: Priority Scoring

**Goal:** Generate P0-P3 review queue using composite warmth score + vertical.

Reference: `references/priority-scoring.md`

**Enhanced P0-P3 Matrix (using composite warmth score):**

| Priority | Warmth Score | Vertical | Intent |
|----------|-------------|----------|--------|
| P0 — Immediate | 76-100 (Hot) | Known | Real relationship with deep engagement. Outreach immediately. |
| P1 — High | 51-75 (Strong) | Known | Solid connection with multiple warmth signals. Personalized outreach. |
| P2 — Review | 26-50 (Warm) | Known | Some engagement signals. Worth human review. |
| P3 — Backlog | 1-25 (Cold) | Known | Minimal signal. Park for nurture campaigns. |

**Excluded:** Contacts with warmth_composite = 0 AND no vertical.

**Gold List:** Top contacts sorted by warmth_composite descending. Show top 10 with dimension breakdown.

Run: `scripts/linkedingraph/generate-review-queue.mjs` (updated to accept composite warmth score)

**Checkpoint — present to user:**

```
Priority Queue Generated:
  P0 (Immediate): {N} contacts (warmth 76-100)
  P1 (High):      {N} contacts (warmth 51-75)
  P2 (Review):    {N} contacts (warmth 26-50)
  P3 (Backlog):   {N} contacts (warmth 1-25)
  Total in queue:  {N}

  Gold List - Top 10:
  | # | Name | Company | Vertical | Warmth | Msgs | Endorsements | Rec? |
  ...

  Review queue ready for approval. Proceed to human review? [Y/n]
```

### Phase 8: Human Review

**Goal:** Present the full review queue for user approval before any import.

This is a HARD GATE. No imports happen without explicit user approval.

Present the review queue grouped by priority tier. For each contact show:
- Name, Company, Position, Vertical, Warmth Score, dimension breakdown
- Recommended action (Import / Skip / Flag for manual outreach)

User can:
- Approve all in a tier
- Exclude specific rows
- Adjust priorities manually
- Export review queue as CSV for offline review

### Phase 9: Import

**Goal:** POST approved contacts to PlexifyAEC as opportunities.

Run: `scripts/linkedingraph/import-linkedin-opportunities.mjs`

Reference: `references/import-mapping.md`

- Resume-safe with progress JSON
- `--dry-run` flag for testing
- `--limit N` for partial runs
- Deduplication by account_name + contact_name (case-insensitive)
- Auth: `PLEXIFY_SANDBOX_TOKEN` from `.env.local`

**CSV to API Field Mapping:**

| Source | Opportunity Field | Transform |
|--------|-------------------|-----------|
| Company | account_name | Direct (required) |
| First Name + Last Name | contact_name | Concatenated |
| Position | contact_title | Direct |
| Composite | deal_hypothesis | "{Vertical} prospect, {Priority}, Warmth: {warmth_composite}/100, {msg_total} messages. Top signals: {top 2 warmth dimensions}. Imported from LinkedInGraph Agent." |
| URL + warmth data | enrichment_data | Full warmth_dimensions JSON + linkedin_url + import metadata |

**Server-side defaults:** stage='prospecting', warmth_score=warmth_composite, tenant_id from auth token.

**Final report:**

```
Import Complete:
  Created:  {N} opportunities
  Skipped:  {N} duplicates
  Errors:   {N}

  Pipeline Summary:
  {total_connections} connections
    -> {classified} classified
    -> {in_queue} in review queue
    -> {imported} imported

  Average warmth score: {avg}
  Cost: ${total_llm_cost}
```

## Error Handling

| Error | Recovery |
|-------|----------|
| Missing Connections.csv | FAIL — cannot proceed. Ask user to re-export. |
| Missing messages.csv | WARN — run with degraded warmth (connection-tenure only). Redistribute message/reciprocity/recency weights across other dimensions. |
| CSV parse error | Log row number and raw line. Skip row, continue. Report skipped count at checkpoint. |
| LLM rate limit (429) | Sleep 65s, retry same batch. Max 3 retries per batch. |
| LLM timeout | Retry batch once. On second failure, mark batch as failed, continue. Resume picks up failed batches. |
| Import 429 | Sleep 65s, retry. Progress JSON ensures no duplicates on resume. |
| Import duplicate | Skip silently, increment counter. |
| Empty company name | Skip row — cannot create opportunity without account_name. |

## Existing Pipeline Scripts

These scripts in `scripts/linkedingraph/` are the foundation. The SKILL.md orchestrates them:

| Script | Purpose | Input | Output |
|--------|---------|-------|--------|
| `extract-untagged.mjs` | Extract Tier 1 contacts with no vertical | Classified CSV | `linkedingraph_untagged.csv` |
| `classify-companies-llm.mjs` | LLM batch classification via Claude Haiku | Untagged CSV | `linkedingraph_llm_results.json` |
| `merge-classifications.mjs` | Merge LLM results back into main CSV | Classified CSV + LLM JSON | Updated classified CSV |
| `classification-report.mjs` | Generate vertical distribution report | Classified CSV | Console report |
| `generate-review-queue.mjs` | Priority scoring and queue generation | Classified CSV | `ken_SOLO_review_queue.csv` |
| `import-linkedin-opportunities.mjs` | POST opportunities to API | Review queue CSV | Import progress JSON |
| `run-pipeline.mjs` | Orchestrator — runs all steps in sequence | Connections CSV | All outputs |

## Benchmark (Ken's Network, 2026-03-16)

Reference: `examples/ken-pipeline-benchmark.json`

- 11,281 connections -> 3,214 Tier 1
- 45.1% vertical classification rate (1,448 tagged)
- 231 Gold List contacts (Warm=Y + Vertical known)
- P0: 34, P1: 197, P2: 6, P3: 617 (854 total in queue)
- 222 opportunities imported, 9 duplicates skipped
- LLM cost: ~$0.50
