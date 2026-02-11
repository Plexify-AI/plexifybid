# Prompt for Claude Sr. Dev: Mel Wallace Demo Build Specification

## URGENT CONTEXT

**Deadline:** Thursday, February 6, 2026 EOD
**Stakes:** This is the most important sales call of Plexify's life. Mel Wallace is Director of Sales at Hexagon Multivista ($32B parent company). If we land Mel, we land Hexagon. If we land Hexagon, we land the AEC industry.

You are Ken's Senior Developer. Your job is to produce a Claude Code implementation spec that builds a "Live Prospecting Agent" demo by Thursday EOD. This is not a generic feature — it's a targeted demo for a specific prospect with specific needs.

---

## SOURCE DOCUMENT

The attached `plexify-strategy-feb4-2026.md` contains:
- Complete Mel Wallace profile (lines 303-386)
- His likely pain points (lines 351-386)
- Exact demo flow specification (lines 450-549)
- Technical execution plan (lines 550-573)
- Success criteria (lines 641-670)

**Read the entire document before proceeding.** Every detail matters.

---

## WHAT YOU NEED TO PRODUCE

### Deliverable 1: Demo Technical Specification

Create a spec following PRD Constitution Phase 1-2 format:

**Phase 1 (What/Why):**
- Overview: One paragraph describing the demo's purpose
- User Scenario: Given Mel is on the call / When he asks "Show me my best prospects" / Then he sees...
- Functional Requirements (FR-001 through FR-010): Exactly what the demo must do
- Success Metrics: Demo completes in <5 minutes, Mel says "I want this"

**Phase 2 (How):**
- Architecture: Which existing Plexify components are involved
- Data Model: What mock data needs to be created
- API Contracts: What endpoints need to exist (even if mocked)
- UI Components: What Mel will see on screen at each step

### Deliverable 2: Claude Code Implementation Prompt

The exact prompt Ken will give Claude Code to build this. Include:
- Branch name: `feature/mel-demo-prospecting`
- File structure under existing codebase
- Mock data files to create
- Components to build or modify
- Commit message format
- First task (smallest shippable piece)
- Thursday EOD checkpoint criteria

---

## DEMO FLOW TO IMPLEMENT

From the Perplexity report (lines 469-542), the demo must show:

### Step 1: Prospect Query
**Mel says:** "Show me my best prospects for this quarter."

**System shows:**
```
[Place Graph Analyst activates]

47 projects match criteria

Top 3 prioritized by "warmth score":

1. **3 Hudson Boulevard** (Tishman) - $2.1B, Month 2 of construction
   - Contact: Sarah Chen, Project Exec (LinkedIn connected to you)
   - Pain point: 18-floor MEP coordination challenge
   - Warm intro path: You both know Mike at Turner
   - Suggested approach: "MEP Exact-Built case study from similar project"

2. **Penn Station Rebuild** (Skanska) - $1.6B, Preconstruction
   - Contact: James O'Brien, VP of Ops
   - Pain point: Stakeholder reporting (MTA + Amtrak + Empire State Dev)
   - Engagement: Downloaded your "Forensic Documentation" whitepaper 3x
   - Next step: "Invite to webinar: Multi-Stakeholder Transparency"

3. [Third project with similar detail]
```

### Step 2: Outreach Generation
**Mel says:** "Draft outreach for #1."

**System generates:**
```
Subject: MEP Coordination Solution for 3 Hudson [32 chars]
Preheader: How we saved Brookfield $127K on similar tower

Hi Sarah,

Congrats on the 3 Hudson Boulevard kickoff—what a landmark 
project for Midtown West.

Having worked with Tishman on several towers, I know the MEP 
coordination complexity you're facing, especially across 18 
floors with multiple trades. We recently helped Brookfield on 
Manhattan West avoid $127K in MEP rework using our Exact-Built® 
documentation.

Mike Rodriguez at Turner suggested I reach out—he mentioned 
you're always looking for ways to de-risk coordination.

Would a 15-minute call next week make sense to show you how 
this works? I can share the Manhattan West case study.

Best,
Mel

[Calendar link]
```

### Step 3: Win Probability
**Mel says:** "What's my win probability on this?"

**System analyzes:**
```
73% win probability

Rationale:
  - Warm intro (Mike) = +25%
  - Similar past win (Brookfield) = +20%
  - Early engagement (Month 2) = +15%
  - Budget authority confirmed (Sarah is Proj Exec) = +13%

Risk factors:
  - Incumbent (unknown) = -10%
  - No prior Tishman relationship = -5%

Recommendation: "Lead with Mike intro. Offer on-site demo 
within 2 weeks."
```

---

## DATA REQUIREMENTS

### Mock Project Data (create JSON file)
Create 47 realistic NYC commercial construction projects with:
- Project name, GC, value, phase, location
- Key contacts with titles and LinkedIn connection status
- Identified pain points
- Engagement history (whitepaper downloads, webinar attendance, etc.)
- Warm intro paths (mutual connections)

