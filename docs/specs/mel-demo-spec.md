# Mel Wallace Demo — Technical Specification v1.0

**Feature:** Live Prospecting Agent Demo  
**Author:** Ken D'Amato + Claude Sr. Dev  
**Date:** February 4, 2026  
**Deadline:** Thursday, February 6, 2026 EOD  
**Demo Dates:** Friday, February 7 (Casual Discovery) / Tuesday, February 11 (Full Demo)  
**Branch:** `feature/mel-demo-prospecting`  
**Stakes:** If we land Mel, we land Hexagon. If we land Hexagon, we land the AEC industry.

---

## Executive Summary

This spec defines a targeted demo for Mel Wallace, Director of Sales at Hexagon Multivista. The demo shows how Mel would use Plexify to prospect for HIS sales targets — NYC commercial construction projects where Multivista could sell documentation services (360° photo, laser scanning, MEP Exact-Built®, forensic documentation).

The demo takes Mel from "47 prospects" → "top 3 prioritized by warmth score" → "personalized outreach drafted" → "win probability scored" in under 5 minutes.

**This is not a generic feature.** It's a sales weapon built for a specific buyer. The goal: Mel says "Holy shit, this would save me 15 hours a week."

---

# PHASE 1: SPECIFICATION — THE "WHAT & WHY"

## 1.1 Overview

The Live Prospecting Agent demo showcases three Plexify agents working together to automate BD prospecting for AEC sales executives:

1. **Place Graph Analyst** — Queries Dodge-style project data, applies ICP filters, calculates "warmth scores"
2. **Ask Plexi** — Generates personalized outreach emails with project-specific details
3. **NotebookBD RAG** — Scores win probability with cited rationale and recommendations

**Demo Premise:** Mel is a Hexagon Multivista sales exec looking for projects to pitch. Plexify shows him his best prospects from Dodge-style construction data, drafts personalized outreach, and predicts his win probability.

**Value Proposition:** "This saves you 15 hours/week on prospecting."

## 1.2 Target User: Mel Wallace

| Attribute | Value |
|-----------|-------|
| **Name** | Mel Wallace |
| **Title** | Director of Sales, North America |
| **Company** | Hexagon Multivista ($32B parent) |
| **What He Sells** | Construction documentation services: 360° photo, laser scanning, MEP Exact-Built®, drone aerials, forensic documentation |
| **His Customers** | GCs, owners, developers on commercial construction projects |
| **Pain Points** | Prospecting at scale (100s of projects in Dodge), outreach personalization, identifying warm intros, predicting which deals to prioritize |
| **What He Wants** | Hit revenue targets with lean team. Find best prospects faster. Close more deals. |
| **Sophistication** | 20+ years AEC tech sales. Has seen 1,000 demos. Generic AI pitches won't work. |

## 1.3 User Scenario

```
GIVEN  Mel is on a discovery call with Ken
AND    he's skeptical of another AI tool pitch
WHEN   Ken says "Let me show you how Plexify finds your best Multivista prospects"
AND    types "Show me my best prospects for Q1" into Plexify
THEN   Mel sees 47 projects from Dodge data filtered to his ICP
AND    3 top prospects ranked by "warmth score" with:
       - Project name, GC, owner, value, phase (Dodge-style data)
       - Key contact with LinkedIn connection status
       - Pain point Multivista solves
       - Warm intro path
       - Suggested Multivista service to lead with
AND    when Mel says "Draft outreach for #1"
THEN   he sees a personalized email referencing:
       - Specific project and pain point
       - Relevant Multivista case study with ROI
       - Mutual connection for warm intro
       - Calendar link CTA
AND    when Mel says "What's my win probability?"
THEN   he sees a score (e.g., 73%) with factor breakdown and recommendation
AND    Mel says "Holy shit, this would save me 15 hours a week"
```

## 1.4 Demo Flow (3 Steps, <5 minutes total)

### Step 1: Prospect Query (~90 seconds)

**Trigger:** "Show me my best prospects for Q1"

