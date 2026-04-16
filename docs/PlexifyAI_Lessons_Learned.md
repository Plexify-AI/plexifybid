# PlexifyAI — Lessons Learned
## Insights from Ken D'Amato and Claude across the full project lifecycle

**Created:** April 2, 2026
**Last Updated:** April 4, 2026
**Purpose:** Living document capturing hard-won insights from building PlexifyAI. These lessons apply to this project, future Claude Code sessions, and any AI-assisted development effort. Upload this to any new Claude project for instant context.

---

## 1. The Three Verification Principles

*Origin: Mel Wallace demo failure, April 2026. The Deal Room Content Skills sprint shipped 10 tasks with a clean build — but none of the features worked when a real user clicked them. Discovered during a live client demo.*

**Principle 1: Never claim "shipped" without evidence of output.**
A clean TypeScript build is not verification. Files existing at expected paths is not verification. Routes registered in `index.mjs` is not verification. The ONLY verification is: a real user clicks the button, and the expected result appears on screen. "Build passes" means the code is syntactically valid — it says nothing about whether the feature actually works.

**Principle 2: Every task needs an Acceptance Test.**
Every Claude Code task must include an explicit test that verifies real user-facing behavior. Not `npm run build` — an actual browser-based test: "Click this button → see this result → confirm this data appears." The acceptance test should name the specific UI element, the expected response, and the observable proof that it worked.

**Principle 3: Ken confirms "done" — not Claude, not Claude Code.**
After Claude Code reports completion, it must provide Ken with specific steps to test in the browser. Ken executes those steps and reports back. If Ken says it doesn't work, that's the truth — regardless of what the code looks like. Every sprint ends with a Demo Checklist that Ken executes manually before pushing to main.

---

## 2. The Brutal Honesty Principle

*Origin: Ongoing, formalized April 2026.*

Ken always wants brutal honesty. This means:
- Tell Ken when he has a misconception — don't validate to avoid discomfort
- Give honest opinions on product direction, even when they're uncomfortable
- When something isn't ready, say so plainly — don't soften with "almost there" or "just needs minor tweaks"
- When a PRD is weak, say it's weak and explain why
- When a timeline is unrealistic, flag it before the deadline, not after
- Never confuse encouragement with accuracy

The goal is for Ken to produce his best work. That requires honest feedback, not cheerleading.

---

## 3. Backend-First Discovery

*Origin: Multiple sessions. The `deal_room_artifacts` table already existed when Claude Code tried to CREATE TABLE. NotebookBD consolidation was already visually complete when the PRD spec'd a UI redesign.*

**Always check what exists before building.** Before writing any code:
1. Read the existing codebase — search for related files, components, routes, and tables
2. Query Supabase to see what tables already exist
3. Check if the feature you're building already has a partial implementation

The right operation is often ALTER TABLE, not CREATE TABLE. The right approach is often wiring existing components, not building new ones. Discovery saves days of wasted work.

---

## 4. The PRD Constitution is Non-Negotiable

*Origin: PRD Constitution v2.1, enforced since project inception.*

**Specify → Plan → Implement → Document.** No code before an approved spec. No implementation before an approved plan. The gates exist to catch problems before they become code.

What each phase must produce:
- **Phase 1 (Specify):** Numbered functional requirements (FR-001 format), user scenarios in Given/When/Then, data models, success metrics, out-of-scope list, [NEEDS CLARIFICATION] items
- **Phase 2 (Plan):** Architecture Decision Records, API contracts, component hierarchy, migration SQL, testing strategy
- **Phase 3 (Implement):** Code with acceptance tests, incremental commits, browser verification
- **Phase 4 (Document):** Handoff document, lessons learned, backlog updates

A deep research report is NOT a PRD. Strategic thinking that hasn't been converted into numbered requirements with testable acceptance criteria is research input, not a build spec.

---

## 5. Two-Lane Development Pattern

*Origin: Established early in the project, refined throughout.*

**Claude (this chat):** Strategy, spec, architecture, plan review, prompt engineering, research
**Claude Code Desktop:** Implementation, git, execution, file creation

Claude writes specs and prompts. Claude Code implements. Ken approves at gates. Claude Code must state its plan and wait for explicit "approved" before writing any code.

