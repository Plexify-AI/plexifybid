# Claude Code Session: LinkedInGraph Productization — Phase A
## Upload + Validation | March 24, 2026

---

## CONTEXT

You're implementing the LinkedIn Import UI for PlexifyAEC — a self-service page where BD executives upload their LinkedIn Data Export ZIP and get their professional network scored and prioritized. This is Phase A of 3 (Upload + Validation). The full spec is at `docs/specs/LinkedInGraph_Productization_UI_Spec_v1.md` — read it after CLAUDE.md.

**What exists today:** 7 CLI scripts in `scripts/linkedingraph/` that process LinkedIn exports via PowerShell. This phase wraps the upload + validation step in a UI.

**Stack:** React 18 + Vite + TypeScript frontend, Express.js ESM backend, Supabase PostgreSQL with RLS.

**Design:** Navy-to-purple bokeh gradient background, glassmorphism card panels with `backdrop-filter: blur(12px)`, Plexify 2026 brand colors (Deep Louvre Navy `#0D1B3E`, Royal Purple `#6B2FD9`, Signal Teal `#10B981`, Warm Amber `#F59E0B`, Electric Violet `#8B5CF6`).

---

## PHASE A DELIVERABLES

### 1. Supabase Migration — `linkedin_import_jobs` table

```sql
CREATE TABLE linkedin_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
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
  results JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE linkedin_import_jobs ENABLE ROW LEVEL SECURITY;
```

Run this migration against Supabase. Verify the table exists before proceeding.

### 2. Backend — Upload Endpoint

**File:** `server/routes/linkedin-import.js` (new)

**Route:** `POST /api/linkedin-import/upload`
- Auth: Requires tenant sandbox token (same middleware as existing routes)
- Accepts: `multipart/form-data` with a single ZIP file, max 100MB
- Use `multer` for file upload handling (check if already in dependencies, install if not)

**Logic:**
1. Save uploaded ZIP to `/tmp/linkedin-import/{tenantId}/{timestamp}/`
2. Extract ZIP contents using `unzipper` or `adm-zip` (check existing deps first)
3. Scan extracted directory for these files:
   - **Required:** `Connections.csv`
   - **Optional (affect scoring dimensions):** `messages.csv`, `Endorsement_Given_Info.csv`, `Endorsement_Received_Info.csv`, `Recommendations_Given.csv`, `Recommendations_Received.csv`, `Invitations.csv`, `Company Follows.csv`
4. Validate `Connections.csv`:
   - Detect and skip disclaimer header lines (reuse logic from bug fix `f79e926` in `extract-warmth-signals.mjs` — LinkedIn exports have 2-line legal text before the real CSV header)
   - Find actual header row by scanning for "First Name"
   - Count total contacts (rows after header)
   - Detect column names
5. Auto-map columns:
   - If header contains `First Name`, `Last Name`, `Company`, `Position` → auto-map, set `auto_mapped: true`
   - If any required column missing → set `auto_mapped: false`, return detected columns for manual mapping
6. Count scoring dimensions available (how many of the 7 optional files were found)
7. Create a row in `linkedin_import_jobs` with status `pending`, store file manifest
8. Return response:

```json
{
  "jobId": "uuid",
  "files_found": ["Connections.csv", "messages.csv", ...],
  "files_missing": ["Recommendations_Given.csv"],
  "contact_count": 10877,
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

**Route registration:** Register BEFORE the catch-all `:id` route in the Express app. This is critical — catch-all will swallow `/linkedin-import` if registered first.

### 3. Frontend — LinkedInImportPage

**File:** `src/pages/LinkedInImportPage.tsx` (new)

**Route:** `/linkedin-import` — add to React Router config

**Page structure:** Single page with 4 collapsible accordion sections. Only Section 1 (Upload) is active in Phase A. Sections 2-4 render as locked/collapsed placeholders.

**Layout:**
- Full-width page over navy-to-purple bokeh gradient (reuse existing background pattern from Home or Deal Room)
- Glassmorphism container card centered, max-width 800px
- Page title: "LinkedIn Network Import" with subtitle "Import and score your professional network"

### 4. Frontend — UploadSection Component

**File:** `src/pages/linkedin-import/UploadSection.tsx` (new, in subfolder)

**Drag-and-drop zone:**
- Dashed border, 2px, Royal Purple at 40% opacity
- Pulsing glow animation on hover/dragover
- Icon: upload cloud icon (use lucide-react `Upload` or `CloudUpload` if available)
- Text: "Drop your LinkedIn export ZIP here" + smaller "or click to browse"
- Accepts only `.zip` files — reject anything else with inline error message
- On drop/select: show file name + size, begin upload

**Upload state:**
- Show upload progress percentage bar (Signal Teal fill)
- On upload complete: show "Validating your export..." spinner

**Validation result display:**
- Success: Show manifest card with:
  - Contact count (large number, prominent)
  - Files found (green checkmarks) vs files missing (amber warning icons)
  - Scoring dimensions: "5 of 7 warmth dimensions available" with visual indicator
  - Auto-mapped columns in a compact table (2-column: Expected Field → Detected Column)
  - "Start Import" button (disabled in Phase A — placeholder for Phase B)
- Error: Show error message with recovery instructions

### 5. Frontend — State Machine Hook

**File:** `src/pages/linkedin-import/useLinkedInImport.ts` (new)

States for Phase A: `IDLE`, `UPLOADING`, `VALIDATING`, `MAPPING`, `ERROR`
(States `PROCESSING` and `COMPLETE` are Phase B/C — define them but don't implement transitions yet)

```typescript
type ImportState = 'idle' | 'uploading' | 'validating' | 'mapping' | 'processing' | 'complete' | 'error';

