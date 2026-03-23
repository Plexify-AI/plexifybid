# LinkedIn Data Export — Data Schema Reference

## Full Export Inventory (44 CSVs)

LinkedIn's "Get a copy of your data" export contains ~44 CSV files. They are grouped below
by BD signal value for the LinkedInGraph pipeline.

### Tier A — Primary Pipeline Files (Required/High-Value)

| File | BD Signal | Columns Used | Notes |
|------|-----------|-------------|-------|
| `Connections.csv` | **Required** | All 12 | Primary contact list. Pipeline fails without this. |
| `messages.csv` | **High** | 11 cols | Message history for warmth scoring. Pipeline degrades without this. |

### Tier B — Warmth Signal Files (Optional, High-Value)

| File | BD Signal | Key Columns | Warmth Dimension |
|------|-----------|-------------|-----------------|
| `Endorsement_Given_Info.csv` | Endorsement given | Endorsee Public Url, Skill Name | endorsements_given |
| `Endorsement_Received_Info.csv` | Endorsement received | Endorser Public Url, Skill Name | endorsements_received |
| `Recommendations_Given.csv` | Recommendation given | First Name, Last Name, Company, Recommendation Text | recommendation_given |
| `Recommendations_Received.csv` | Recommendation received | First Name, Last Name, Company, Recommendation Text | recommendation_received |
| `Invitations.csv` | Invitation direction | inviterProfileUrl, inviteeProfileUrl, Message | invitation_direction |
| `Company Follows.csv` | Company engagement | Organization, Following Date | company_followed |

### Tier C — Context Files (Optional, Low Signal)

| File | Use | Notes |
|------|-----|-------|
| `Profile.csv` | Owner identity for message matching | Name, URL, headline |
| `Positions.csv` | Owner career history | For relationship-timing context |
| `Events.csv` | Event co-attendance | Secondary signal, not scored in v1.0 |
| `Ad_Targeting.csv` | LinkedIn's ad profile of user | Useful for self-knowledge, not BD signal |
| `Skills.csv` | Owner's skill list | For affinity matching (future) |

### Tier D — Not Used by Pipeline

Everything else: `Certifications.csv`, `Education.csv`, `Learning.csv`, `Reactions.csv`,
`Registration.csv`, `Rich Media.csv`, `Search Queries.csv`, `Security Challenges.csv`,
`Shares.csv`, `Votes.csv`, and many more. Safely ignored.

---

## Column Specifications

### Connections.csv (12 Columns)

```
First Name, Last Name, URL, Email Address, Company, Position, Connected On, Notes, Tier, Vertical, Warm, Priority
```

| Column | Type | Notes |
|--------|------|-------|
| First Name | String | May be empty for withdrawn accounts |
| Last Name | String | **Quoting hazard**: suffixes like "Jr.", "III" may contain commas when quoted |
| URL | String | Full URL: `https://www.linkedin.com/in/slug` |
| Email Address | String | Often empty — LinkedIn stopped exporting emails for most users |
| Company | String | **Quoting hazard**: company names with commas (e.g., "Smith, Jones & Associates") |
| Position | String | **Quoting hazard**: titles with commas (e.g., "VP, Sales & Marketing") |
| Connected On | Date | Format: `DD Mon YYYY` (e.g., `15 Mar 2024`) |
| Notes | String | User-added notes. May contain message history with embedded newlines. |
| Tier | String | Added by pipeline: `Tier 1`, `Tier 2`, `Tier 3`, `Tier 4` |
| Vertical | String | Added by pipeline: GC, AEC Tech, Developer, MEP/Engineering, etc. |
| Warm | String | Added by pipeline: `Y`, `Maybe`, or empty |
| Priority | String | Added by pipeline: `P0`, `P1`, `P2`, `P3` |

**Critical:** The first 8 columns come from LinkedIn. Columns 9-12 are added by the pipeline.
The raw LinkedIn export only has columns 1-8.

