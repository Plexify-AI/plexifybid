# Import Mapping Specification

## CSV to API Field Mapping

| Source Field | API Field | Transform | Required |
|-------------|-----------|-----------|----------|
| Company | `account_name` | Direct copy. Skip row if empty. | Yes |
| First Name + " " + Last Name | `contact_name` | Concatenated with space | Yes |
| Email Address | `contact_email` | Direct copy (often null) | No |
| Position | `contact_title` | Direct copy | No |
| (Computed) | `deal_hypothesis` | See template below | No |
| (Computed) | `enrichment_data` | Full warmth JSON, see structure below | No |

### deal_hypothesis Template

```
{Vertical} prospect, {Priority}, Warmth: {warmth_composite}/100, {msg_total} messages.
Top signals: {top_signal_1}, {top_signal_2}.
Imported from LinkedInGraph Agent.
```

Example:
```
GC prospect, P0, Warmth: 87/100, 44 messages.
Top signals: mutual recommendations, balanced reciprocity (0.72).
Imported from LinkedInGraph Agent.
```

### enrichment_data JSON Structure

```json
{
  "source": "linkedingraph",
  "pipeline_version": "1.0.0",
  "import_date": "2026-03-23T14:30:00Z",
  "linkedin_url": "https://www.linkedin.com/in/john-smith-123abc",
  "connected_on": "2024-03-15",
  "tier": "Tier 1",
  "vertical": "GC",
  "priority": "P0",
  "warmth_composite": 87,
  "warmth_label": "Hot",
  "warmth_dimensions": {
    "message_count": { "raw": 44, "score": 100 },
    "reciprocity": { "raw": 0.72, "score": 100 },
    "recency": { "raw": 45, "score": 75 },
    "endorsements": { "raw": { "given": 3, "received": 1 }, "score": 100 },
    "recommendations": { "raw": { "given": true, "received": true }, "score": 100 },
    "invitation": { "raw": "outgoing", "score": 100 },
    "company_follow": { "raw": true, "score": 100 }
  },
  "notes": "44 msgs (22 sent, 22 received), last: Feb 2026"
}
```

## Server-Side Defaults

These fields are set by the server, not the import script:

| Field | Default Value | Source |
|-------|--------------|--------|
| `stage` | `'prospecting'` | Hardcoded |
| `warmth_score` | `warmth_composite` | From enrichment_data |
| `tenant_id` | From auth token | sandboxAuth middleware |
| `created_at` | `now()` | Database default |
| `updated_at` | `now()` | Database default |

## Deduplication Logic

Before creating an opportunity, check for existing records matching:

```sql
SELECT id FROM opportunities
WHERE tenant_id = $1
  AND LOWER(account_name) = LOWER($2)
  AND LOWER(contact_name) = LOWER($3)
```

If a match exists, skip the row and increment the `duplicates_skipped` counter.

## CLI Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--dry-run` | false | Print what would be created without making API calls |
| `--limit N` | unlimited | Only import the first N rows from the queue |
| `--base-url URL` | `http://localhost:3000` | API base URL |
| `--start-from N` | 0 | Resume from row N (for crash recovery) |

## Auth Requirements

The import script reads `PLEXIFY_SANDBOX_TOKEN` from `.env.local`:

```
PLEXIFY_SANDBOX_TOKEN=pxs_678b89a496e9a43f25e64ac3c8ef057db9cd7be48082ebd5
```

This token is sent as `Authorization: Bearer {token}` on every API call.

## Rate Limiting

- Delay: 1500ms between POST requests
- On 429 response: sleep 65 seconds, then retry the same request
- Max retries per request: 3
- On 3 consecutive failures: abort and save progress

## Progress Tracking

After each successful import, update `data/linkedingraph_import_progress.json`:

```json
{
  "started_at": "2026-03-23T14:30:00Z",
  "last_updated": "2026-03-23T14:35:22Z",
  "total_rows": 222,
  "processed": 150,
  "created": 145,
  "skipped_duplicate": 3,
  "skipped_no_company": 2,
  "errors": 0,
  "imported_keys": [
    "turner construction|john smith",
    "skanska|jane doe"
  ]
}
```

On resume, the script reads this file and skips any row whose `lowercase(account_name)|lowercase(contact_name)` key is in `imported_keys`.

## Error Handling

| Error | Action |
|-------|--------|
| 429 Too Many Requests | Sleep 65s, retry (max 3) |
| 401 Unauthorized | Abort — token invalid or expired |
| 400 Bad Request | Log error, skip row, continue |
| 500 Server Error | Retry once, then skip and log |
| Network error | Retry once, then abort and save progress |
| Empty account_name | Skip row (required field) |
| Empty contact_name | Use "Unknown Contact" as fallback |