interface ImportContext {
  state: ImportState;
  jobId: string | null;
  uploadProgress: number;
  manifest: UploadManifest | null;
  error: string | null;
}
```

### 6. Frontend — API Client

**File:** `src/pages/linkedin-import/linkedinImportApi.ts` (new)

```typescript
export async function uploadLinkedInExport(file: File, onProgress?: (pct: number) => void): Promise<UploadManifest> {
  // POST /api/linkedin-import/upload with FormData
  // Use XMLHttpRequest for upload progress tracking (fetch doesn't support upload progress)
}
```

### 7. Frontend — Types

**File:** `src/pages/linkedin-import/LinkedInImport.types.ts` (new)

Define interfaces for: `UploadManifest`, `ColumnMapping`, `ImportJob`, `ImportStep`, `ImportResults`, `WarmthDistribution`, `TopContact`.

### 8. PlexiCoS Agent Card Link

**File:** `src/pages/PlexiCosAgentsPage.tsx` (existing)

Add an "Import Network" button to the LinkedIn Agent card. On click: `navigate('/linkedin-import')`.

### 9. Placeholder Sections (Sections 2-4)

Create minimal placeholder components for Phase B/C:
- `ColumnMappingSection.tsx` — shows "Column mapping confirmed" when auto_mapped is true, otherwise renders column mapping UI (Phase A: auto-map only, manual mapping UI is a stretch goal)
- `ProcessingSection.tsx` — locked placeholder, shows "Processing will begin after column mapping is confirmed"
- `ResultsSection.tsx` — locked placeholder, shows "Results will appear here after processing completes"

---

## CONSTRAINTS

1. **Read CLAUDE.md first.** Always.
2. **PowerShell only.** No bash, no `&&`.
3. **Route registration order.** `/api/linkedin-import/*` routes MUST register before any catch-all `:id` route.
4. **Banned words.** Never use "delve", "leverage", "seamless", or "transformative" in any UI copy, comments, or generated content.
5. **Commit format.** `feat: add LinkedIn import upload page and validation endpoint`
6. **Report after completing.** List: files created, route registered, Supabase migration applied, PlexiCoS card link wired.
7. **Test the upload endpoint.** After building, POST Ken's LinkedIn export ZIP (`data/linkedin_export/` — you'll need to re-ZIP the directory) to the endpoint and verify the response matches the expected manifest structure. Report the actual response.

---

## EXIT CRITERIA (Phase A)

- [ ] User can navigate from PlexiCoS → LinkedIn Agent card → "Import Network" → `/linkedin-import` page
- [ ] Page renders over bokeh gradient with glassmorphism card
- [ ] Drag-and-drop zone accepts ZIP files, rejects non-ZIP
- [ ] Upload sends ZIP to `POST /api/linkedin-import/upload`
- [ ] Backend extracts ZIP, detects CSVs, counts contacts, auto-maps columns
- [ ] Frontend displays manifest: contact count, files found/missing, scoring dimensions, column mapping
- [ ] `linkedin_import_jobs` row created in Supabase with status `pending`
- [ ] Sections 2-4 render as locked placeholders
- [ ] "Start Import" button visible but disabled (Phase B enables it)
- [ ] No console errors, build succeeds

---

## FILE INVENTORY (what you'll create)

| File | Type |
|------|------|
| `server/routes/linkedin-import.js` | New — Express route |
| `src/pages/LinkedInImportPage.tsx` | New — Page container |
| `src/pages/linkedin-import/UploadSection.tsx` | New — Upload UI |
| `src/pages/linkedin-import/ColumnMappingSection.tsx` | New — Placeholder/auto-map display |
| `src/pages/linkedin-import/ProcessingSection.tsx` | New — Locked placeholder |
| `src/pages/linkedin-import/ResultsSection.tsx` | New — Locked placeholder |
| `src/pages/linkedin-import/useLinkedInImport.ts` | New — State machine hook |
| `src/pages/linkedin-import/linkedinImportApi.ts` | New — API client |
| `src/pages/linkedin-import/LinkedInImport.types.ts` | New — TypeScript interfaces |
| `src/pages/PlexiCosAgentsPage.tsx` | Modified — Add "Import Network" button |
| Supabase migration | New — `linkedin_import_jobs` table |

---

## START

Read CLAUDE.md, then read the full spec at `docs/specs/LinkedInGraph_Productization_UI_Spec_v1.md` (copy it there first from this prompt if it doesn't exist yet). Plan your implementation, show me the plan, then wait for my "approved" before writing code.
