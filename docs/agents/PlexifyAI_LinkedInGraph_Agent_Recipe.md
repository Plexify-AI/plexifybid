# PlexifyAI LinkedInGraph Agent Recipe

**Version:** 0.2.0
**Status:** Experimental
**Last Updated:** 2026-03-16
**Author:** Ken D'Amato / Claude Code

---

## Overview

The LinkedInGraph Agent transforms a raw LinkedIn Connections CSV export into prioritized, classified AEC industry contacts ready for import into PlexifyAEC as opportunities. It combines keyword heuristics, position inference, and LLM batch classification to tag contacts by vertical, then scores them by warmth signal (message history) to produce a human-review queue.

**Pipeline:** LinkedIn CSV → Tier Classification → Vertical Tagging → Message Cross-Reference → LLM Classification → Priority Scoring → Human Review → Opportunity Import

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
| `generate-review-queue.mjs` | Prioritize contacts for human review | `data/ken_SOLO_tier1_CLASSIFIED.csv` | `data/ken_SOLO_review_queue.csv` | Yes |
| `import-linkedin-opportunities.mjs` | Import approved contacts as opportunities | `data/ken_SOLO_review_queue.csv` | API calls + `data/linkedingraph_import_progress.json` | Yes (resume-safe) |
| `run-pipeline.mjs` | Sequential runner for steps 0a→2 | — | — | Yes |

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

### Configurability Notes

This scoring is designed to be configurable per tenant:
- A GC might weight Developer contacts higher than Architecture/Design
- An AEC Tech company might prioritize GC contacts (their buyers)
- Message count thresholds (10 and 5) could be adjusted based on LinkedIn usage patterns
- Future: add recency weighting (messages from last 6 months worth more than 3+ years ago)

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

---

## 7. CMDB Registry Entry

```json
{
  "agent_name": "LinkedInGraph Agent",
  "version": "0.2.0",
  "status": "experimental",
  "capabilities": [
    "linkedin_import",
    "vertical_classification",
    "warmth_scoring",
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
    "generate-review-queue.mjs",
    "import-linkedin-opportunities.mjs",
    "run-pipeline.mjs"
  ],
  "data_inputs": [
    "LinkedIn Connections CSV",
    "LinkedIn Messages CSV"
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

### Short-Term (v0.3)
- **CSV upload UI** — Drag-and-drop LinkedIn export on a dedicated page
- **Column mapping adapter** — Handle different LinkedIn export versions and languages
- **Progress indicator** — Real-time batch progress via SSE or polling

### Medium-Term (v0.4)
- **Tenant-scoped data isolation** — Each user's contacts stay within their tenant (already enforced by API auth)
- **Configurable vertical taxonomy** — AEC verticals are PlexifyAEC-specific; PlexifyBID users need different verticals (Retail, Restaurant, Professional Services, etc.)
- **Warmth score integration** — Connect to existing PlexifyAEC warmth decay engine; imported message count could seed initial warmth

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
| `linkedingraph_import_progress.json` | Import progress tracker | Temp |
