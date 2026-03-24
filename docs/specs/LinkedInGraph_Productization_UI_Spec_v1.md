# LinkedInGraph Productization UI — Feature Specification
## P2 Priority | PlexifyAEC BD Operating System

**Version:** 1.0
**Date:** March 24, 2026
**Author:** Ken D'Amato / Claude Strategy
**Status:** Draft — Awaiting Ken's Approval
**PRD Constitution Phase:** Specify

---

## 1. Problem Statement

The LinkedInGraph pipeline currently runs via CLI scripts in PowerShell. Ken executes 7 scripts manually, monitors terminal output, and troubleshoots errors by reading logs. This works for a solo founder dogfooding his own product — it does NOT work for Ben, Mel, or any pilot tenant.

**The Three Tyrannies this feature fights:**
- **Bandwidth:** A BD exec should not need a developer to process their LinkedIn export
- **Execution:** 7 sequential scripts with flags and file paths = friction that kills adoption
- **Ambiguity:** Terminal output gives no visual feedback on progress, errors, or results

**Target user:** A commercial construction BD executive (Mel, Ben, or future pilot) who has never opened a terminal. They export a ZIP from LinkedIn, drop it in Plexify, and get a scored, prioritized contact list in minutes.

---

## 2. User Flow

### Happy Path (5 steps, under 3 minutes of user effort)

```
Step 1: Navigate to LinkedIn Import page (from PlexiCoS Agents → LinkedIn Agent card → "Import Network" button)
    ↓
Step 2: See instructions + drag-and-drop zone. Drop LinkedIn export ZIP.
    ↓
Step 3: System extracts ZIP, validates CSVs, shows column mapping preview. User confirms (or adjusts if non-standard format).
    ↓
Step 4: Pipeline runs. Progress bar shows each phase with estimated time. User can navigate away — processing continues server-side.
    ↓
Step 5: Results dashboard: warmth distribution chart, top contacts, tier breakdown, "View in Pipeline" CTA to see opportunities.
```

### Error Paths

| Error | When | User Sees | Recovery |
|-------|------|-----------|----------|
| Wrong file type | Step 2 | "Please upload a LinkedIn Data Export ZIP file (.zip)" | Re-upload |
| Missing required CSVs | Step 3 | "Your export is missing: Connections.csv. This file is required." + list of missing files | Re-export from LinkedIn with correct options selected |
| Partial export (only Connections.csv, no messages) | Step 3 | "Found Connections.csv but no message history. Warmth scoring will be limited to connection data only. Continue?" | User choice: proceed with limited scoring or re-export |
| Column format mismatch | Step 3 | Column mapping UI with detected columns on left, expected fields on right. User maps manually. | Drag-and-drop column mapping |
| Pipeline failure mid-run | Step 4 | Progress bar shows which step failed. "Classification paused at batch 23/46. Resume?" | Resume button (resume-safe pattern) |
| Rate limit (429) | Step 4 | "Processing paused — will automatically resume in 60 seconds" | Auto-retry with backoff, no user action needed |

---

## 3. Page Architecture

### 3.1 Route

```
/linkedin-import
```

Accessible from:
- PlexiCoS Agents page → LinkedIn Agent card → "Import Network" button
- Left sidebar under "Agents" section (if sidebar nav is extended)
- Direct URL navigation

### 3.2 Page Layout

Single-page flow with 4 collapsible sections that expand sequentially (accordion pattern). User progresses top-to-bottom. Completed sections collapse with a green checkmark + summary line.

```
┌─────────────────────────────────────────────────────────────┐
│  LinkedIn Network Import                               [?]  │
│  Import and score your professional network                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─ Section 1: Upload ──────────────────────────────── ✓ ─┐ │
│  │  "Connections.csv + 7 data files detected"              │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─ Section 2: Column Mapping ──────────────────────── ✓ ─┐ │
│  │  "All 7 columns auto-mapped successfully"               │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─ Section 3: Processing ──────────── ACTIVE ────────────┐ │
│  │                                                         │ │
│  │  ████████████░░░░░░░░  Step 4/7: LLM Classification    │ │
│  │  Batch 23/46 · ~3 min remaining                         │ │
│  │                                                         │ │
│  │  ✓ Extract & Validate       0:04                        │ │
│  │  ✓ Tier Classification      0:12                        │ │
│  │  ✓ Vertical Tagging         0:08                        │ │
│  │  ● LLM Classification       2:31 (in progress)          │ │
│  │  ○ Warmth Extraction        est. 0:15                   │ │
│  │  ○ Priority Scoring         est. 0:02                   │ │
│  │  ○ Opportunity Import       est. 1:30                   │ │
│  │                                                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─ Section 4: Results ─────────────── LOCKED ────────────┐ │
│  │  (Unlocks when processing completes)                    │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Visual Design

Follows existing Plexify 2026 brand kit:
- **Background:** Navy-to-purple bokeh gradient (consistent with Home, Deal Room, PlexiCoS)
- **Cards:** Glassmorphism panels with `backdrop-filter: blur(12px)`, `rgba(255,255,255,0.08)` background
- **Upload zone:** Dashed border, 2px, `rgba(107, 47, 217, 0.4)` (Royal Purple at 40%), pulsing glow on hover
- **Progress bar:** Signal Teal `#10B981` fill, glassmorphism track
- **Step indicators:** Teal checkmark (complete), Electric Violet `#8B5CF6` spinner (active), muted gray (pending)
- **Results charts:** Recharts library (already in project dependencies)