**Prioritize these GCs:** Turner, Skanska, Lendlease, Tishman, Suffolk

**ICP Filters to support:**
- Project value: >$20M
- Project phase: Preconstruction or early construction
- Geography: NYC 5 boroughs + Westchester
- GC: Configurable list

### Mock Relationship Data
- Mutual connections between "Mel" and prospects
- Past deal history (wins/losses with similar prospects)
- Case study references (Brookfield Manhattan West, etc.)

---

## AGENT ORCHESTRATION REQUIREMENTS

The demo must show three agents working together:

**Agent 1: Place Graph Analyst**
- Role: Query and filter project data
- Input: Natural language query + ICP filters
- Output: Ranked list of prospects with "warmth score"
- Warmth Score Formula: Weighted combination of:
  - Warm intro availability (+25%)
  - Similar past wins (+20%)
  - Project phase timing (+15%)
  - Budget authority confirmed (+13%)
  - Minus: Unknown incumbent (-10%), No prior relationship (-5%)

**Agent 2: Ask Plexi**
- Role: Generate personalized outreach
- Input: Prospect record + Mel's context
- Output: Email with subject, preheader, body, CTA
- Requirements:
  - Reference specific project details
  - Include warm intro mention
  - Include relevant case study
  - Include calendar link placeholder

**Agent 3: NotebookBD RAG**
- Role: Score win probability with rationale
- Input: Prospect record + historical deal data
- Output: Percentage score + breakdown + recommendation
- Requirements:
  - Cite specific factors with weights
  - Identify risk factors
  - Provide actionable recommendation

---

## UI REQUIREMENTS

### Primary View: Prospecting Playbook
- Chat-style interface where Mel types queries
- Agent responses render in styled cards
- Project cards show: Name, GC, Value, Phase, Contact, Pain Point, Warmth Score
- Outreach generation shows in email preview format
- Win probability shows as score + breakdown chart

### Demo Mode Features
- Pre-loaded with Mel's ICP filters
- "Demo Data" badge visible (so Mel knows it's realistic mock, not claiming real data)
- Quick-access buttons for the three demo queries
- Reset button to restart demo flow

---

## EXISTING CODEBASE INTEGRATION

Reference these existing components (from Place Graph MVP and NotebookBD):

**From Place Graph:**
- Mapbox GL visualization (may not need for this demo)
- Supabase data layer patterns
- React component structure

**From NotebookBD:**
- RAG query patterns
- Document retrieval logic
- Response formatting

**From Agent Management (in progress):**
- Agent registry patterns
- Session handoff protocol
- Prompt template structure

---

## CONSTRAINTS

**Time:** Must be demo-ready by Thursday EOD. This means:
- Core flow working (Steps 1-3)
- Mock data loaded
- UI polished enough for live demo
- No broken states or error screens

**Scope:** This is a demo, not production. Accept:
- Hardcoded demo data (not real Dodge integration)
- Mocked agent "thinking" (can be deterministic for demo reliability)
- Limited error handling (happy path only)

**Quality:** Mel is a sophisticated buyer. The UI must look professional:
- Clean typography
- Consistent spacing
- Smooth transitions
- No loading spinners that take too long

---

## DELIVERABLE FORMAT

Your output should be TWO documents:

### Document 1: `mel-demo-spec.md`
Full technical specification following PRD Constitution Phase 1-2 format.

### Document 2: `mel-demo-claude-code-prompt.md`
The exact prompt Ken pastes into Claude Code to begin implementation. This prompt should:
- Reference the spec document
- Set up the branch and file structure
- Define the first three tasks (smallest to largest)
- Include Thursday EOD checkpoint criteria
- Follow CLAUDE.md conventions for commit messages and PR format

---

## SUCCESS CRITERIA

**For the Spec:**
- Clear enough that Claude Code can implement without ambiguity
- Scoped tightly enough to complete by Thursday EOD
- Includes all mock data requirements
- Defines exact UI states Mel will see

**For the Demo:**
- Completes full flow in <5 minutes
- Looks professional (Mel has seen 1,000 demos)
- Shows agent orchestration (not just one agent)
- Demonstrates AEC-specific intelligence (not generic AI)
- Makes Mel say: "Holy shit, this would save me 15 hours a week"

---

## ADDITIONAL CONTEXT

From the Perplexity report, key positioning for the demo:

**Ambient AI Philosophy:**
"Plexify isn't trying to replace you. It's your Chief of Staff—always working in the background, surfacing insights, drafting first version, so you focus on relationships and closing."

**Competitive Differentiation:**
"Einstein is a general-purpose assistant. Plexify is an AEC sales specialist who's worked 10,000 construction deals."

**Value Proposition:**
"This saves you 15 hours/week on prospecting."

Incorporate these into the demo narrative and UI copy where appropriate.

---

## START NOW

Read the attached strategy document. Extract every technical detail from the demo sections. Produce the two deliverables.

The clock is ticking. Mel calls Tuesday. The demo must be flawless.

Go.