**System Response:**
```
[Place Graph Analyst activates]

Scanning Dodge Construction Central data...
Applying Multivista ICP filters...

47 projects match your criteria

Top 3 by warmth score:

┌─────────────────────────────────────────────────────────────────────┐
│ #1  3 HUDSON BOULEVARD                               Warmth: 87/100 │
├─────────────────────────────────────────────────────────────────────┤
│ Dodge #: 2026-NYC-0847231                                           │
│ Type: Office Tower (Class A)  │  SF: 2,100,000  │  Floors: 56       │
│ Value: $2.1B                  │  Stage: Construction - Month 2      │
│                                                                     │
│ Owner: Brookfield Properties                                        │
│ GC: Tishman Construction Corp                                       │
│ Architect: Kohn Pedersen Fox                                        │
│                                                                     │
│ 👤 CONTACT: Sarah Chen, Project Executive                           │
│    └─ LinkedIn: 2nd degree (via Mike Rodriguez @ Turner)            │
│                                                                     │
│ 🎯 PAIN POINT: 18-floor MEP coordination across 12 trades           │
│    └─ High-risk for as-built documentation disputes                 │
│                                                                     │
│ 🔥 WARM INTRO: Mike Rodriguez — you've closed 3 deals via Mike      │
│                                                                     │
│ 💡 LEAD WITH: MEP Exact-Built® — reference Brookfield Manhattan     │
│    West case study ($127K rework avoided)                           │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ #2  PENN STATION REDEVELOPMENT                       Warmth: 79/100 │
├─────────────────────────────────────────────────────────────────────┤
│ Dodge #: 2025-NYC-0721456                                           │
│ Type: Transit/Mixed-Use       │  SF: 1,800,000  │  Floors: 10       │
│ Value: $1.6B                  │  Stage: Preconstruction - Design    │
│                                                                     │
│ Owner: Empire State Development / MTA / Amtrak (JV)                 │
│ GC: Skanska USA Building                                            │
│ Architect: SOM                                                      │
│                                                                     │
│ 👤 CONTACT: James O'Brien, VP of Operations                         │
│    └─ LinkedIn: Not connected                                       │
│                                                                     │
│ 🎯 PAIN POINT: Multi-stakeholder reporting (MTA + Amtrak + ESD)     │
│    └─ 3 owners = 3x documentation requirements                      │
│                                                                     │
│ 📧 ENGAGEMENT: Downloaded "Forensic Documentation" whitepaper 3x    │
│                                                                     │
│ 💡 LEAD WITH: 360° Progress Documentation — reference Hudson Yards  │
│    stakeholder portal case study                                    │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ #3  ONE MADISON TOWER                                Warmth: 74/100 │
├─────────────────────────────────────────────────────────────────────┤
│ Dodge #: 2026-NYC-0892103                                           │
│ Type: Residential Luxury      │  SF: 650,000    │  Floors: 62       │
│ Value: $890M                  │  Stage: Construction - Month 6      │
│                                                                     │
│ Owner: SL Green Realty                                              │
│ GC: Turner Construction                                             │
│ Architect: Kohn Pedersen Fox                                        │
│                                                                     │
│ 👤 CONTACT: David Park, Senior PM                                   │
│    └─ LinkedIn: 1st degree connection                               │
│                                                                     │
│ 🎯 PAIN POINT: Change order disputes with owner over finishes       │
│    └─ High-end residential = high scrutiny on installed quality     │
│                                                                     │
│ 🤝 HISTORY: Met at ENR Awards 2025                                  │
│                                                                     │
│ 💡 LEAD WITH: Forensic Documentation — reference 432 Park case      │
│    study (dispute resolution support)                               │
└─────────────────────────────────────────────────────────────────────┘

[View All 47]  [Adjust Filters]  [Export to CRM]
```

### Step 2: Outreach Generation (~60 seconds)

**Trigger:** "Draft outreach for number 1"

