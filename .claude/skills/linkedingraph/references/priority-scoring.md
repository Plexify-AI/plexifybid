# Priority Scoring Specification

## Overview

Priority scoring assigns P0-P3 tiers to contacts based on composite warmth score
and vertical classification. This determines the order in which contacts appear in
the human review queue.

## P0-P3 Matrix (Enhanced — Composite Warmth Score)

| Priority | Warmth Score | Vertical | Intent | Action |
|----------|-------------|----------|--------|--------|
| P0 — Immediate | 76-100 (Hot) | Known | Real relationship with deep multi-dimensional engagement | Outreach immediately |
| P1 — High | 51-75 (Strong) | Known | Solid connection with multiple warmth signals | Personalized outreach |
| P2 — Review | 26-50 (Warm) | Known | Some engagement signals | Human review for context |
| P3 — Backlog | 1-25 (Cold) | Known | Minimal signal | Park for nurture campaigns |

## Exclusion Rules

Contacts are excluded from the review queue if:
- `warmth_composite = 0` AND `vertical = ''` (no signal at all)
- `vertical = ''` or `vertical = 'Unknown'` (can't route to BD workflow)
- `tier != 'Tier 1'` (only decision-makers in queue)

## Sorting Within Priority Tiers

Within each P-tier, sort by:
1. `warmth_composite` descending (highest warmth first)
2. `msg_total` descending (most messages as tiebreaker)
3. `Last Name` ascending (alphabetical final tiebreaker)

## Gold List

The Gold List is the top slice of contacts — the "call these people this week" list.

**Definition:** Top 10 contacts by warmth_composite across all priority tiers.

**Gold List display includes dimension breakdown:**

| # | Name | Company | Vertical | Warmth | Msgs | Endorse | Rec? | Invite | Follow |
|---|------|---------|----------|--------|------|---------|------|--------|--------|
| 1 | ... | ... | ... | 92 | 44 | 3G/1R | Mutual | Outgoing | Yes |

Where:
- Msgs = msg_total
- Endorse = "{given}G/{received}R" (Given/Received)
- Rec? = "Mutual", "Given", "Received", or "—"
- Invite = "Outgoing", "Incoming", or "—"
- Follow = "Yes" or "—"

## Backward Compatibility with Recipe v0.2.0

The v0.2.0 recipe used this simpler matrix:

| Priority | Criteria (v0.2.0) |
|----------|-------------------|
| P0 | Warm=Y AND msg_total >= 10 |
| P1 | Warm=Y AND msg_total < 10 |
| P2 | Warm=Maybe AND msg_total >= 5 |
| P3 | Warm=Maybe AND msg_total < 5 |

The enhanced matrix produces similar results because:
- warmth_composite >= 76 (Hot) roughly corresponds to Warm=Y + high message count
- warmth_composite 51-75 (Strong) roughly corresponds to Warm=Y + moderate signals
- The additional dimensions (endorsements, recommendations, invitations) promote contacts
  that had weaker message history but strong relationship signals

## Configurability (Future — Per-Tenant)

These parameters should be configurable per tenant in future versions:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `p0_threshold` | 76 | Minimum warmth for P0 |
| `p1_threshold` | 51 | Minimum warmth for P1 |
| `p2_threshold` | 26 | Minimum warmth for P2 |
| `min_warmth_for_queue` | 1 | Minimum warmth to enter queue |
| `require_vertical` | true | Whether untagged contacts are excluded |
| `vertical_weights` | {} | Per-vertical warmth bonus (e.g., GC +5) |
| `recency_weight_override` | null | Override recency weight for time-sensitive campaigns |
| `gold_list_size` | 10 | Number of contacts in Gold List |

## Connection to PlexifyAEC Warmth Decay Engine

On import, `warmth_composite` seeds the PlexifyAEC opportunity's `warmth_score` field.
From that point, PlexifyAEC's own warmth engine takes over with:
- Time-based decay curve
- Engagement bonus (opens, replies, meetings)
- Spam penalty (excessive outreach without response)

The LinkedIn-derived score provides a strong starting signal that prevents cold-start
problems in the PlexifyAEC warmth engine.
