# Mel Wallace Demo — Claude Code Implementation Prompt

**Deadline:** Thursday, February 6, 2026 EOD  
**Priority:** This is the most important sales call of Plexify's life.

---

## Initial Setup Command

```
Create branch: feature/mel-demo-prospecting (from develop)

Read the attached spec: mel-demo-spec.md

This is a targeted demo for Mel Wallace, Director of Sales at Hexagon Multivista. 
The demo shows how he would use Plexify to prospect for HIS sales targets — 
NYC commercial construction projects where Multivista could sell documentation 
services.

The demo has 3 steps:
1. "Show me my best prospects" → 47 projects filtered to top 3 with warmth scores
2. "Draft outreach for #1" → Personalized email with case study + warm intro
3. "What's my win probability?" → 73% with factor breakdown + recommendation

This uses MOCK DATA (not real agents) for demo reliability. Responses are 
deterministic and instant.

Deadline: Thursday EOD. Friday 10am is the demo call.
```

---

## Task Breakdown

### Task 1: Data Foundation (1 hour)

**Create mock data files:**

```
Create src/features/mel-demo/data/ with these JSON files:

1. projects.json — 47 NYC commercial construction projects
   - Dodge-style format: dodgeNumber, name, type, squareFeet, floors, value, stage
   - Include owner, gc, architect for each
   - Top 3 MUST be:
     #1: 3 Hudson Boulevard (Tishman, $2.1B, Construction Mo.2, warmth 87)
     #2: Penn Station Redevelopment (Skanska, $1.6B, Design, warmth 79)  
     #3: One Madison Tower (Turner, $890M, Construction Mo.6, warmth 74)
   - Remaining 44 projects spread across: Turner, Skanska, Lendlease, Tishman, Suffolk
   - Value range: $20M-$2B
   - Stages: design, bid, award, construction (month 1-12)
   - Building types: Office, Mixed-Use, Residential, Healthcare, Transit, Education

2. contacts.json — Key contacts for each project
   - Sarah Chen (Tishman, Project Exec, 2nd degree via Mike Rodriguez)
   - James O'Brien (Skanska, VP Ops, not connected, downloaded whitepaper 3x)
   - David Park (Turner, Senior PM, 1st degree, met at ENR 2025)
   - Plus 10-15 more contacts for other top projects

3. connections.json — Mel's warm intro network
   - Mike Rodriguez (Turner, 3 deals closed via him, 68% close rate)
   - 3-4 other mutual connections

4. case-studies.json — Multivista success stories
   - Brookfield Manhattan West ($127K rework avoided, MEP Exact-Built)
   - Hudson Yards stakeholder portal (multi-owner documentation)
   - 432 Park (forensic documentation for disputes)

5. icp-config.json — Mel's ICP filters
   - minValue: 20000000
   - stages: ["design", "bid", "award", "construction"]
   - targetGCs: ["turner", "skanska", "lendlease", "tishman", "suffolk"]
   - geography: NYC + Westchester

Commit: feat(mel-demo): add mock data for 47 NYC projects
```

### Task 2: TypeScript Types (30 min)

```
Create src/features/mel-demo/MelDemo.types.ts

Define interfaces for:
- DodgeProject (with all Dodge-style fields)
- Contact (with LinkedIn connection status)
- MutualConnection (warm intro network)
- CaseStudy (Multivista wins with ROI)
- ICPConfig (filter settings)
- WarmthFactor (scoring breakdown)
- ProspectQueryResponse
- OutreachResponse  
- WinProbabilityResponse

Export all types.

Commit: feat(mel-demo): add TypeScript interfaces
```

### Task 3: Demo Engine Service (1 hour)

```
Create src/features/mel-demo/services/DemoEngine.ts

This is the mock "agent" that returns deterministic responses:

class DemoEngine {
  // Step 1: Always returns the same top 3 prospects
  queryProspects(query: string): ProspectQueryResponse {
    // Return: totalMatches: 47, topProspects: [Hudson, Penn, Madison]
    // Include ~1.2s simulated delay for "processing" feel
  }
  
  // Step 2: Returns pre-written email for prospect #1
  generateOutreach(prospectId: string): OutreachResponse {
    // Return the exact email from the spec
    // Subject: "MEP Documentation for 3 Hudson Boulevard"
    // Include word count, personalization score
  }
  
  // Step 3: Returns 73% with exact factor breakdown
  scoreWinProbability(prospectId: string): WinProbabilityResponse {
    // Return probability: 73
    // positiveFactors: warm intro +25, similar win +20, timing +15, authority +13
    // riskFactors: incumbent -10, no relationship -5
    // recommendation: "Lead with Mike Rodriguez intro..."
  }
  
  reset(): void {
    // Clear conversation state
  }
}

The responses are HARDCODED. This is intentional for demo reliability.
Use setTimeout to simulate 800-1200ms "thinking" time.

Commit: feat(mel-demo): add DemoEngine service with mock responses
```

### Task 4: UI Components (2 hours)