---

## 4. Component Tree

```
LinkedInImportPage/
├── LinkedInImportPage.tsx          — Page container, route registration
├── useLinkedInImport.ts            — State machine hook (upload → map → process → results)
├── LinkedInImport.types.ts         — TypeScript interfaces
├── components/
│   ├── UploadSection.tsx           — Drag-and-drop zone + file validation
│   ├── ColumnMappingSection.tsx    — Auto-detected columns + manual override UI
│   ├── ProcessingSection.tsx       — Pipeline progress with step-by-step status
│   ├── ResultsSection.tsx          — Warmth distribution chart + tier summary + CTA
│   ├── WarmthDistributionChart.tsx — Recharts horizontal bar chart (Hot/Strong/Warm/Cold)
│   └── ImportStepIndicator.tsx     — Individual step row (icon + name + time + status)
└── api/
    └── linkedinImportApi.ts        — API client for upload, status polling, results
```

### State Machine (useLinkedInImport hook)

```
IDLE → UPLOADING → VALIDATING → MAPPING → PROCESSING → COMPLETE
  ↑                    ↓           ↓          ↓
  └──── ERROR ←────────┘───────────┘──────────┘
```

| State | UI | User Can |
|-------|----|----------|
| IDLE | Upload zone visible, sections 2-4 locked | Drop file or click to browse |
| UPLOADING | Upload zone shows progress percentage | Cancel |
| VALIDATING | Spinner on Section 1, "Checking your export..." | Wait |
| MAPPING | Section 2 expands with column preview table | Confirm mapping, adjust if needed |
| PROCESSING | Section 3 expands with step-by-step progress | Navigate away (processing continues server-side), cancel pipeline |
| COMPLETE | Section 4 expands with results dashboard | View opportunities, re-import, download report |
| ERROR | Error banner on the failed section with recovery action | Retry, re-upload, or contact support |

---

## 5. Backend Architecture