**System Response:**
```
[Ask Plexi activates]

Generating personalized outreach for Sarah Chen @ 3 Hudson Boulevard...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

To: sarah.chen@tishman.com
Subject: MEP Documentation for 3 Hudson Boulevard
Preheader: How we saved Brookfield $127K on Manhattan West

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Hi Sarah,

Congrats on the 3 Hudson Boulevard kickoff — what a landmark project 
for Midtown West. 56 floors of Class A office is no small feat.

Having supported Tishman on several towers, I know the MEP 
coordination complexity you're facing, especially across 18 floors 
with 12 different mechanical trades. Hidden conditions behind 
drywall become expensive surprises.

We recently helped Brookfield on Manhattan West avoid $127K in MEP 
rework using our Exact-Built® documentation — capturing every 
installation before walls close. Mike Rodriguez at Turner suggested 
I reach out; he mentioned you're always looking for ways to de-risk 
coordination.

Would a 15-minute call next week work to show you how this applies 
to 3 Hudson? I can share the Manhattan West case study.

Best,
Mel Wallace
Director of Sales | Hexagon Multivista
mel.wallace@hexagon.com | 📅 Book time: [calendly.com/melwallace]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Email Stats:
Word count: 142  │  Reading time: 35 sec  │  Personalization score: 94%

✓ Project name referenced       ✓ Pain point addressed
✓ Case study with ROI           ✓ Warm intro mentioned
✓ Clear CTA                     ✓ Signature complete

[📋 Copy to Clipboard]  [✏️ Edit]  [🔄 Generate Variant]
```

### Step 3: Win Probability (~60 seconds)

**Trigger:** "What's my win probability on this?"

**System Response:**
```
[NotebookBD RAG activates]

Analyzing deal factors for 3 Hudson Boulevard × Multivista...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WIN PROBABILITY                                                    73%
████████████████████████████████████░░░░░░░░░░░░░░

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

POSITIVE FACTORS                                              IMPACT
─────────────────────────────────────────────────────────────────────
✅ Warm intro via Mike Rodriguez                               +25%
   └─ Your close rate is 3.2x higher with warm intros
   
✅ Similar past win (Brookfield Manhattan West)                 +20%
   └─ Same GC (Tishman), same service (MEP Exact-Built®)
   
✅ Optimal timing (Month 2 of construction)                     +15%
   └─ MEP rough-in starts Month 3 — perfect entry window
   
✅ Decision maker identified (Sarah = Project Exec)             +13%
   └─ Budget authority confirmed via org chart
                                                              ──────
                                                                +73%

RISK FACTORS                                                  IMPACT
─────────────────────────────────────────────────────────────────────
⚠️ Incumbent unknown                                           -10%
   └─ No intel on current documentation vendor
   
⚠️ No prior Tishman corporate relationship                      -5%
   └─ Win was via Brookfield, not Tishman direct
                                                              ──────
                                                                -15%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NET WIN PROBABILITY                                             73%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 RECOMMENDATION:

Lead with the Mike Rodriguez intro — your historical data shows 
68% close rate with his referrals vs. 21% cold outreach. 

Offer an on-site demo within 2 weeks to establish presence before 
incumbent can respond. Bring the Manhattan West case study binder 
showing the actual $127K rework avoided.

Timeline: MEP rough-in starts Month 3. You have 4 weeks to close 
before they're committed to a documentation workflow.

[📥 Add to Pipeline]  [⏰ Set Follow-up]  [📊 View Similar Wins]
```

## 1.5 Functional Requirements

### Demo Infrastructure

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | System SHALL display a chat-style interface for natural language queries | Must |
| FR-002 | System SHALL show agent activation indicator (e.g., "[Place Graph Analyst activates]") | Must |
| FR-003 | System SHALL render prospect cards with Dodge-style project data | Must |
| FR-004 | System SHALL render email preview with subject, preheader, body, signature, and stats | Must |
| FR-005 | System SHALL render win probability with visual bar, factor breakdown, and recommendation | Must |
| FR-006 | System SHALL display "Demo Mode" badge for transparency | Must |
| FR-007 | System SHALL complete full demo flow in <5 minutes | Must |
| FR-008 | System SHALL NOT show loading states >2 seconds (instant feel) | Must |