**Critical rule:** Claude Code sessions need clean context. Long chat sessions with compaction risk create errors. When context gets heavy, start a fresh Claude Code session with a focused handoff document.

---

## 6. Direct API Over MCP

*Origin: Email integration research, February-March 2026.*

After deep research comparing MCP-based integration vs. direct API integration for Outlook (Microsoft Graph API) and Gmail (Google Gmail API), direct API integration into the Express backend was chosen. Reasons:
- MCP adds a protocol layer with limited benefit for server-side integrations
- Direct API calls are debuggable with standard HTTP tools
- Token encryption via Supabase Vault + AES-256-GCM works cleanly with direct API
- MCP's value is for client-side tool use in AI conversations, not for backend service integration

---

## 7. Warmth Scoring is Composite, Not Binary

*Origin: LinkedInGraph Agent development, March 2026.*

The 7-dimension weighted model (message count 30%, reciprocity 15%, recency 15%, endorsements 15%, recommendations 10%, invitation direction 10%, company follow 5%) replaced a simple binary scoring system. Key insight: recency matters more than raw volume. A contact with 94 messages but no activity in 2 years (like some LinkedIn connections) should score lower than a contact with 20 recent messages.

The composite warmth score for Deal Rooms adds: LinkedInGraph base + Home warming card signals + deal evolution signals. This is specified in FR-018 but not yet implemented.

---

## 8. LinkedIn Data Quirks

*Origin: LinkedInGraph pipeline development, March 2026.*

Hard-won parsing lessons:
- Raw `Connections.csv` has a 2-line disclaimer preamble — detect "First Name" header row, don't use fixed `skiprows`
- Group conversations have comma-separated URLs in RECIPIENT PROFILE URLS
- URL slugs change over time, breaking exact-match joins
- The LinkedIn data export ZIP structure is not stable across export dates — always validate file presence before processing

---

## 9. Skill Prompt Quality is Product Quality

*Origin: Deal Room Content Skills sprint, April 2026.*

The five skill prompts (board_brief, deal_summary, competitive_analysis, meeting_prep, ozrf_section) are the single highest-value deliverable in the entire sprint. If the prompts are weak, every artifact that comes out will be weak — no amount of UI polish fixes bad generation.

What makes a good skill prompt:
- **Strict JSON schema** — "Respond with ONLY a JSON object" with every field typed
- **Exact citation format** — `[Source: {filename}, Chunk {N}]` inline in every paragraph
- **Voice DNA injection point** — `{voice_dna_block}` at the TOP of the prompt, before role definition
- **Banned words enforcement** — Explicit: "NEVER use these words: delve, leverage, seamless, transformative"
- **Domain specificity** — References to commercial construction, BID operations, or BD workflows — not generic business language
- **Length/density directive** — "Each section MUST be 2-4 sentences minimum, citing specific numbers, dates, percentages" — without this, Claude writes vague three-sentence summaries
- **Voice rules with examples** — "Say 'collection rate dropped 3.2pp to 91.0%' not 'collections experienced a slight decline'"

---

## 10. Tenant Vocab Skins are Essential from Day One

*Origin: Multi-tenant pilot experience — Ben/SunnAx, Mel/Hexagon, Ken/SOLO.*

Different tenants speak different languages. A BID director's "OZRF Section" is meaningless to an AEC sales director. The tab configuration must be tenant-specific from the first onboarding, not "we'll customize later."

Lesson: when Mel sees "OZRF Section" instead of "Site Survey Brief," he has to ask what it means — and you've lost the room for 30 seconds. Seed tenant-specific tab configs and skill prompts before the onboarding call, not after.

---

## 11. The Azure AD / Microsoft 365 Trap

*Origin: Ben's Outlook OAuth integration, March 2026.*

`MICROSOFT_CLIENT_SECRET` must be the Secret **Value**, not the Secret ID (which is a GUID). M365 Business Basic accounts require `common` authority, not `consumers`. These two misconfigurations account for hours of debugging time. Document them in every handoff.

---

## 12. Image Embedding Pipeline

*Origin: Document generation with python-docx, various sessions.*