### 5.1 New API Endpoints

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/api/linkedin-import/upload` | Accept ZIP, extract, validate CSVs, return file manifest | Tenant token |
| POST | `/api/linkedin-import/start` | Kick off pipeline with confirmed column mapping | Tenant token |
| GET | `/api/linkedin-import/status/:jobId` | Poll pipeline progress (step, batch, estimated time) | Tenant token |
| GET | `/api/linkedin-import/results/:jobId` | Fetch completed results (tier distribution, top contacts) | Tenant token |
| POST | `/api/linkedin-import/cancel/:jobId` | Cancel running pipeline | Tenant token |

### 5.2 Upload + Extraction (POST /upload)

**Request:** `multipart/form-data` with ZIP file (max 100MB)

**Server-side logic:**
1. Receive ZIP to temp directory (`/tmp/linkedin-import/{tenantId}/{timestamp}/`)
2. Extract ZIP contents
3. Scan for required files: `Connections.csv` (required), `messages.csv`, `Endorsement_Given_Info.csv`, `Endorsement_Received_Info.csv`, `Recommendations_Given.csv`, `Recommendations_Received.csv`, `Invitations.csv`, `Company Follows.csv` (all optional but affect scoring dimensions)
4. Validate `Connections.csv` — detect disclaimer header, find real header row, count contacts
5. Return manifest:

```json
{
  "jobId": "uuid",
  "files_found": ["Connections.csv", "messages.csv", ...],
  "files_missing": ["Recommendations_Given.csv"],
  "contact_count": 4521,
  "columns_detected": {
    "Connections.csv": ["First Name", "Last Name", "Email Address", "Company", "Position", "Connected On"]
  },
  "column_mapping": {
    "first_name": "First Name",
    "last_name": "Last Name",
    "email": "Email Address",
    "company": "Company",
    "position": "Position",
    "connected_on": "Connected On"
  },
  "auto_mapped": true,
  "scoring_dimensions_available": 5,
  "scoring_dimensions_max": 7
}
```

### 5.3 Column Mapping Adapter

The column mapping must handle:

| Scenario | Detection | Handling |
|----------|-----------|----------|
| Standard English LinkedIn export | Header row matches expected column names exactly | Auto-map, skip mapping UI |
| Disclaimer header (2-line prefix) | First row doesn't contain "First Name" | Skip lines until header detected (existing logic from bug fix `f79e926`) |
| Non-English LinkedIn export | Header row in another language (e.g., "Prénom", "Nom de famille") | Show mapping UI, user maps manually |
| Older export format | Column names differ (e.g., "LinkedIn URL" vs "URL") | Show mapping UI with suggestions based on content sniffing |
| Extra columns | Columns not in expected schema | Ignore silently |
| Missing optional columns | e.g., no "Email Address" column | Proceed, note in manifest that email will be null |

**Required columns (must map or fail):** First Name, Last Name, Company, Position
**Optional columns:** Email Address, Connected On, URL

### 5.4 Pipeline Execution (POST /start)

**Request:**
```json
{
  "jobId": "uuid",
  "column_mapping": { ... },
  "thresholds": { "p0": 65, "p1": 45, "p2": 20 }
}
```

**Server-side:**
1. Create a background job (not blocking the HTTP request)
2. Execute pipeline steps sequentially, updating progress after each
3. Store progress in Supabase `linkedin_import_jobs` table (new)

### 5.5 New Database Table

```sql
CREATE TABLE linkedin_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, processing, complete, error, cancelled
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 7,
  current_batch INTEGER DEFAULT 0,
  total_batches INTEGER DEFAULT 0,
  step_name TEXT,
  contact_count INTEGER,
  files_found TEXT[],
  files_missing TEXT[],
  column_mapping JSONB,
  thresholds JSONB DEFAULT '{"p0": 65, "p1": 45, "p2": 20}',
  results JSONB,  -- tier distribution, top contacts, summary stats
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: tenant can only see their own jobs
ALTER TABLE linkedin_import_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON linkedin_import_jobs
  USING (tenant_id = current_setting('app.tenant_id')::UUID);
