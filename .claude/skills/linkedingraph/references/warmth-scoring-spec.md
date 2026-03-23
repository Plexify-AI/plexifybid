# Warmth Scoring Specification

## Overview

The composite warmth score (0-100) quantifies relationship strength between the pipeline owner
and each LinkedIn contact. It replaces the binary Y/Maybe/empty field from Recipe v0.2.0 with
a multi-dimensional score computed from up to 7 signal sources.

## Scoring Formula

```
warmth_composite = round(
  message_score      * 0.30 +
  reciprocity_score  * 0.15 +
  recency_score      * 0.15 +
  endorsement_score  * 0.15 +
  recommendation_score * 0.10 +
  invitation_score   * 0.10 +
  company_follow_score * 0.05
)
```

All dimension scores normalize to 0-100 before weighting.

## Dimension Scoring Tables

### 1. Message Count (Weight: 0.30)

| Raw Value (msg_total) | Score |
|-----------------------|-------|
| 0 messages | 0 |
| 1-3 messages | 25 |
| 4-10 messages | 50 |
| 11-25 messages | 75 |
| 26+ messages | 100 |

### 2. Reciprocity (Weight: 0.15)

| Raw Value (msg_reciprocity) | Score |
|-----------------------------|-------|
| 0.0 (one-way only or no messages) | 0 |
| 0.01-0.20 | 25 |
| 0.21-0.40 | 50 |
| 0.41-0.70 | 75 |
| 0.71+ (balanced two-way) | 100 |

Reciprocity = min(sent, received) / max(sent, received). Undefined (0/0) maps to 0.

### 3. Recency (Weight: 0.15)

| Raw Value (msg_recency_days) | Score |
|------------------------------|-------|
| 730+ days (2+ years) or no messages | 0 |
| 365-729 days | 25 |
| 180-364 days | 50 |
| 30-179 days | 75 |
| 0-29 days | 100 |

### 4. Endorsements (Weight: 0.15)

| Condition | Score |
|-----------|-------|
| No endorsements in either direction | 0 |
| 1 endorsement one-way | 25 |
| 2-3 endorsements one-way | 50 |
| 4+ endorsements one-way | 75 |
| Mutual endorsements (any count in both directions) | 100 |

### 5. Recommendations (Weight: 0.10)

| Condition | Score |
|-----------|-------|
| No recommendations | 0 |
| Received only (they wrote for owner) | 50 |
| Given only (owner wrote for them) | 75 |
| Mutual recommendations | 100 |

### 6. Invitation Direction (Weight: 0.10)

| Condition | Score |
|-----------|-------|
| Unknown (no invitation data) | 0 |
| Incoming (they found you) | 50 |
| Outgoing without custom message | 75 |
| Outgoing with custom message | 100 |

### 7. Company Follow (Weight: 0.05)

| Condition | Score |
|-----------|-------|
| Not following their company | 0 |
| Following their company | 100 |

## Warmth Labels

| Range | Label | Warm Field (backward-compat) |
|-------|-------|------------------------------|
| 0-25 | Cold | "" (empty) |
| 26-50 | Warm | "Maybe" |
| 51-75 | Strong | "Y" |
| 76-100 | Hot | "Y" |

## Graceful Degradation

When a warmth source file is missing from the export, redistribute its weight proportionally
across available dimensions.

**Example:** If `messages.csv` is missing, the message_count (0.30), reciprocity (0.15), and
recency (0.15) dimensions are all unavailable (total weight: 0.60). Redistribute 0.60 across
the remaining 4 dimensions proportionally:

| Dimension | Normal Weight | Remaining Weight | Scaled Weight |
|-----------|--------------|-----------------|---------------|
| Endorsements | 0.15 | 0.15 | 0.375 |
| Recommendations | 0.10 | 0.10 | 0.250 |
| Invitation | 0.10 | 0.10 | 0.250 |
| Company Follow | 0.05 | 0.05 | 0.125 |
| **Total** | **0.40** | **0.40** | **1.000** |

**Formula:** `scaled_weight = original_weight / sum_of_available_weights`

If ONLY Connections.csv is available (no warmth files at all), compute warmth from
connection tenure only:
- Connected < 6 months: 10
- Connected 6-12 months: 15
- Connected 1-2 years: 20
- Connected 2-5 years: 25
- Connected 5+ years: 30

## Output JSON Structure

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
  "warmth_label": "Strong",
  "warmth_coverage": "7/7",
  "warmth_degraded": false
}
```

## Alignment with PlexifyAEC Warmth Score Doctrine

The composite warmth score (0-100) seeds the PlexifyAEC warmth engine on import.
PlexifyAEC's warmth score is deterministic (0-100) with decay and spam penalty.
The LinkedIn-derived score provides the initial value; PlexifyAEC then applies its own
decay curve and engagement tracking from that starting point.

The `enrichment_data.warmth_dimensions` JSON is preserved on the opportunity record so
that the PlexifyAEC warmth engine can inspect individual signals for re-scoring if needed.