### Prospect Query (Step 1)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-009 | System SHALL display Dodge-style project data: Dodge #, type, SF, floors, value, stage, owner, GC, architect | Must |
| FR-010 | System SHALL calculate warmth score (0-100) based on weighted factors | Must |
| FR-011 | System SHALL return top 3 prospects sorted by warmth score | Must |
| FR-012 | Each prospect SHALL show: contact, LinkedIn status, pain point, warm intro path, suggested Multivista service | Must |
| FR-013 | System SHALL show total matching projects before top 3 | Should |
| FR-014 | Pain points SHALL be specific to services Multivista sells | Must |

### Outreach Generation (Step 2)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-015 | Email SHALL include: subject (<60 chars), preheader with ROI hook, personalized body | Must |
| FR-016 | Email body SHALL reference: project name, specific pain point, case study with dollar ROI, warm intro, clear CTA | Must |
| FR-017 | Email SHALL include Mel's signature block (Hexagon Multivista) | Must |
| FR-018 | System SHALL display email stats: word count, reading time, personalization score | Should |
| FR-019 | System SHALL provide Copy to Clipboard action | Must |
| FR-020 | System SHALL provide Generate Variant action | Should |

### Win Probability (Step 3)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-021 | System SHALL display win probability 0-100% with visual progress bar | Must |
| FR-022 | System SHALL list positive factors with weights and explanations | Must |
| FR-023 | System SHALL list risk factors with weights and explanations | Must |
| FR-024 | System SHALL provide actionable recommendation with specific next steps | Must |
| FR-025 | Recommendation SHALL include timeline context (e.g., "MEP rough-in starts Month 3") | Should |

### Demo Mode Features

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-026 | System SHALL pre-load Mel's ICP (no configuration during demo) | Must |
| FR-027 | System SHALL provide quick-access buttons for 3 demo queries | Should |
| FR-028 | System SHALL provide reset button to restart demo | Should |

## 1.6 Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Demo completion | <5 minutes | Timer |
| Mel reaction | "Holy shit" equivalent | Verbal |
| Follow-up secured | Yes | Call outcome |
| Founding Customer signed | By Feb 11 | Contract |

## 1.7 Out of Scope

| Item | Why |
|------|-----|
| Real Dodge API integration | Mock data sufficient. Real = Sprint 4+. |
| Real LinkedIn API | Privacy concerns. Mock connection data. |
| CRM integration | Demo standalone. Production feature later. |
| Email sending | Copy-to-clipboard only. |
| Error handling | Happy path only. Demo won't fail if scripted. |

---

# PHASE 2: SPECIFICATION — THE "HOW"

## 2.1 Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Mel Demo Feature                             │
│                   src/features/mel-demo/                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │  DemoChat    │───▶│ DemoEngine   │───▶│  MockData    │          │
│  │  (UI)        │    │ (router)     │    │  (JSON)      │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
│         │                   │                                       │
│         ▼                   ▼                                       │
│  ┌──────────────┐    ┌──────────────┐                              │
│  │ ProspectCard │    │  AgentSim    │  ← Simulates agent responses │
│  │ EmailPreview │    │  (mock LLM)  │    for demo reliability      │
│  │ WinProbCard  │    └──────────────┘                              │
│  └──────────────┘                                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Why Mocked (Not Real Agents):**
- **Reliability:** Demo cannot fail. Mock = deterministic.
- **Speed:** Mock responses <500ms vs. real RAG 3-10s.
- **Control:** Script requires specific outputs (3 Hudson, Sarah Chen, 73%).

## 2.2 Data Model — Dodge-Style Mock Data

### File Structure

```
src/features/mel-demo/data/
├── projects.json       # 47 NYC commercial construction projects
├── contacts.json       # Key contacts at GCs/owners
├── connections.json    # Mel's network (warm intro paths)
├── case-studies.json   # Multivista success stories with ROI
├── deals.json          # Historical win/loss data
└── icp-config.json     # Mel's ICP filter settings
```