For embedding images in generated documents: Python/PIL resize → remove background via pixel brightness thresholding → inject base64 via bash `sed` to avoid truncation. JPEG encoding in data URIs breaks in JSX artifacts. Always use PNG with proper RGBA transparency. When base64 strings are long, build the file via bash script with `sed` replacement rather than inline string editing — inline editing truncates.

---

## 13. python-docx Patterns

*Origin: Document generation sessions.*

- Cell shading requires `parse_xml` with `nsdecls("w")`
- Single-cell tables work as colored badge/callout blocks
- `set_cell_shading` and `set_cell_border` helpers via `parse_xml` are reliable
- For branded DOCX export: use the `docx` npm package (docx-js) client-side with `Packer.toBuffer()` for browser downloads

---

## 14. Pilot Sequencing Discipline

*Origin: Product strategy discussions, ongoing.*

Wire existing agents before building new acquisition funnels. Prove the product works for current pilots before scaling to new ones. The sequencing:

1. Make existing features work end-to-end (generation → render → export)
2. Prove it with one pilot user (Ken dogfooding)
3. Onboard a second pilot (Mel) with seed content in their vocabulary
4. Collect feedback and iterate
5. THEN build new features

Premature feature building before the core loop works is the #1 risk for a solo founder.

---

## 15. Onboarding Seed Content Makes or Breaks the Pilot

*Origin: Mel Wallace onboarding prep, April 2026.*

The seed content for a pilot must feel real and specific to the user's world. Generic placeholders ("Sample Project A") kill engagement. For Mel's Multivista onboarding:
- 7 fictional prospects mapped to Multivista's actual ICP (healthcare, data centers, education)
- Competitive analysis comparing Multivista vs. real competitors (OpenSpace, DroneDeploy, FARO, Buildots)
- Voice DNA parameters derived from Mel's actual published content (LinkedIn articles, BIM For All podcast)

The bar: Mel should look at the seed data and think "this person understands my business," not "this is a generic demo."

---

## 16. Demo Survival Skills

*Origin: Mel demo, April 2026 — features didn't work, Ken adapted in real-time.*

When the planned demo breaks:
- Don't panic — pivot to what works (Ask Plexi meeting brief saved the demo)
- Show the output, not the process — paste generated content into the editor if the generation pipeline is broken
- Focus on the VALUE the user sees, not the MECHANISM that produced it
- Always secure the next meeting — the goal isn't a perfect demo, it's continued engagement
- Be honest about what's in development vs. what's production-ready

Ken's instinct to "zig and zag" during the broken demo secured a second meeting with Mel. The product's value is real even when the wiring isn't complete.

---

## 17. Conventional Commits and Branch Discipline

*Origin: Established early, reinforced throughout.*

- Conventional commit format required: `feat(scope):`, `fix(scope):`, `docs:`, `chore:`
- Fast-forward merges to main
- Railway auto-deploys each push to main — never push untested code
- Claude Code auto-generates `claude/adjective-surname` branch patterns — requires `git stash` → `git merge` → `git stash pop` workflow
- Fix branches: `fix/description` — separate from feature branches for clean git history

---

## 18. Context Window Management

*Origin: Multiple long sessions with context degradation.*

Long Claude chat sessions degrade through compaction. When context gets heavy:
- Create a handoff document capturing the current state
- Start a fresh session with the handoff document attached
- The handoff should include: what was built, what's working, what's broken, exact file paths, and the next task

For Claude Code sessions specifically: attach focused, self-contained prompts — not multi-hundred-page context dumps. The prompt should have everything Claude Code needs without requiring it to search the entire codebase.

---

## 19. The "Last Mile" Problem in AI-Assisted Development

*Origin: Deal Room Content Skills sprint failure analysis, April 2026.*

AI coding assistants (Claude Code, Copilot, etc.) are excellent at creating files, writing components, defining routes, and building database schemas. They consistently fail at the **last mile**: verifying that the entire click path works end-to-end when a real user interacts with the UI.

The pattern: Claude Code creates `server/routes/deal-room-generate.js` (backend endpoint), modifies `AssistantPanel.tsx` (frontend chip), and adds `ArtifactRenderer.tsx` (display component). Each file is correct in isolation. The build passes. But the actual flow — chip click → event handler → API call → response parsing → state update → re-render — has a broken link somewhere in the chain.