**CSV Parsing Rules:**
- Fields containing commas are enclosed in double quotes
- Fields containing double quotes escape them by doubling: `""example""`
- Fields containing newlines are enclosed in double quotes
- NEVER use `split(',')` — use csv-parse or papaparse with `quote: true, relax_column_count: true`
- LinkedIn sometimes produces slightly malformed CSV — use `relax_column_count: true`

### messages.csv (11 Columns)

```
CONVERSATION ID, CONVERSATION TITLE, FOLDER, CONTENT, CONTENT TYPE, DATE, FROM, SENDER PROFILE URL, TO, RECIPIENT PROFILE URLS, SUBJECT
```

| Column | Type | Notes |
|--------|------|-------|
| CONVERSATION ID | String | Groups messages into conversations |
| CONVERSATION TITLE | String | Auto-generated from participants. Filter out `'Sponsored Conversation'` |
| FOLDER | String | `INBOX` or `SPAM`. Filter out `SPAM`. |
| CONTENT | String | Message body text |
| CONTENT TYPE | String | Usually `text/plain` |
| DATE | Datetime | ISO-ish format: `2024-03-15 14:23:45 UTC` |
| FROM | String | Sender display name |
| SENDER PROFILE URL | String | Full LinkedIn URL of sender. NULL for system messages — filter these out. |
| TO | String | Recipient display name(s) |
| RECIPIENT PROFILE URLS | String | Comma-separated LinkedIn URLs. May be multi-valued for group conversations. |
| SUBJECT | String | Often empty for DMs |

**Filtering rules:**
- Exclude: `FOLDER = 'SPAM'`
- Exclude: `CONVERSATION TITLE = 'Sponsored Conversation'`
- Exclude: `SENDER PROFILE URL IS NULL` (system/notification messages)
- For group conversations: count messages per participant, not per conversation

### Endorsement_Given_Info.csv

```
Endorsement Date, Skill Name, Endorsee First Name, Endorsee Last Name, Endorsee Public Url, Status
```

**URL format note:** `Endorsee Public Url` uses `www.linkedin.com/in/slug` (NO `https://` prefix).
Connections.csv uses `https://www.linkedin.com/in/slug`. Normalize before matching.

### Endorsement_Received_Info.csv

```
Endorsement Date, Skill Name, Endorser First Name, Endorser Last Name, Endorser Public Url, Status
```

Same URL format note as above.

### Recommendations_Given.csv

```
First Name, Last Name, Company, Created Date, Status, Recommendation Text
```

**No profile URL.** Match by First Name + Last Name (case-insensitive).
Ambiguity risk: common names may match multiple contacts. Use Company as tiebreaker.

### Recommendations_Received.csv

```
First Name, Last Name, Company, Created Date, Status, Recommendation Text
```

Same matching rules as Recommendations_Given.

### Invitations.csv

```
From, To, Date Sent, Message, Direction, inviterProfileUrl, inviteeProfileUrl
```

- `Direction`: `OUTGOING` (owner sent) or `INCOMING` (they sent to owner)
- `Message`: custom invite message text (empty if generic "I'd like to connect")
- Match contact by `inviterProfileUrl` (if OUTGOING) or `inviteeProfileUrl` (if INCOMING)

### Company Follows.csv

```
Organization, Following Date
```

- Match against contact's Company field
- Case-insensitive matching
- Strip common suffixes before comparison: Inc., LLC, Corp., Ltd., Co., Group, Holdings

---

## URL Normalization

Different LinkedIn export files use different URL formats. Normalize all to a common form
before matching:

```
Input:  https://www.linkedin.com/in/john-smith-123abc
Input:  www.linkedin.com/in/john-smith-123abc
Input:  http://www.linkedin.com/in/john-smith-123abc
Output: linkedin.com/in/john-smith-123abc
```

Algorithm:
1. Strip protocol (`https://`, `http://`)
2. Strip `www.` prefix
3. Strip trailing slashes
4. Lowercase the entire string