### projects.json — Dodge-Style Schema

```typescript
interface DodgeProject {
  id: string;
  dodgeNumber: string;              // "2026-NYC-0847231"
  
  // Basic Info
  name: string;                     // "3 Hudson Boulevard"
  type: string;                     // "Office Tower (Class A)"
  buildingTypeCode: string;         // "OFF-A"
  
  // Size & Value
  squareFeet: number;               // 2100000
  squareFeetDisplay: string;        // "2,100,000 SF"
  floors: number;                   // 56
  value: number;                    // 2100000000
  valueDisplay: string;             // "$2.1B"
  
  // Stage (Dodge-style)
  stage: 'planning' | 'design' | 'bid' | 'award' | 'construction' | 'closeout';
  stageDetail: string;              // "Construction - Month 2"
  constructionStart?: string;       // "2025-12-01"
  estimatedCompletion?: string;     // "2028-06-01"
  
  // Location
  address: string;                  // "555 W 34th St"
  city: string;                     // "New York"
  borough: string;                  // "Manhattan"
  neighborhood: string;             // "Hudson Yards"
  state: string;                    // "NY"
  zip: string;                      // "10001"
  
  // Key Players
  owner: string;                    // "Brookfield Properties"
  gc: string;                       // "Tishman Construction Corp"
  gcSlug: string;                   // "tishman"
  architect: string;                // "Kohn Pedersen Fox"
  
  // Multivista Opportunity
  painPoints: string[];             // Array of pain points
  primaryPainPoint: string;         // Main pain point for card
  painPointDetail: string;          // Explanation
  suggestedService: string;         // "MEP Exact-Built®"
  suggestedServiceReason: string;   // Why this service
  relevantCaseStudyId: string;      // Reference to case-studies.json
  
  // Contact
  primaryContactId: string;         // Reference to contacts.json
  
  // Warmth Scoring
  warmthScore: number;              // 0-100 calculated
  warmthFactors: WarmthFactor[];    // Breakdown
}

interface WarmthFactor {
  factor: string;                   // "Warm intro available"
  weight: number;                   // 25
  positive: boolean;
  detail: string;                   // "Mike Rodriguez"
  explanation?: string;             // "Your close rate is 3.2x higher..."
}
```

### contacts.json Schema

```typescript
interface Contact {
  id: string;
  name: string;                     // "Sarah Chen"
  title: string;                    // "Project Executive"
  company: string;                  // "Tishman Construction Corp"
  email: string;                    // "sarah.chen@tishman.com"
  phone?: string;
  
  // LinkedIn
  linkedInConnected: boolean;
  linkedInDegree?: 1 | 2 | 3;
  linkedInMutualName?: string;      // "Mike Rodriguez"
  linkedInMutualCompany?: string;   // "Turner"
  
  // Role
  decisionMaker: boolean;
  budgetAuthority: boolean;
  
  // Engagement History
  engagements: Engagement[];
}

interface Engagement {
  type: 'whitepaper' | 'webinar' | 'meeting' | 'email' | 'event';
  date: string;
  description: string;              // "Downloaded Forensic Documentation whitepaper"
  count?: number;                   // 3 (downloaded 3x)
}
```

### connections.json — Mel's Network

```typescript
interface MutualConnection {
  id: string;
  name: string;                     // "Mike Rodriguez"
  title: string;                    // "VP of Preconstruction"
  company: string;                  // "Turner Construction"
  relationshipStrength: 'strong' | 'medium' | 'weak';
  dealsClosedVia: number;           // 3
  closeRateViaThisPerson: number;   // 0.68 (68%)
  canIntroTo: string[];             // Contact IDs
}
```

### case-studies.json — Multivista Wins