```
Create src/features/mel-demo/components/:

1. DemoChat.tsx
   - Full-height flex container
   - Messages area (scrollable, grows)
   - Input area at bottom
   - QuickActions component above input
   - DemoBadge in top-right corner

2. DemoMessage.tsx
   - Props: { type: 'user' | 'agent', content: ReactNode, agentName?: string }
   - User messages: right-aligned, blue bg
   - Agent messages: left-aligned, white bg with agent indicator

3. AgentIndicator.tsx
   - Props: { agentName: string }
   - Shows "[Place Graph Analyst activates]" style banner
   - Blue left border, subtle animation

4. ProspectCard.tsx
   - Props: { prospect: DodgeProject, rank: number }
   - Dodge-style header with project name and warmth badge
   - Grid: Dodge #, type, SF, floors, value, stage
   - Key players: Owner, GC, Architect
   - Contact with LinkedIn icon (green = connected)
   - Pain point box with service recommendation
   - Warm intro highlight (if exists)

5. EmailPreview.tsx
   - Props: { email: OutreachResponse }
   - Email client styling (To, Subject, Preheader fields)
   - Body with proper line breaks
   - Signature block
   - Stats bar: word count, reading time, personalization %
   - Actions: Copy to Clipboard (use shared CopyToClipboard), Generate Variant

6. WinProbabilityCard.tsx
   - Props: { data: WinProbabilityResponse }
   - Large percentage with animated progress bar (use CSS animation)
   - Positive factors list (green checkmarks, weights)
   - Risk factors list (orange warnings, weights)
   - Recommendation box (highlighted, actionable)

7. QuickActions.tsx
   - Three buttons for demo shortcuts:
     - "Show prospects" → triggers Step 1
     - "Draft outreach" → triggers Step 2
     - "Win probability" → triggers Step 3
   - Also Reset button

8. DemoBadge.tsx
   - Fixed position badge: "Demo Mode"
   - Tooltip: "Using mock data for demonstration"

Use Tailwind. Match PlexifyBID design system.

Commit: feat(mel-demo): add demo UI components
```

### Task 5: Main Page + Routing (30 min)

```
Create src/features/mel-demo/MelDemo.tsx

Main demo page:
- Uses DemoEngine
- Manages conversation state (messages array)
- Handles user input
- Routes to appropriate Step based on query keywords
- Renders DemoChat with messages

Create src/features/mel-demo/index.ts (barrel export)

Add route to App.tsx:
<Route path="/demo/mel" element={<MelDemo />} />

NOTE: Do NOT add to sidebar. This is a hidden route for the demo only.

Commit: feat(mel-demo): add main demo page and routing
```

### Task 6: Polish + Test (1 hour)

```
Polish tasks:
1. Ensure "thinking" delay feels natural (800-1200ms with subtle animation)
2. Add smooth scroll to bottom when new messages appear
3. Verify Copy to Clipboard works
4. Test full flow: Step 1 → Step 2 → Step 3
5. Test Reset functionality
6. Verify responsive layout (demo will be screen-shared)
7. Ensure no console errors

Test the exact demo script:
1. Navigate to /demo/mel
2. Type "Show me my best prospects for Q1"
3. Verify 47 projects, top 3 displayed correctly
4. Type "Draft outreach for number 1"
5. Verify email with Sarah Chen, 3 Hudson, Mike intro, Brookfield case study
6. Type "What's my win probability?"
7. Verify 73%, factors, recommendation

Commit: feat(mel-demo): polish and test demo flow
```

---

## File Structure (Final)

```
src/features/mel-demo/
├── MelDemo.tsx
├── MelDemo.types.ts
├── index.ts
├── services/
│   └── DemoEngine.ts
├── data/
│   ├── projects.json
│   ├── contacts.json
│   ├── connections.json
│   ├── case-studies.json
│   └── icp-config.json
└── components/
    ├── DemoChat.tsx
    ├── DemoMessage.tsx
    ├── AgentIndicator.tsx
    ├── ProspectCard.tsx
    ├── EmailPreview.tsx
    ├── WinProbabilityCard.tsx
    ├── QuickActions.tsx
    └── DemoBadge.tsx
```

---

## Thursday EOD Checkpoint

By end of day Thursday, the following must be TRUE:

- [ ] `/demo/mel` route exists and loads without errors
- [ ] "Show me my best prospects" returns 3 Hudson, Penn Station, One Madison
- [ ] "Draft outreach for #1" returns complete email with Mel's signature
- [ ] "What's my win probability?" returns 73% with factor breakdown
- [ ] Copy to Clipboard works on email preview
- [ ] Reset button clears conversation
- [ ] Demo flows smoothly with no visible loading spinners >2 seconds
- [ ] No console errors during full demo run

---

## Commit Message Format

```
feat(mel-demo): description
test(mel-demo): description
fix(mel-demo): description
```

---

## First Command to Paste

```
Branch: feature/mel-demo-prospecting (from develop)

Read mel-demo-spec.md for full context.

Start with Task 1: Create the mock data files in src/features/mel-demo/data/

The TOP 3 PROJECTS must be exactly:
1. 3 Hudson Boulevard - Tishman - $2.1B - Construction Month 2 - warmth 87
2. Penn Station Redevelopment - Skanska - $1.6B - Design - warmth 79
3. One Madison Tower - Turner - $890M - Construction Month 6 - warmth 74

Generate 44 more realistic NYC projects to total 47.

Create the contacts, connections, and case-studies JSON files.

Commit: feat(mel-demo): add mock data for 47 NYC projects
```

---

## Notes for Ken

**Demo URL:** `http://localhost:3000/demo/mel` (or production equivalent)

**Before the call:**
1. Navigate to demo URL
2. Click Reset to clear any previous messages
3. Test the 3-step flow once
4. Have Founding Customer Agreement PDF open in another tab

**If something breaks during demo:**
- The quick action buttons are a fallback
- If those fail, pivot to showing Agent Management (Ask PlexiCoS) as proof of platform capability
- Say "Let me show you the infrastructure that powers this" and demonstrate agent registry

**Post-demo:**
- Export this conversation to your context handoff
- Note any feedback Mel gives for product iteration

---

## Success = "Holy shit, this would save me 15 hours a week"

Build for that reaction. Every component, every animation, every word of copy serves that moment.

Go.