```

### 5.6 Progress Polling (GET /status/:jobId)

**Response:**
```json
{
  "jobId": "uuid",
  "status": "processing",
  "current_step": 4,
  "total_steps": 7,
  "step_name": "LLM Classification",
  "current_batch": 23,
  "total_batches": 46,
  "estimated_seconds_remaining": 180,
  "steps": [
    { "step": 1, "name": "Extract & Validate", "status": "complete", "duration_seconds": 4 },
    { "step": 2, "name": "Tier Classification", "status": "complete", "duration_seconds": 12 },
    { "step": 3, "name": "Vertical Tagging", "status": "complete", "duration_seconds": 8 },
    { "step": 4, "name": "LLM Classification", "status": "processing", "progress": 0.50 },
    { "step": 5, "name": "Warmth Extraction", "status": "pending" },
    { "step": 6, "name": "Priority Scoring", "status": "pending" },
    { "step": 7, "name": "Opportunity Import", "status": "pending" }
  ]
}
```

**Polling interval:** 3 seconds during processing. Frontend uses `setInterval` — NOT WebSocket/SSE for v1 (simpler, sufficient for <20min pipeline).

### 5.7 Results (GET /results/:jobId)

```json
{
  "jobId": "uuid",
  "status": "complete",
  "summary": {
    "contacts_processed": 4521,
    "contacts_scored": 3102,
    "opportunities_created": 847,
    "duplicates_skipped": 12,
    "processing_time_seconds": 892
  },
  "warmth_distribution": {
    "hot": { "count": 3, "percentage": 0.4 },
    "strong": { "count": 18, "percentage": 2.1 },
    "warm": { "count": 412, "percentage": 48.6 },
    "cold": { "count": 414, "percentage": 48.9 }
  },
  "priority_distribution": {
    "p0": 3,
    "p1": 15,
    "p2": 189,
    "p3": 640
  },
  "top_contacts": [
    {
      "name": "Jane Smith",
      "company": "Turner Construction",
      "warmth_score": 72,
      "warmth_label": "Strong",
      "priority": "P0",
      "message_count": 87,
      "key_signals": ["mutual endorsement", "company followed", "recommendation given"]
    }
  ],
  "vertical_distribution": {
    "GC": 245,
    "AEC Tech": 189,
    "Developer": 142,
    "MEP/Engineering": 98,
    "Architecture/Design": 67,
    "BID/EcoDev": 14,
    "Untagged": 1092
  },
  "cost_usd": 0.47
}
```

---

## 6. Tenant Isolation

| Concern | Mitigation |
|---------|-----------|
| ZIP file storage | Temp directory scoped to tenant ID: `/tmp/linkedin-import/{tenantId}/` |
| Pipeline execution | Job record includes `tenant_id`; all API queries filter by tenant |
| Opportunity import | Uses tenant's sandbox token; Supabase RLS enforces isolation |
| Results access | GET /results/:jobId checks job belongs to requesting tenant |
| Cleanup | Temp files deleted after pipeline completes (success or failure) |
| Concurrent imports | One active job per tenant enforced at POST /start (return 409 if job running) |

---

## 7. Pipeline Refactoring

The current 7 scripts in `scripts/linkedingraph/` operate on local files with CLI flags. For the UI, they need to be callable as functions (not spawned as child processes).

**Approach:** Extract the core logic from each script into importable modules, keeping the CLI wrappers for power-user access.

```
scripts/linkedingraph/
├── lib/                              — NEW: Shared pipeline logic
│   ├── extract-validate.mjs          — ZIP extraction + CSV validation
│   ├── tier-classifier.mjs           — Rule-based tier classification
│   ├── vertical-tagger.mjs           — Keyword + position heuristic tagging
│   ├── llm-classifier.mjs            — Claude Haiku batch classification
│   ├── warmth-extractor.mjs          — 7-dimension warmth scoring
│   ├── priority-scorer.mjs           — P0-P3 with configurable thresholds
│   └── opportunity-importer.mjs      — API-based import with dedup
├── extract-untagged.mjs              — CLI wrapper (unchanged)
├── classify-companies-llm.mjs        — CLI wrapper (uses lib/llm-classifier)
├── extract-warmth-signals.mjs        — CLI wrapper (uses lib/warmth-extractor)
├── generate-review-queue.mjs         — CLI wrapper (uses lib/priority-scorer)
├── import-linkedin-opportunities.mjs — CLI wrapper (uses lib/opportunity-importer)
├── patch-warmth-existing.mjs         — CLI wrapper (unchanged)
└── run-pipeline.mjs                  — CLI wrapper (unchanged)
```

**Progress callback pattern:** Each `lib/` module accepts an optional `onProgress` callback:

```javascript
// Example: lib/llm-classifier.mjs
export async function classifyCompanies(contacts, options = {}) {
  const { onProgress, dryRun = false, batchSize = 50 } = options;
  
  for (let i = 0; i < batches.length; i++) {
    // ... classification logic ...
    
    if (onProgress) {
      onProgress({
        step: 'llm_classification',
        batch: i + 1,
        totalBatches: batches.length,
        classified: results.length
      });
    }
  }
  
  return results;
}
```

The Express route handler passes `onProgress` callbacks that update the `linkedin_import_jobs` table row in real-time.

---

## 8. Implementation Phases

### Phase A: Upload + Validation (1 session)

| Deliverable | Details |
|-------------|---------|
| Route `/linkedin-import` | Registered before catch-all `:id` |
| `LinkedInImportPage.tsx` | Page container with accordion sections |
| `UploadSection.tsx` | Drag-and-drop with file type validation |
| `POST /api/linkedin-import/upload` | ZIP extraction, CSV detection, column sniffing |
| `linkedin_import_jobs` table | Supabase migration |
| PlexiCoS card link | "Import Network" button on LinkedIn Agent card |

**Exit criteria:** User can drop a ZIP, see detected files and contact count, confirm column mapping.

### Phase B: Pipeline Execution + Progress (1 session)

| Deliverable | Details |
|-------------|---------|
| `scripts/linkedingraph/lib/` modules | Extracted from existing scripts |
| `POST /api/linkedin-import/start` | Kicks off background pipeline |
| `GET /api/linkedin-import/status/:jobId` | Progress polling |
| `ProcessingSection.tsx` | Step-by-step progress UI with batch counts |
| `ImportStepIndicator.tsx` | Individual step row component |
| Resume-safe job state | Pipeline resumes from last completed step on failure |

**Exit criteria:** Pipeline runs server-side. User sees real-time step progress. Pipeline survives a browser tab close and can be resumed.

### Phase C: Results + Polish (1 session)

| Deliverable | Details |
|-------------|---------|
| `GET /api/linkedin-import/results/:jobId` | Results payload |
| `ResultsSection.tsx` | Summary stats + charts |
| `WarmthDistributionChart.tsx` | Recharts horizontal bar |
| "View in Pipeline" CTA | Navigates to Home with filter for newly imported contacts |
| Error state polish | User-friendly messages for all error paths |
| Cleanup | Temp file deletion after completion |
| `POST /api/linkedin-import/cancel/:jobId` | Cancel running pipeline |

**Exit criteria:** Full end-to-end flow from ZIP drop to results dashboard works for Ken, Ben, and Mel tenant tokens.

---

## 9. Acceptance Criteria

| # | Criteria | How to Verify |
|---|----------|---------------|
| 1 | User can upload a LinkedIn Data Export ZIP and see detected files within 5 seconds | Upload Ken's export, observe file manifest |
| 2 | Standard English exports auto-map without user intervention | Upload, confirm auto_mapped: true |
| 3 | Non-standard columns show mapping UI with drag-and-drop | Upload modified CSV with renamed headers |
| 4 | Pipeline progress updates every 3 seconds during processing | Watch ProcessingSection during a real run |
| 5 | User can navigate away and return to see current progress | Start pipeline, close tab, reopen page |
| 6 | Pipeline resumes from last completed step after server restart | Kill server mid-pipeline, restart, verify resume |
| 7 | Results show warmth distribution, priority tiers, and top 10 contacts | Complete a full pipeline run |
| 8 | Tenant A cannot see Tenant B's import jobs or results | Query /status with wrong tenant token → 403 |
| 9 | Concurrent import attempts by same tenant return 409 | POST /start twice → second returns conflict |
| 10 | Temp files are cleaned up after pipeline completes | Check `/tmp/linkedin-import/` after completion |
| 11 | Banned words never appear in any UI copy | Grep page components for "delve", "leverage", "seamless", "transformative" |

---

## 10. What This Does NOT Include (Explicit Scope Boundaries)

| Out of Scope | Why | When |
|-------------|-----|------|
| LinkedIn OAuth API integration | LinkedIn restricts API access; CSV export is the only reliable path today | v1.0 (if LinkedIn opens API) |
| Configurable vertical taxonomy per tenant | AEC verticals are hardcoded; BID verticals differ | v0.4 (after pilot feedback) |
| WebSocket/SSE real-time streaming | Polling at 3s intervals is sufficient for <20min pipeline | PlexiCoS Sprint 3 (if needed) |
| Re-import / update existing contacts | First import only; warmth re-scoring requires separate "refresh" flow | v0.5 |
| Multiple LinkedIn accounts per tenant | One import per tenant for now | v1.0 |
| Mobile-responsive upload | Desktop-first for pilot; BD execs use laptops for this workflow | Post-pilot |

---

## 11. Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|-----------|
| LinkedIn changes export format | Column mapping breaks | Medium | Column mapping adapter with manual override is the mitigation — this is why we're building it |
| Large export (20K+ contacts) causes timeout | Pipeline exceeds server memory or request timeout | Low | Background job pattern prevents timeout; streaming file processing prevents memory issues |
| LLM classification cost spikes | $5+ per import for massive networks | Low | Haiku is $0.25/M input tokens; 20K contacts ≈ $1.00. Display estimated cost before start. |
| User uploads non-LinkedIn ZIP | Confusing error state | Medium | Validate for Connections.csv specifically; clear error message with LinkedIn export instructions |

---

## 12. Estimated Effort

| Phase | Sessions | Calendar Days |
|-------|----------|---------------|
| A: Upload + Validation | 1 | 1 |
| B: Pipeline + Progress | 1 | 1 |
| C: Results + Polish | 1 | 1 |
| **Total** | **3 sessions** | **3 days** |

---

## 13. Open Questions for Ken

1. **Threshold configuration in UI:** Should the user see P0/P1/P2 threshold sliders, or are defaults (65/45/20) hidden behind "Advanced Settings"?
2. **Cost display:** Show estimated LLM cost before pipeline starts? (Useful for transparency, but might scare non-technical users)
3. **Re-import guard:** If a user imports twice, should we update existing opportunities or create duplicates? Current script skips duplicates by `account_name + contact_name`.
4. **PlexiCoS card update:** After import completes, should the LinkedIn Agent card auto-refresh to show new counts, or require page reload?
5. **Navigation entry point:** PlexiCoS Agent card only, or also add to sidebar nav?

---

*Specification prepared for Ken D'Amato review. Upon approval, this becomes the Claude Code implementation prompt for Phases A-C.*