```typescript
interface CaseStudy {
  id: string;
  clientName: string;               // "Brookfield"
  projectName: string;              // "Manhattan West"
  gc: string;                       // "Tishman Construction"
  service: string;                  // "MEP Exact-Built®"
  roiAmount: number;                // 127000
  roiDisplay: string;               // "$127K"
  roiType: string;                  // "rework avoided"
  roiExplanation: string;           // "Captured MEP installations before..."
  relevantTags: string[];           // ["mep", "high_rise", "office"]
}
```

### icp-config.json — Mel's Filters

```typescript
interface ICPConfig {
  name: string;                     // "Mel Wallace - Multivista NYC"
  filters: {
    minValue: number;               // 20000000 ($20M)
    maxValue?: number;
    stages: string[];               // ["design", "bid", "award", "construction"]
    constructionMonthMax: number;   // 12 (early construction only)
    buildingTypes: string[];        // ["OFF-A", "OFF-B", "MXD", "RES-H", "TRN"]
    geography: {
      city: string;                 // "New York"
      boroughs?: string[];          // ["Manhattan", "Brooklyn", "Queens"]
      includeWestchester: boolean;  // true
    };
    targetGCs: string[];            // ["turner", "skanska", "lendlease", "tishman", "suffolk"]
  };
  services: string[];               // Multivista services to match pain points
}
```

## 2.3 Mock Data — The 47 Projects

### Project Distribution

| GC | Count | Value Range |
|----|-------|-------------|
| Turner Construction | 12 | $25M - $890M |
| Skanska USA | 10 | $35M - $1.6B |
| Lendlease | 8 | $40M - $750M |
| Tishman Construction | 9 | $30M - $2.1B |
| Suffolk Construction | 8 | $22M - $450M |

| Stage | Count |
|-------|-------|
| Design | 8 |
| Bid | 7 |
| Award | 5 |
| Construction Month 1-6 | 18 |
| Construction Month 7-12 | 9 |

| Building Type | Count |
|--------------|-------|
| Office (Class A/B) | 18 |
| Mixed-Use | 10 |
| Residential High-Rise | 8 |
| Healthcare | 5 |
| Transit/Infrastructure | 4 |
| Education | 2 |

### The Top 3 (Scripted for Demo)

These are hardcoded as the demo output regardless of query text:

| Rank | Project | Dodge # | GC | Value | Stage | Contact | Warmth |
|------|---------|---------|-----|-------|-------|---------|--------|
| 1 | 3 Hudson Boulevard | 2026-NYC-0847231 | Tishman | $2.1B | Construction Mo. 2 | Sarah Chen | 87 |
| 2 | Penn Station Redevelopment | 2025-NYC-0721456 | Skanska | $1.6B | Design | James O'Brien | 79 |
| 3 | One Madison Tower | 2026-NYC-0892103 | Turner | $890M | Construction Mo. 6 | David Park | 74 |

## 2.4 UI Components

### File Structure

```
src/features/mel-demo/
├── MelDemo.tsx                     # Main page (/demo/mel)
├── MelDemo.types.ts                # TypeScript interfaces
├── services/
│   ├── DemoEngine.ts               # Query routing + response generation
│   └── WarmthCalculator.ts         # Warmth score logic (for show)
├── data/
│   ├── projects.json               # 47 projects
│   ├── contacts.json
│   ├── connections.json
│   ├── case-studies.json
│   ├── deals.json
│   └── icp-config.json
├── components/
│   ├── DemoChat.tsx                # Chat interface
│   ├── DemoMessage.tsx             # Message bubble
│   ├── AgentIndicator.tsx          # "[Agent] activates" banner
│   ├── ProspectCard.tsx            # Dodge-style project card
│   ├── EmailPreview.tsx            # Generated email display
│   ├── WinProbabilityCard.tsx      # Probability breakdown
│   ├── QuickActions.tsx            # Demo shortcut buttons
│   └── DemoBadge.tsx               # "Demo Mode" indicator
└── index.ts
```

### Component Specifications

**DemoChat.tsx**
- Full-height chat interface
- Input at bottom
- Messages scroll up
- Quick action buttons above input

