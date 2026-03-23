# Tier Classification Rules

## Overview

Every contact in Connections.csv is assigned a tier based on their Position field.
Tier determines whether the contact enters the BD pipeline at all.

## Tier Definitions

### Tier 1 — Decision Maker

Position contains any of (case-insensitive):
- VP, Vice President
- Director
- President
- CEO, Chief Executive Officer
- CFO, Chief Financial Officer
- COO, Chief Operating Officer
- CTO, Chief Technology Officer
- CIO, Chief Information Officer
- CMO, Chief Marketing Officer
- Owner
- Partner
- Principal
- Managing Director, Managing Partner, Managing Member
- Head of
- Chief (any "Chief X Officer" pattern)
- Founder, Co-Founder
- General Manager, GM
- EVP, SVP

**These are the primary pipeline targets.** All downstream phases (warmth, LLM, priority)
operate on Tier 1 contacts only.

### Tier 2 — Influencer

Position contains any of (case-insensitive):
- Manager (but NOT "Project Manager" which maps to GC vertical Tier 1)
- Lead
- Senior
- Architect (non-building context — software, solutions, enterprise)
- Engineer (software, systems, data — not civil/structural/mechanical which maps to MEP)
- Coordinator
- Specialist
- Analyst
- Consultant
- Advisor

**Tier 2 contacts are tracked but not in the primary pipeline.** They may be promoted
to Tier 1 during human review if context warrants it.

### Tier 3 — Network

All contacts with a recognized company name that don't match Tier 1 or Tier 2 patterns.

**Stored for network mapping but not actively pursued.**

### Tier 4 — Passive

Contacts matching any of:
- Empty Company field
- Generic company names: "Self-Employed", "Freelance", "Independent", "N/A", "—", "Retired"
- Empty Position field AND empty Company field

**Excluded from pipeline entirely.**

## Edge Cases

| Scenario | Resolution |
|----------|-----------|
| "VP of Engineering" | Tier 1 (VP takes precedence) |
| "Senior Vice President" | Tier 1 (SVP) |
| "Project Manager at Turner Construction" | Tier 1 (PM in GC context is decision-maker) |
| "Software Architect at Procore" | Tier 2 (non-building architect) |
| "Structural Engineer at Thornton Tomasetti" | Tier 1 (senior technical role at engineering firm) |
| "Student at Columbia University" | Tier 4 (no BD value) |
| "Seeking new opportunities" | Tier 4 (transitional) |
| Position is empty but Company is known | Tier 3 (network) |

## Pipeline Statistics (Ken's Network Benchmark)

- Total connections: 11,281
- Tier 1 (Decision Maker): 3,214 (28.5%)
- Tier 2 (Influencer): ~2,800
- Tier 3 (Network): ~3,500
- Tier 4 (Passive): ~1,700

Only Tier 1 contacts proceed through the full pipeline (warmth scoring, LLM classification,
priority queue, import).
