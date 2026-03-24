# PlexifyAI LinkedInGraph Agent Recipe

**Version:** 0.3.0
**Status:** Experimental
**Last Updated:** 2026-03-24
**Author:** Ken D'Amato / Claude Code

---

## Overview

The LinkedInGraph Agent transforms a raw LinkedIn Connections CSV export into prioritized, classified AEC industry contacts ready for import into PlexifyAEC as opportunities. It combines keyword heuristics, position inference, and LLM batch classification to tag contacts by vertical, then scores them by composite warmth across 7 weighted dimensions (messages, reciprocity, recency, endorsements, recommendations, invitation direction, company follows) to produce a prioritized human-review queue with Hot/Strong/Warm/Cold labels.

**Pipeline:** LinkedIn CSV → Tier Classification → Vertical Tagging → LLM Classification → Multi-Dimensional Warmth Extraction → Composite Priority Scoring → Human Review → Opportunity Import

---

## 1. Data Schema

### Input: LinkedIn Connections CSV

The agent operates on a pre-processed LinkedIn export with these columns:

```
First Name, Last Name, Email Address, Company, Position, Connected On, URL, Tier, Vertical, Warm, Priority, Notes
```

#### Column Documentation

| Column | Type | Values | Notes |
|--------|------|--------|-------|
| `First Name` | string | — | LinkedIn first name |
| `Last Name` | string | — | May contain suffixes in quotes: `"Williams, Ed.L.D., MSW"` |
| `Email Address` | string | — | Often empty (LinkedIn doesn't expose for most connections) |
| `Company` | string | — | Current company from LinkedIn profile |
| `Position` | string | — | Current title; may contain commas in quotes: `"CEO, Board Member"` |
| `Connected On` | string | — | Date format: `4-Feb-16` |
| `URL` | string | — | Full LinkedIn profile URL (column name is `URL`, not `LinkedIn URL`) |
| `Tier` | string | `"Tier 1 - Decision Maker"` | Full tier string, not just a number |
| `Vertical` | string | `GC`, `AEC Tech`, `Developer`, `MEP/Engineering`, `BID/EcoDev`, `Architecture/Design`, or pipe-delimited multi: `"GC \| Developer"` | Empty string = untagged |
| `Warm` | string | `"Y"`, `"Maybe"`, or empty | Empty = no message history found. NOT `"No"` |
| `Priority` | string | `P0`, `P1`, `P2`, `P3` | Empty by default — populated by review queue generator |
| `Notes` | string | `"8 msgs (2 sent, 6 received), last: Oct 2025"` | Embedded message history. Must be parsed with regex. Contains commas inside quotes. |

**Why this matters for productization:** Future users will have different LinkedIn export formats. This schema section becomes the mapping reference for the import adapter pattern.

### Input: LinkedIn Data Export (8 CSV Files)

The warmth extraction step (v0.3.0) parses 8 files from a full LinkedIn Data Export ZIP:

| File | Columns Used | Purpose |
|------|-------------|---------|
| `Connections.csv` | First Name, Last Name, URL, Company, Position, Connected On | Contact index (10,877 contacts for Ken's network) |
| `messages.csv` | SENDER PROFILE URL, RECIPIENT PROFILE URLS, DATE | Message count, reciprocity ratio, recency decay |
| `Endorsement_Given_Info.csv` | Endorsement Date, Recipient Profile Url | Endorsements given (outbound signal) |
| `Endorsement_Received_Info.csv` | Endorsement Date, Endorser Profile Url | Endorsements received (inbound signal) |
| `Recommendations_Given.csv` | * | Recommendations given (strong outbound signal) |
| `Recommendations_Received.csv` | * | Recommendations received (strong inbound signal) |
| `Invitations.csv` | Direction, inviterProfileUrl | Who initiated the connection |
| `Company Follows.csv` | Organization | Company follow signals (industry interest overlap) |

#### Parsing Notes

- **Connections.csv** has a 2-line disclaimer header before the actual CSV headers. The parser skips lines that don't match the expected column count.
- **messages.csv** contains group conversations with comma-separated recipient URLs (e.g., `url1, url2, url3`). These are split and each participant is credited individually.
- **LinkedIn URL slugs change over time** (e.g., `john-doe-123` becomes `john-doe-456abc`). The parser falls back to name-based matching when URL lookup fails, resolving 154 messages in Ken's dataset that would otherwise be orphaned.

---

## 2. Pipeline Steps & Results

### Step-by-Step Pipeline

| Step | Method | Description |
|------|--------|-------------|
| 1 | Rule-based | Tier Classification (Decision Maker / Influencer / Other) |
| 2 | Keyword matching | Vertical tagging from company name keywords |
| 3 | Message cross-reference | Warm status from LinkedIn Messages CSV |
| 4a | Expanded heuristics | Additional keyword patterns for verticals |
| 4b | Position inference | Classify by position title patterns |
| 4c | LLM batch classification | Claude Haiku classifies remaining untagged companies |
| 5 | Algorithmic | Priority scoring (P0–P3) from warm + vertical + message count |
| 6 | API | Import approved contacts as PlexifyAEC opportunities |

### Pipeline Results (Actual Numbers — 2026-03-16)

**Starting population:** 3,214 Tier 1 contacts

| Step | Method | Contacts Tagged | Cumulative Tagged | Coverage |
|------|--------|-----------------|-------------------|----------|
| 2 | Keywords | 342 | 342 | 10.6% |
| 4a | Expanded heuristics | 327 | 669 | 20.8% |
| 4b | Position inference | 246 | 915 | 28.5% |
| 4c | LLM (Haiku) | 533 | 1,448 | 45.1% |

**LLM Classification Details:**
- Input: 2,299 untagged companies
- Batches: 46 (50 companies per batch)
- Successfully classified: 533 (23.2% of untagged)
- Returned "Unknown": ~1,766 (76.8% of untagged)
- Model: `claude-haiku-4-5-20251001`
- Estimated cost: <$0.50

### Vertical Distribution (Post-LLM)

| Vertical | Count | % | Change from Pre-LLM |
|----------|-------|---|---------------------|
| (untagged) | 1,766 | 54.9% | was 2,299 (−533) |
| AEC Tech | 415 | 12.9% | was 223 (+192) |
| GC | 386 | 12.0% | was 274 (+112) |
| MEP/Engineering | 259 | 8.1% | was 154 (+105) |
| Developer | 253 | 7.9% | was 193 (+60) |
| Architecture/Design | 98 | 3.0% | was 59 (+39) |
| BID/EcoDev | 24 | 0.7% | was 4 (+20) |
| Multi-vertical | 13 | 0.4% | was 8 (+5) |

### Gold List (Warm=Y + Vertical Known)
- **231 contacts** — sorted by message count
- Top 5: Rob Rinderman (126 msgs), Mel Wallace (94), Hosney Abdelgelil (73), Matthew Byrd (52), William Fleck (27)

### Review Queue Summary
- **P0 (Immediate):** 34 contacts — Warm + ≥10 messages
- **P1 (High):** 197 contacts — Warm + <10 messages
- **P2 (Review):** 6 contacts — Maybe + ≥5 messages
- **P3 (Backlog):** 617 contacts — Maybe + <5 messages
- **Total in queue:** 854 contacts

---

## 3. Script Manifest

All scripts live in `scripts/linkedingraph/`.

| Script | Purpose | Input | Output | Idempotent? |
|--------|---------|-------|--------|-------------|
| `extract-untagged.mjs` | Filter untagged companies to separate CSV | `data/ken_SOLO_tier1_FINAL.csv` | `data/linkedingraph_untagged.csv` | Yes |
| `classify-companies-llm.mjs` | Batch classify via Claude Haiku (50/batch) | `data/linkedingraph_untagged.csv` | `data/linkedingraph_llm_results.json` | Yes (resume-safe) |
| `merge-classifications.mjs` | Merge LLM results into full CSV | `data/ken_SOLO_tier1_FINAL.csv` + `data/linkedingraph_llm_results.json` | `data/ken_SOLO_tier1_CLASSIFIED.csv` | Yes |
| `classification-report.mjs` | Generate post-classification report | `data/ken_SOLO_tier1_CLASSIFIED.csv` | `data/linkedingraph_classification_report.txt` | Yes |
| `extract-warmth-signals.mjs` | Parse 8 LinkedIn export CSVs, compute 7-dimension warmth scores | `data/linkedin_export/*.csv` | `data/linkedingraph_warmth_signals.json` | Yes |
| `generate-review-queue.mjs` | Prioritize contacts for human review (reads warmth signals if available) | `data/ken_SOLO_tier1_CLASSIFIED.csv` + warmth signals | `data/ken_SOLO_review_queue.csv` | Yes |
| `import-linkedin-opportunities.mjs` | Import approved contacts as opportunities (enrichment_data includes warmth_dimensions) | `data/ken_SOLO_review_queue.csv` + warmth signals | API calls + `data/linkedingraph_import_progress.json` | Yes (resume-safe) |
| `patch-warmth-existing.mjs` | Backfill warmth_dimensions on pre-existing opportunities | `data/linkedingraph_warmth_signals.json` | Supabase updates | Yes (idempotent) |
| `run-pipeline.mjs` | Sequential runner for full pipeline (includes warmth extraction step) | — | — | Yes |

### Resume-Safe Pattern

Scripts that make API calls (`classify-companies-llm.mjs`, `import-linkedin-opportunities.mjs`) use a progress JSON file pattern:

```javascript
// Save progress after each batch/record
const PROGRESS_FILE = join(DATA_DIR, 'linkedingraph_llm_progress.json');
// Structure: { completed_batches: N, total_batches: M, classifications: [...] }

// On startup, load progress and skip completed work
if (existsSync(PROGRESS_FILE)) {
  progress = JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
  startFrom = progress.completed_batches;
}
```

This pattern is reusable for any future agent that makes batch API calls. Key properties:
- **Crash-safe:** progress saved after each batch, not just at end
- **Restart-safe:** skips already-completed work on restart
- **Inspectable:** progress file is human-readable JSON

---

## 4. Priority Scoring Algorithm

### P0–P3 Specification

| Priority | Warm | Vertical | Message Count | Intent |
|----------|------|----------|---------------|--------|
| P0 — Immediate | Y | Known | ≥ 10 | Real relationship, active message history. Outreach immediately. |
| P1 — High | Y | Known | < 10 | Real connection, lighter history. Worth personalized outreach. |
| P2 — Review | Maybe | Known | ≥ 5 | Some signal in message history. Worth human review. |
| P3 — Backlog | Maybe | Known | < 5 | Minimal signal. Park for nurture campaigns. |

**Excluded from queue:**
- Contacts with no Warm status (no message history at all)
- Contacts with no Vertical classification (can't route to BD workflow)

### v0.3.0 Update: Composite Warmth Thresholds Replace Message-Count Logic

When composite warmth scoring is available (via `linkedingraph_warmth_signals.json`), the review queue generator switches from the message-count P0–P3 table above to composite warmth thresholds:

| Priority | Default Threshold | Intent |
|----------|------------------|--------|
| P0 — Immediate | warmth ≥ 65 | Multi-signal, active relationship. Outreach immediately. |
| P1 — High | warmth ≥ 45 | Multiple engagement types. Prioritize for personalized outreach. |
| P2 — Review | warmth ≥ 20 | Some engagement signals. Include in targeted campaigns. |
| P3 — Backlog | warmth 1–19 | Minimal signal. Nurture list or park. |

**Threshold Recalibration (v0.2.0 → v0.3.0):** The original thresholds (76/51/26) were borrowed from the warmth label breakpoints (Hot/Strong/Warm/Cold). In practice, these produced zero P0 contacts for Ken's 10,877-connection network — the highest composite score was 71 (Ben D'Amprisi Jr.). Static breakpoints don't work across tenants with different LinkedIn engagement patterns. A power LinkedIn user with 500+ connections might have scores clustered 40–80, while a selective connector with 200 connections might peak at 50. The recalibrated defaults (65/45/20) were validated against Ken's network to produce actionable tier distribution: P0=3, P1=15, P2=189, P3=774.

**CLI Override Flags:** All thresholds are configurable via command-line flags:

```
node scripts/linkedingraph/generate-review-queue.mjs \
  --p0-threshold 70 \
  --p1-threshold 50 \
  --p2-threshold 25
```

This enables per-tenant calibration without code changes. A broadcast industry user with fewer but deeper LinkedIn relationships would use lower thresholds; a real estate developer with thousands of shallow connections would use higher ones.

### Configurability Notes

This scoring is designed to be configurable per tenant:
- A GC might weight Developer contacts higher than Architecture/Design
- An AEC Tech company might prioritize GC contacts (their buyers)
- Warmth thresholds should be calibrated per-user based on their LinkedIn engagement patterns
- The message-count fallback (v0.2.0 logic) is preserved when no warmth signals file exists
- Future: auto-calibrate thresholds based on score distribution percentiles

---

## 4.5 Multi-Dimensional Warmth Scoring

### 7 Weighted Dimensions

| Dimension | Weight | Source File | What It Measures |
|-----------|--------|-------------|-----------------|
| Message Count | 30% | messages.csv | Volume of LinkedIn messages exchanged |
| Reciprocity | 15% | messages.csv | Sent-to-received ratio (bidirectional > one-way) |
| Recency | 15% | messages.csv | Days since last message (exponential decay) |
| Endorsements | 15% | Endorsement_Given_Info.csv + Endorsement_Received_Info.csv | Skill endorsements given and/or received |
| Recommendations | 10% | Recommendations_Given.csv + Recommendations_Received.csv | Written recommendations (strongest per-interaction signal) |
| Invitation Direction | 10% | Invitations.csv | Who initiated the connection request |
| Company Follow | 5% | Company Follows.csv | Whether you follow their company (industry interest overlap) |

### Composite Scoring

Each dimension is normalized to 0–100 independently, then combined via weighted sum to produce a single `warmth_composite` score (0–100). The normalization approach varies by dimension:

- **Message Count:** Log-scaled (diminishing returns above ~50 messages)
- **Reciprocity:** 1.0 ratio = 100, tapering for lopsided conversations
- **Recency:** Exponential decay — messages within 30 days score 100, dropping to near-zero at 2+ years
- **Endorsements/Recommendations:** Per-interaction weighting (one recommendation is worth more than one endorsement)
- **Invitation Direction:** Binary — initiated by you scores higher (you showed intent)
- **Company Follow:** Binary — follow = signal, no follow = 0

### Warmth Labels

| Label | Score Range | BD Meaning |
|-------|------------|------------|
| Hot | 76–100 | Active, multi-signal relationship — outreach immediately |
| Strong | 51–75 | Multiple engagement types — prioritize for personalized outreach |
| Warm | 26–50 | Some engagement signals — include in targeted campaigns |
| Cold | 1–25 | Minimal signal — nurture list or park |
| No Signal | 0 | Connection only, zero interaction data |

### Validated Results (Ken's Network — 10,877 Contacts)

| Label | Count | % |
|-------|-------|---|
| Hot (76–100) | 0 | 0.0% |
| Strong (51–75) | 26 | 0.2% |
| Warm (26–50) | 921 | 8.5% |
| Cold (1–25) | 6,542 | 60.1% |
| No Signal (0) | 3,388 | 31.2% |

**Top 5:** Ben D'Amprisi Jr. (71), Hosney Abdelgelil (69), Matthew Byrd (65), Mel Wallace (65), Reginald Bernardin (63)

### Ranking Shift Example

Rob Rinderman was #1 under message-count-only scoring (126 messages). Under composite scoring, he dropped to score 49 (Warm) and below the top 10. Why: zero recency (last message >2 years ago), no recommendations, no company follow. The volume was there but the relationship went dormant.

Ben D'Amprisi Jr. rose to #1 (score 71) with 96 messages + 15 endorsements given + a recommendation. Multiple engagement types across different signal categories compound into a higher composite score than raw message volume alone.

### Key Design Decisions

- **Recency decay is intentional.** A contact with 200 messages but no activity in 2 years scores lower than a contact with 20 messages in the last month. This reflects BD reality — dormant relationships need re-warming before outreach.
- **Zero "Hot" contacts is valid intelligence.** Ken's network peaks at 71, meaning no relationships are currently in the multi-signal active zone. This tells the BD exec exactly where to focus re-engagement efforts rather than presenting a false sense of warmth.
- **Endorsement/recommendation signals are weighted higher per-interaction than messages.** Writing a recommendation takes 10 minutes; sending a message takes 10 seconds. The effort asymmetry is reflected in the scoring weights.

---

## 5. Opportunity Import Mapping

### CSV → API Field Mapping

| Review Queue CSV | Opportunity Field | Transform |
|-----------------|-------------------|-----------|
| `Company` | `account_name` | Direct (required) |
| `First Name` + `Last Name` | `contact_name` | Concatenated |
| — | `contact_email` | `null` (LinkedIn doesn't expose) |
| `Position` | `contact_title` | Direct |
| Composite | `deal_hypothesis` | `"{Vertical} prospect, {Priority}, Warm: {Warm}, {N} messages on LinkedIn. Imported from LinkedInGraph Agent."` |
| `URL` + metadata | `enrichment_data` | `{ source, import_date, linkedin_url, warm_status, message_count }` |

### Server-Side Defaults

| Field | Value |
|-------|-------|
| `stage` | `'prospecting'` |
| `warmth_score` | `0` (warmth engine computes live) |
| `tenant_id` | From sandbox auth token |

### Deduplication

Duplicate check uses `account_name + contact_name` pair (case-insensitive). Multiple contacts at the same company are expected and allowed.

### CLI Flags

```
--dry-run              Log what would be created, no API calls
--limit N              Process first N rows only
--base-url <url>       API base URL (default: http://localhost:3000)
```

### Auth

Requires `PLEXIFY_SANDBOX_TOKEN` environment variable in `.env.local`. Not hardcoded in script.

---

## 6. Lessons Learned

1. **CSV quoting is treacherous.** LinkedIn exports use inconsistent quoting — the Notes field contains commas inside quotes, and Last Name / Position fields sometimes do too. A proper state-machine CSV parser is required; `split(',')` will corrupt data.

2. **Company name matching is imperfect.** LLM merge uses case-insensitive exact match on company name. Companies with Inc., LLC, Corp. variations may not match. Future improvement: normalize company names (strip suffixes) or use fuzzy matching.

3. **Notes field format is fragile.** Message history format (`"8 msgs (2 sent, 6 received), last: Oct 2025"`) is not guaranteed stable across LinkedIn export versions. Regex extraction (`/^(\d+)\s+msgs?\b/`) should be defensive with fallback to 0.

4. **Never overwrite the original file.** All pipeline stages write to new files. The original `ken_SOLO_tier1_FINAL.csv` is never modified. This backup-first pattern prevents data loss if any step produces corrupt output.

5. **Haiku is sufficient for vertical classification.** Claude Haiku (`claude-haiku-4-5-20251001`) handles company → vertical classification well. Sonnet is not needed, saving ~95% cost. The 76.8% Unknown rate is expected — many companies (consulting firms, generic LLCs, non-AEC companies) genuinely can't be classified from name + position alone.

6. **Batch size of 50 is the sweet spot.** Keeps under Haiku context limits while minimizing API calls (46 calls for 2,299 companies). Larger batches risk truncated JSON responses.

7. **Bash breaks on Windows with apostrophes in HOME.** Git Bash on Windows fails when `HOME` contains an apostrophe (`Ken's BOXX`). All scripts must be runnable via `node script.mjs` from PowerShell. Never depend on bash for script execution.

8. **Resume-safe is non-negotiable for batch operations.** The LLM classification script saves progress after every batch. Without this, a crash at batch 40/46 would require re-running (and re-paying for) all 46 batches.

9. **LinkedIn Data Export has disclaimer headers.** `Connections.csv` starts with 2 lines of boilerplate text before the actual CSV headers. The parser must detect and skip these by checking whether the line matches the expected column count.

10. **Group conversations are common and invisible.** LinkedIn `messages.csv` encodes group chats with comma-separated recipient URLs in a single field. Without splitting these, group conversation messages are silently dropped from warmth scoring (they don't match any single contact URL).

11. **LinkedIn URL slugs change over time.** A contact's profile URL can change (e.g., job change triggers slug regeneration). The warmth extractor falls back to name-based matching when URL lookup fails — this recovered 154 messages in Ken's dataset that would otherwise be orphaned.

12. **Multi-dimensional warmth changes rankings dramatically.** Rob Rinderman went from #1 (126 messages, message-count-only) to score 49 (composite) because of zero recency, no recommendations, no company follow. Rankings based on a single dimension are misleading for BD prioritization.

13. **Zero "Hot" contacts is valid intelligence, not a bug.** The initial reaction to seeing P0=0 was "the threshold is broken." In reality, it correctly identified that Ken's network has no currently-active multi-signal relationships — a meaningful signal for where to focus re-engagement efforts. Static score breakpoints borrowed from labels (76/51/26) don't work as priority thresholds; they must be calibrated per-user.

---

## 7. CMDB Registry Entry

```json
{
  "agent_name": "LinkedInGraph Agent",
  "version": "0.3.0",
  "status": "experimental",
  "capabilities": [
    "linkedin_import",
    "vertical_classification",
    "multi_dimensional_warmth_scoring",
    "priority_ranking",
    "opportunity_import"
  ],
  "model_dependencies": {
    "primary": "claude-haiku-4-5-20251001",
    "fallback": null
  },
  "scripts": [
    "extract-untagged.mjs",
    "classify-companies-llm.mjs",
    "merge-classifications.mjs",
    "classification-report.mjs",
    "extract-warmth-signals.mjs",
    "generate-review-queue.mjs",
    "import-linkedin-opportunities.mjs",
    "patch-warmth-existing.mjs",
    "run-pipeline.mjs"
  ],
  "data_inputs": [
    "LinkedIn Connections CSV",
    "LinkedIn Messages CSV",
    "LinkedIn Endorsement_Given_Info CSV",
    "LinkedIn Endorsement_Received_Info CSV",
    "LinkedIn Recommendations_Given CSV",
    "LinkedIn Recommendations_Received CSV",
    "LinkedIn Invitations CSV",
    "LinkedIn Company Follows CSV"
  ],
  "data_outputs": [
    "Classified contacts CSV",
    "Review queue CSV",
    "Classification report TXT",
    "PlexifyAEC opportunities (via API)"
  ],
  "tenant_scope": "per-user (SOLO instance)",
  "estimated_cost_per_run": "<$0.50 for 3,000 contacts"
}
```

---

## 8. Future Productization

What needs to change to make this a multi-tenant, user-facing feature:

### Completed (v0.3.0)
- **Multi-dimensional warmth scoring** — 7 weighted dimensions (messages, reciprocity, recency, endorsements, recommendations, invitation direction, company follows) producing composite 0–100 scores
- **Configurable priority thresholds** — `--p0-threshold`, `--p1-threshold`, `--p2-threshold` CLI flags for per-tenant calibration
- **Warmth backfill** — `patch-warmth-existing.mjs` updates pre-existing opportunities with warmth_dimensions

### Short-Term (v0.4)
- **CSV upload UI** — Drag-and-drop LinkedIn Data Export ZIP on a dedicated page
- **Column mapping adapter** — Handle different LinkedIn export versions and languages
- **Progress indicator** — Real-time batch progress via SSE or polling
- **Configurable vertical taxonomy** — AEC verticals are PlexifyAEC-specific; other verticals need different taxonomies

### Medium-Term (v0.5)
- **Tenant-scoped data isolation** — Each user's contacts stay within their tenant (already enforced by API auth)
- **Auto-calibrated thresholds** — Compute P0/P1/P2 breakpoints from score distribution percentiles rather than fixed defaults
- **Warmth decay integration** — Connect composite warmth to the live PlexifyAEC warmth decay engine for ongoing score updates

### Long-Term (v1.0)
- **LinkedIn API integration** — Replace CSV export with OAuth-based pull (when LinkedIn permits)
- **Scheduled re-classification** — Contacts change jobs; periodic refresh via LinkedIn profile scraping or API
- **Warm list monitoring** — Alert when a Gold List contact changes companies or titles
- **Multi-network support** — Extend beyond LinkedIn to CRM imports, email contacts, conference attendee lists

---

## Appendix: File Manifest

### Data Files (in `data/`)

| File | Description | Persist? |
|------|-------------|----------|
| `ken_SOLO_tier1_FINAL.csv` | Original input — NEVER modify | Yes |
| `linkedingraph_untagged.csv` | Extracted untagged rows for LLM | Temp |
| `linkedingraph_llm_progress.json` | LLM batch progress tracker | Temp |
| `linkedingraph_llm_results.json` | Raw LLM classification results | Yes |
| `ken_SOLO_tier1_CLASSIFIED.csv` | Full CSV with LLM verticals merged | Yes |
| `linkedingraph_classification_report.txt` | Human-readable report | Yes |
| `ken_SOLO_review_queue.csv` | Prioritized review queue | Yes |
| `linkedingraph_warmth_signals.json` | Per-contact 7-dimension warmth scores (7,489 contacts with warmth > 0) | Yes |
| `linkedingraph_import_progress.json` | Import progress tracker | Temp |

### Data Files (in `data/linkedin_export/`)

| Directory | Description | Persist? |
|-----------|-------------|----------|
| `data/linkedin_export/` | Raw 44-CSV LinkedIn Data Export ZIP extract | **Do NOT commit** — contains PII, ~50MB |