**Mitigation:** Always trace the full click path in the fix/verification step:
1. What element does the user click?
2. What event handler fires?
3. What API call does it make?
4. What does the server do with that request?
5. What response comes back?
6. How does the frontend handle the response?
7. What renders on screen?

If any step in this chain is broken, the feature doesn't work — regardless of whether each individual file looks correct.

---

## 20. Brand Voice Constraints are Non-Negotiable

*Origin: Project inception, enforced throughout.*

Never use: **"delve," "leverage," "seamless," "transformative."** These are banned in all output — code comments, generated content, skill prompts, documentation, and conversation. Enforced via Voice DNA Layer 2 validation and explicit prompt instructions.

The constraint isn't arbitrary — it forces more specific, human language. "The system connects your pipeline data to outreach generation" is better than "the platform seamlessly leverages your data."

---

## 21. ElevenLabs Budget Discipline

*Origin: Audio briefing feature, April 2026.*

TTS costs add up fast. The $50/month per-tenant cap exists for a reason. Track cumulative monthly spend in `tenant_audio_usage` and reject generation requests that would exceed the cap with a friendly message. Estimate costs before generating (~$0.15/briefing, ~$0.40/podcast). Fire-and-forget cost recording after successful generation — never block generation on a tracking error.

---

## 22. Route Registration Order Matters

*Origin: Multiple debugging sessions in Express.js.*

In `server/index.mjs`, new routes must register AFTER specific routes and BEFORE catch-all routes. If a catch-all route (like a SPA fallback or 404 handler) is registered first, it swallows all requests and the new endpoint never receives traffic. This has caused silent failures multiple times — the endpoint exists but no requests reach it.

---

## 23. Claude Code Must Self-Verify Before Handing to Ken

*Origin: Day 2 sprint, April 2026. Claude Code completed Task 1 (Graceful Degradation for Thin-Data Deal Rooms) but couldn't preview its own work, then asked Ken which verification path to take — putting the burden on Ken to solve a workflow problem that Claude Code should have handled.*

After completing any task, Claude Code must:

1. Run `cd C:\dev\plexifybid && npm run dev` (if server isn't already running)
2. Open the relevant page in the preview browser using the sandbox token
3. Perform its OWN first-pass visual check against the acceptance test criteria
4. Report what it SAW (screenshots or descriptions), not just what it BUILT
5. THEN hand Ken the specific test steps for final confirmation

"Build passes" is Step 0. Claude Code's browser check is Step 1. Ken's browser is Step 2 (the truth). Never skip Step 1 and go straight to Step 2.

---

## 29. Single Injection Point Architecture

*Origin: Sprint B, April 2026. buildUserContext() consolidated three separate context sources — factual corrections, Voice DNA, and voice corrections — into one function called at all 7 LLM call sites.*

Build a single function that assembles all per-user context (facts, style, corrections, preferences) before every LLM call. Benefits proven in Sprint B:

- Factual correction added in Settings immediately applies to AskPlexi, Deal Room generation, outreach, and PPTX export — no per-surface wiring needed
- Voice correction captured in the Deal Room editor ("Teach Plexify") immediately improves email generation — because the injection point is upstream of all surfaces
- Adding a new context source (workspace instructions, agent state for PlexiCoS) requires extending one function, not touching 7 route files
- "Never throws" contract means a broken correction record never takes down an LLM call — the section is suppressed and the rest of the context flows through

The function reads fresh from DB per request (no stale cache) and returns null when all sources are empty (no pointless prompt overhead). This becomes the spine PlexiCoS extends with orchestration context.

---

## Template: Adding New Lessons

When a new lesson is learned, add it to this document using this format:

```markdown
## [Number]. [Title]

*Origin: [What happened and when]*

[The lesson, written as a principle that can be applied to future work.]
```

---

*This document is a living artifact. Update it after every sprint, demo, or production incident. The goal is to never make the same mistake twice.*

*"Ship, Learn, Loop, Repeat" — Liquidity Pool Maxim #10*