**ProspectCard.tsx**
- Dodge-style header (project name, warmth badge)
- Grid layout: Dodge #, type, SF, floors, value, stage
- Key players section: Owner, GC, Architect
- Contact section with LinkedIn status icon
- Pain point with Multivista service recommendation
- Warm intro path highlight

**EmailPreview.tsx**
- Email client-style container
- To/Subject/Preheader fields
- Body with proper formatting
- Signature block
- Stats bar (word count, reading time, personalization %)
- Action buttons: Copy, Edit, Generate Variant

**WinProbabilityCard.tsx**
- Large percentage with animated progress bar
- Positive factors list (green checkmarks)
- Risk factors list (orange warnings)
- Recommendation box with action items

## 2.5 Route Configuration

```typescript
// In App.tsx or routes config
<Route path="/demo/mel" element={<MelDemo />} />
```

**Access:** Direct URL only (not in sidebar navigation). Ken navigates manually during call.

## 2.6 Styling Requirements

Match existing PlexifyBID design system:
- Tailwind CSS
- Dark mode ready (but light mode default for demo)
- Font: System (matches rest of app)
- Cards: Rounded corners, subtle shadows
- Agent indicators: Blue accent color
- Warmth scores: Green (high) → Yellow (medium) → Red (low)

---

# PHASE 3: IMPLEMENTATION TASKS

See companion document: `mel-demo-claude-code-prompt.md`

---

## Appendix A: Demo Script for Ken

### Setup (Before Call)
1. Navigate to `localhost:3000/demo/mel` (or production URL)
2. Verify "Demo Mode" badge visible
3. Clear any previous messages (Reset button)
4. Have Founding Customer Agreement PDF ready

### During Call (10-15 min total)

**[0:00-2:00] — Rapport + Pain Discovery**
"Mel, before I show you anything — what's eating most of your time right now in BD?"

(Let him talk. Listen for prospecting, outreach, CRM complaints.)

**[2:00-3:00] — Setup**
"You mentioned prospecting takes X hours. Let me show you how Plexify handles that."

**[3:00-5:00] — Step 1: Prospect Query**
Type: "Show me my best prospects for Q1"

"See how it pulled 47 projects from Dodge and ranked them by warmth score? That's looking at your network, past wins, timing, and who has budget authority."

**[5:00-6:30] — Step 2: Outreach**
Type: "Draft outreach for number 1"

"This references Sarah's specific project, the MEP pain point, your mutual connection Mike, and the Brookfield case study. 94% personalization score — and you didn't write a word."

**[6:30-8:00] — Step 3: Win Probability**
Type: "What's my win probability?"

"73% — and here's why. Warm intro via Mike, similar past win, right timing before MEP rough-in. The risk? Unknown incumbent. Recommendation: lead with Mike's intro."

**[8:00-10:00] — Q&A**
Handle objections. Use positioning:
- "Einstein is general-purpose. Plexify speaks AEC."
- "You're always in control. Agents draft, you approve."

**[10:00-12:00] — Close**
"I'm offering 4 founding customer spots. $14.4K prepaid, warrant to invest $25K at 20% discount in our next round, lifetime pricing lock. Interested in being one of the four?"

### Post-Call (Within 24 hours)
- Send Founding Customer Agreement
- Send case study template
- Schedule onboarding call

---

## Appendix B: Positioning Talking Points

**On Competitive Differentiation:**
> "Einstein is a general-purpose assistant. Plexify is an AEC sales specialist who's worked 10,000 construction deals."

**On Ambient AI:**
> "Plexify isn't trying to replace you. It's your Chief of Staff — always working in the background, surfacing insights, drafting first versions, so you focus on relationships and closing."

**On Data Security:**
> "Runs on Cloudflare Workers, enterprise-grade. Your Dodge data never leaves your tenant."

**On Control:**
> "You're always in the loop. Agents draft, you approve. Nothing goes out without your sign-off."

**On Value:**
> "This saves you 15 hours a week on prospecting. At your billing rate, that's $X back in selling time."
