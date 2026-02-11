<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Internally in the application Plexify AI I want to create a configuration management database for all Plexify AI Agents for their appropriate Plexify AI Orchestrator to reference as a centralized file that functions as a comprehensive data warehouse, organizing agent personas, prompting templates, prompting best practices, and information about an the Plexify AI Agent environment. This configuration management database can parallel the much used CMDB for IT but clarifies the relationships between AI Agents and AI Models, Plexify application components, and other Plexify suite and outside agent networks for improved communication, opportunity sharing and best practices management. Create the product spec and PRD for the build phase for me (Ken) to confer with Claude Opus 4.5 as a Plexify Sr. developer who will later prompt Claude Code after review your research and report.

I'll now generate a comprehensive PRD for the Plexify AI Agent Configuration Management Database (Agent CMDB). This will parallel IT CMDB concepts but focus on AI agent orchestration, prompting infrastructure, and ecosystem coordination.

## Executive Summary

Plexify AI Agent Configuration Management Database (Agent CMDB) centralizes the definition, versioning, and orchestration of all AI agents across the Plexify ecosystem. This system provides Ken and future PlexifySOLO users with a single source of truth for agent personas, prompt templates, model configurations, and inter-agent communication protocols—addressing the **Tyranny of Ambiguity** (fragmented agent context) and the **Tyranny of Execution** (manual agent configuration) that plague multi-model AI workflows.

***

# Product Requirement Document: Plexify AI Agent Configuration Management Database (Agent CMDB)

**Version:** 1.0
**Created:** February 2, 2026
**Product Lead:** Ken D'Amato
**Development Target:** Sprint 2+ (Post-Place Graph MVP)
**Implementation Partner:** Claude Opus 4.5 (Architecture) → Claude Code (Build)

***

## Problem Statement

### The Current Pain (Tyranny of Execution + Ambiguity)

Ken currently manages AI agent orchestration through scattered markdown files, chat histories, and mental models. When switching between Claude Sonnet, Claude Code, ChatGPT, Perplexity, and Kimi, critical context gets lost. Each session requires manual context reconstruction, consuming 15-30 minutes per handoff. Prompt quality varies session-to-session because there's no version control, no reusability framework, and no systematic way to improve prompts based on outcomes.[^1][^2][^3]

This affects three stakeholder tiers:

**Tier 1: Ken (PlexifyKEN dogfooding)**

- Manually reconstructs agent context 4-6 times daily across AI tool switches
- Loses prompt refinements when sessions expire
- Cannot systematically A/B test prompt variations
- Wastes cognitive bandwidth managing orchestration instead of building product

**Tier 2: Future PlexifySOLO users**

- Will face identical orchestration friction when managing multiple AI agents
- Need plug-and-play agent configurations without engineering expertise
- Require confidence that agent behavior is consistent and auditable

**Tier 3: Plexify ecosystem agents (MoltBot, NotebookBD, Ask Plexi)**

- Lack centralized registry of available agents and their capabilities
- Cannot discover optimal routing strategies (which agent handles which request type)
- Have no formal protocol for agent-to-agent handoffs with context preservation


### Why This Matters Now

The Place Graph MVP Sprint demonstrated the problem: Day 2 handoff between sessions required manual file uploads, decision reconstruction, and explicit "Next Session Should Start With" prompting. Multiply this friction across:[^4]

- 5 AI tools (Claude Sonnet, Claude Code, ChatGPT, Perplexity, Kimi)
- 4 product branches (AEC, BID, BIZ, SOLO)
- 3+ specialized agents per product (MoltBot, NotebookBD, Ask Plexi)
- 10+ sessions per week

**Current cost:** ~90 minutes/week lost to context reconstruction. **Projected cost at scale:** Unbuildable. PlexifySOLO cannot ship without solving this.

***

## Goals \& Objectives

### Primary Goals

| Goal | Success Metric | Timeline |
| :-- | :-- | :-- |
| **Eliminate context reconstruction friction** | Handoff time from 15min → <2min | Sprint 2 MVP |
| **Enable systematic prompt improvement** | Version-controlled prompts with A/B test capability | Sprint 3 |
| **Create agent discovery layer** | Any agent can query "Who handles X?" and get routed | Sprint 4 |
| **Dogfood PlexifySOLO foundation** | Ken's workflow becomes the PlexifySOLO prototype | Ongoing |

### Secondary Objectives

- Reduce time-to-first-output for new AI tool integrations (e.g., adding Gemini) from 2 hours to 15 minutes
- Capture implicit knowledge (Ken's mental models) as explicit agent configurations
- Build audit trail for prompt evolution (understand what works, what doesn't)
- Enable future multi-tenant Agent CMDB where PlexifySOLO users share prompt libraries

***

## User Personas

### Primary Persona: Ken (Solopreneur Power User)

**Current Stage:** Bloom Level 2-3 (Understand → Apply)
**Pain:** Managing 5 AI tools + 3 agent types + 4 product contexts = cognitive overload
**Job-to-be-Done:** "When I switch from Claude Sonnet to Claude Code, I want session context automatically loaded so I can resume work in <2 minutes without manual file hunting."

**Needs:**

- One-click agent initialization with correct persona + context
- Visual dashboard showing which agents are configured, their last update, their performance
- Git-like versioning for prompts ("revert to Thursday's MoltBot personality")
- Automatic handoff protocol generation (Agent CMDB produces the "Next Session Should Start With" prompt)


### Secondary Persona: Future PlexifySOLO User (BD Executive or BID Director)

**Current Stage:** Bloom Level 1 (Remember — struggling to find data)
**Pain:** Knows AI tools exist but overwhelmed by setup complexity
**Job-to-be-Done:** "When I need a BID operations assistant, I want to activate a pre-configured agent that already knows BID workflows without prompt engineering expertise."

**Needs:**

- Agent marketplace with plug-and-play configurations
- Trust that agents follow BID/AEC best practices
- Ability to customize agents without breaking them
- Clear documentation of what each agent can/cannot do


### Tertiary Persona: Plexify AI Agents (MoltBot, NotebookBD, Ask Plexi)

**Current Stage:** Autonomous systems requiring orchestration
**Pain:** No formal way to discover peer agents or understand handoff protocols
**Job-to-be-Done:** "When I receive a request outside my capability domain, I want to route it to the correct specialist agent with full context preservation."

**Needs:**

- Agent registry with capability tags
- MCP-compatible communication protocol[^5][^6]
- Shared context schema (what information structure do all agents expect?)
- Fallback strategies when no specialist agent exists

***

## Use Cases

### Use Case 1: Morning Session Startup

**Actor:** Ken
**Context:** Starting work at 7:00 AM, needs to resume Place Graph Day 3 work[^3]

**Current Flow (15 minutes):**

1. Open Claude session
2. Manually upload Context Handoff document
3. Manually upload CLAUDE.md
4. Manually upload PRD
5. Type "Read these files and confirm you understand the current state"
6. Wait for confirmation
7. Type explicit task: "Rename sidebar nav Operations → Place Graph"

**Agent CMDB Flow (<2 minutes):**

1. Open PlexifyBID dashboard
2. Click "Resume Place Graph Sprint" button
3. Agent CMDB auto-generates session initialization prompt
4. One-click "Launch Claude Code" with pre-loaded context
5. Agent immediately responds: "Ready to rename sidebar nav. Confirming branch: feature/place-graph-scaffold, commit 487619f."

**Value:** Removes Maslow Level 1-2 friction (finding/uploading files), enabling immediate Bloom Level 3 work (applying knowledge to build).

### Use Case 2: Cross-Agent Routing

**Actor:** MoltBot (AI Chief of Staff agent)
**Context:** User asks "Show me NotebookBD entries about Nassau County OZ projects"

**Current Flow (Not Possible):**

- MoltBot has no formal way to call NotebookBD
- User must manually switch contexts

**Agent CMDB Flow:**

1. MoltBot receives request
2. Queries Agent CMDB: "Which agent handles NotebookBD retrieval?"
3. Agent CMDB returns: `NotebookBD_RAG_Agent` with MCP endpoint
4. MoltBot calls NotebookBD MCP server: `GET /api/notebook/query?filter=Nassau+County+OZ`[^7]
5. NotebookBD returns structured results
6. MoltBot synthesizes response with context: "Found 3 NotebookBD entries..."

**Value:** Unlocks Bloom Level 4 (Analyze) by connecting intelligence pools that were previously siloed.

### Use Case 3: Prompt A/B Testing

**Actor:** Ken
**Context:** MoltBot morning briefings feel too verbose, wants to test shorter format

**Agent CMDB Flow:**

1. Navigate to Agent CMDB → MoltBot persona
2. Click "Create Variant"
3. Edit system prompt: Change "Provide detailed analysis" → "Provide 3-sentence summary"
4. Deploy as `MoltBot_v2.1_concise`
5. Run both variants for 1 week
6. Agent CMDB tracks: response length, user satisfaction (thumbs up/down), task completion rate
7. After 7 days, Agent CMDB recommends: "v2.1_concise has 40% higher satisfaction, promote to default?"

**Value:** Converts prompt engineering from art to science. Removes Tyranny of Ambiguity (guessing what works) via data.

### Use Case 4: Onboarding New AI Tool

**Actor:** Ken
**Context:** Wants to add Gemini for Google Workspace integration

**Current Flow (2 hours):**

- Research Gemini API documentation
- Write custom system prompt from scratch
- Test via trial and error
- Document learnings in scattered notes

**Agent CMDB Flow (15 minutes):**

1. Agent CMDB → Add New AI Tool
2. Select: Gemini 2.0 Pro
3. Import base configuration from Agent CMDB template library
4. Customize: "Role: Google Workspace integration specialist"
5. Agent CMDB auto-generates:
    - API client boilerplate
    - Authentication flow
    - Standard context injection format
    - Test harness with sample requests
6. Deploy and verify via Agent CMDB testing UI

**Value:** Standardizes integration patterns, making agent ecosystem extensible without per-tool engineering.

***

## Key Features

Features prioritized via Bloom-Maslow test: "What friction does this remove (Maslow) to unlock what higher-order capability (Bloom)?"

### Feature 1: Agent Registry \& Metadata Store

**Maslow Level:** Physiological (can find agent configurations)
**Bloom Level:** Remember (know what agents exist)

**Capabilities:**

- Central database of all AI agents with structured metadata
- Each agent record contains:
    - **Identity:** Name, version, purpose, owner
    - **Capabilities:** What tasks it handles (tags: "BID operations", "code generation", "market research")
    - **Persona:** System prompt, temperature settings, context window requirements
    - **Dependencies:** Which models it uses (GPT-4, Claude Sonnet, etc.), API keys required
    - **Interfaces:** MCP endpoints, REST APIs, webhook URLs
    - **Status:** Active, deprecated, experimental
    - **Performance Metrics:** Average response time, error rate, user satisfaction score

**Technical Implementation:**

- Supabase table: `agents`
- Schema:

```sql
create table agents (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  version semver not null,
  type text check (type in ('conversational', 'task_executor', 'orchestrator', 'specialist')),
  purpose text not null,
  capabilities jsonb not null, -- array of capability tags
  persona jsonb not null, -- {system_prompt, temperature, max_tokens, etc.}
  model_dependencies jsonb, -- {primary_model, fallback_models, required_apis}
  mcp_endpoint text, -- Model Context Protocol server URL
  status text check (status in ('active', 'deprecated', 'experimental')),
  performance_metrics jsonb, -- {avg_response_time_ms, error_rate, satisfaction_score}
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

**UI Component:**

- Dashboard view: Card grid showing all agents
- Each card displays: Name, status badge, capability tags, last updated timestamp
- Click card → Detail view with full configuration


### Feature 2: Prompt Template Library

**Maslow Level:** Safety (reliable, consistent outputs)
**Bloom Level:** Understand (know how to structure prompts)

**Capabilities:**

- Reusable prompt templates with variable injection
- Template categories:
    - **Session Initialization:** "Read context files X, Y, Z and confirm current state"
    - **Task Assignment:** "Implement feature A with constraints B, C"
    - **Code Review:** "Review PR \#X for security issues, performance, style"
    - **Research:** "Search for data about Y, prioritize sources from Z"
- Variable system: `{{project_name}}`, `{{sprint_day}}`, `{{branch_name}}` auto-populated from context
- Version control: Git-backed storage of templates with commit history

**Technical Implementation:**

- Supabase table: `prompt_templates`
- Schema:

```sql
create table prompt_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  template_content text not null, -- Prompt text with {{variables}}
  variables jsonb not null, -- {var_name: {type, description, default_value}}
  target_agents text[], -- Which agents this template works with
  version semver not null,
  author_id uuid references users(id),
  usage_count integer default 0,
  avg_effectiveness_score numeric, -- Based on user feedback
  created_at timestamptz default now()
);
```

**Integration:**

- Agent CMDB UI includes prompt template selector
- When launching agent session, select template → variables auto-filled from current project context
- Generated prompt displayed for review before sending to AI tool


### Feature 3: Context Handoff Protocol Engine

**Maslow Level:** Belonging (agents work together smoothly)
**Bloom Level:** Apply (agents collaborate on complex tasks)

**Capabilities:**

- Automated generation of session handoff prompts[^2]
- Tracks:
    - Current work stream (sprint, branch, PR number)
    - Files changed this session
    - Decisions made and their rationale
    - Blockers encountered
    - Next session's first task
- Produces machine-readable + human-readable handoff documents
- Supports agent-to-agent handoffs (MoltBot → NotebookBD) via MCP protocol[^5][^7]

**Technical Implementation:**

- Supabase table: `agent_sessions`
- Schema:

```sql
create table agent_sessions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references agents(id),
  user_id uuid references users(id),
  started_at timestamptz not null,
  ended_at timestamptz,
  context_snapshot jsonb not null, -- {work_stream, files_changed, decisions, blockers}
  handoff_prompt text, -- Auto-generated prompt for next session
  parent_session_id uuid references agent_sessions(id), -- For session chains
  outcome_status text check (outcome_status in ('success', 'blocked', 'partial', 'error')),
  metrics jsonb -- {duration_minutes, tokens_used, tasks_completed}
);
```

**Workflow:**

1. Session start: Agent CMDB creates `agent_sessions` record, loads context from previous session
2. During session: Agent CMDB observes (via Claude API webhooks or manual logging) decisions, file changes
3. Session end: User clicks "End Session" → Agent CMDB generates handoff document
4. Next session start: Agent CMDB retrieves handoff, injects into initialization prompt

### Feature 4: Agent Discovery \& Routing Service

**Maslow Level:** Esteem (agents make intelligent decisions)
**Bloom Level:** Analyze (agents identify patterns, route optimally)

**Capabilities:**

- Query API: "Which agent handles [task type]?"
- Returns: Ranked list of agents by capability match + availability
- Routing strategies:
    - **Capability-based:** Match task tags to agent capability tags
    - **Performance-based:** Prefer agents with higher success rates for similar tasks
    - **Load-based:** Avoid overloaded agents (if rate-limited or slow)
- Fallback logic: If no specialist exists, route to general-purpose orchestrator

**Technical Implementation:**

- REST API endpoint: `POST /api/agent-cmdb/discover`
- Request body:

```json
{
  "task_description": "Analyze NotebookBD entries for OZ investment patterns",
  "required_capabilities": ["notebook_rag", "data_analysis"],
  "context": {"user_role": "bid_director", "district": "mineola"}
}
```

- Response:

```json
{
  "recommended_agent": {
    "id": "uuid-notebookbd-rag",
    "name": "NotebookBD RAG Agent",
    "confidence_score": 0.92,
    "mcp_endpoint": "https://plexify.ai/mcp/notebookbd",
    "estimated_response_time_ms": 1500
  },
  "alternatives": [...]
}
```

**Integration:**

- MoltBot queries this API before handling requests
- PlexifyBID dashboard shows "Ask Plexi" → routes via discovery service
- Agent CMDB learns from routing outcomes (if user overrides suggestion, log reason)


### Feature 5: Prompt Versioning \& A/B Testing Framework

**Maslow Level:** Self-Actualization (continuous improvement)
**Bloom Level:** Evaluate (measure effectiveness, make data-driven decisions)

**Capabilities:**

- Git-style versioning for all prompts and agent configurations
- Deploy multiple variants simultaneously
- Metrics collection per variant:
    - Response quality (user thumbs up/down)
    - Task completion rate
    - Average response time
    - Token efficiency (cost per request)
- Statistical significance testing (chi-squared test for categorical outcomes)
- Auto-promote winning variants after confidence threshold reached

**Technical Implementation:**

- Supabase tables: `prompt_versions`, `variant_deployments`, `variant_metrics`
- UI: Agent CMDB → Agent detail page → "Variants" tab
- Variant deployment:

1. Create variant (fork existing prompt)
2. Set deployment strategy: 50/50 split, 10% canary, etc.
3. Define success metrics: "Increase satisfaction score by 10%"
4. Deploy for N days
5. Agent CMDB tracks metrics, displays comparison dashboard
6. User approves promotion or rollback

**Example:**

- Current MoltBot system prompt: 500 words, formal tone
- Variant A: 200 words, conversational tone
- Variant B: 500 words, bullet-point format
- Deploy all three for 100 requests each
- Variant B wins: 35% higher satisfaction, 20% faster responses
- Promote Variant B to default


### Feature 6: MCP Server Integration Layer

**Maslow Level:** Transcendence (agents build new capabilities)
**Bloom Level:** Create (agents compose novel workflows)

**Capabilities:**

- Agent CMDB acts as MCP registry[^8][^5]
- Each agent can expose MCP endpoints for standardized tool calling
- Supports:
    - **Resources:** Data sources agents can read (NotebookBD entries, Place Graph geodata)
    - **Tools:** Actions agents can execute (create GitHub PR, send Slack message)
    - **Prompts:** Pre-built interaction patterns other agents can invoke
- Enables agent composition: Agent A calls Agent B's MCP tools to complete complex workflow

**Technical Implementation:**

- MCP server runs alongside Supabase backend
- Agent CMDB stores MCP capability definitions per agent
- Schema extension:

```sql
alter table agents add column mcp_capabilities jsonb;
-- Example:
{
  "resources": [
    {"name": "notebook_entries", "uri": "notebook://entries/*", "mime_type": "application/json"}
  ],
  "tools": [
    {"name": "query_notebook", "description": "Search NotebookBD entries", "input_schema": {...}}
  ],
  "prompts": [
    {"name": "daily_briefing", "description": "Generate morning summary", "arguments": [...]}
  ]
}
```

**Integration:**

- Agent CMDB generates MCP client code for any agent
- Example: MoltBot wants to call NotebookBD

1. Query Agent CMDB: "Get NotebookBD MCP endpoint"
2. Agent CMDB returns: `https://plexify.ai/mcp/notebookbd` + capability schema
3. MoltBot uses MCP client library to call `query_notebook` tool
4. NotebookBD returns structured results via MCP protocol

***

## Success Metrics

| Metric | Baseline (Current) | Target (Sprint 2) | Target (Sprint 4) | Measurement Method |
| :-- | :-- | :-- | :-- | :-- |
| **Session handoff time** | 15 min | <2 min | <1 min | Timed from "End session" to "First meaningful output in new session" |
| **Context reconstruction errors** | ~30% of sessions require correction | <5% | <1% | Count sessions where user says "That's not right, here's the actual state" |
| **Prompt reuse rate** | 0% (everything written from scratch) | 40% | 70% | % of prompts that use Agent CMDB templates vs. ad-hoc |
| **Agent discovery success rate** | N/A (manual routing) | 80% | 95% | % of routing requests where user accepts recommended agent |
| **Time to add new AI tool** | 2 hours | 30 min | 15 min | Timed from "Decide to add Gemini" to "First successful request via Agent CMDB" |
| **Ken's weekly time spent on orchestration** | ~90 min | 30 min | 15 min | Self-reported time log |

**North Star Metric:** **Agent Orchestration Overhead Ratio** = Time spent managing agents / Time spent building product. Current: ~15%. Target: <5%.

***

## Assumptions

| Assumption | Validation Strategy | Risk if Wrong | Mitigation |
| :-- | :-- | :-- | :-- |
| Ken's context handoff pattern generalizes to other PlexifySOLO users | Beta test with 5 BID directors and BD executives | Agent CMDB feels over-engineered for simpler use cases | Build progressive disclosure: simple UI for basic users, advanced features for power users |
| MCP becomes industry standard for agent-to-agent communication[^5][^9] | Monitor OpenAI, Anthropic adoption announcements | Invested in protocol that gets abandoned | Design Agent CMDB abstraction layer: MCP is one transport, can add REST/GraphQL fallbacks |
| Supabase can handle Agent CMDB query load at scale | Load testing with 1000 simulated agents | Database becomes bottleneck | Pre-emptively design sharding strategy, add read replicas |
| Prompt quality improvements from A/B testing justify added complexity | Run 10 A/B tests, measure ROI | Users ignore variants, complexity not worth it | Make variant creation opt-in, default to simple versioning |
| Agent CMDB worth building vs. using existing tools (LangChain, Haystack) | Comparative analysis of feature coverage | Reinventing wheel when solutions exist | Sprint 2 includes evaluation sprint: assess existing tools, document gaps Agent CMDB fills |


***

## Timeline

### Sprint 2 (2 weeks): Foundation

**Goal:** Minimum viable Agent CMDB that eliminates Ken's session handoff friction

**Deliverables:**

- Agent Registry (Feature 1) with Supabase schema + basic CRUD UI
- Prompt Template Library (Feature 2) with 5 core templates (session init, task assignment, code review, research, handoff)
- Context Handoff Protocol (Feature 3) auto-generation for Ken's current workflow
- Manual A/B testing capability (track 2 prompt variants, compare outcomes)

**Success Criteria:**

- Ken's morning session startup reduced from 15min → <5min
- Context reconstruction error rate <10%
- At least 3 handoff sessions completed successfully via Agent CMDB


### Sprint 3 (2 weeks): Orchestration

**Goal:** Enable agent-to-agent communication and discovery

**Deliverables:**

- Agent Discovery Service (Feature 4) with capability-based routing
- MCP Server Integration (Feature 6) for NotebookBD and MoltBot
- Agent performance metrics collection
- Automated variant deployment for A/B testing (Feature 5)

**Success Criteria:**

- MoltBot successfully queries NotebookBD via Agent CMDB discovery + MCP
- 2 A/B tests completed with statistical significance
- Agent discovery accuracy >80%


### Sprint 4 (2 weeks): Intelligence Layer

**Goal:** Make Agent CMDB learn and improve from usage patterns

**Deliverables:**

- Variant auto-promotion based on performance metrics
- Agent recommendation engine (suggest which agent to use for new task types)
- Agent CMDB analytics dashboard (Ken can see agent usage trends, success rates, cost per request)
- Documentation + video walkthrough for future PlexifySOLO users

**Success Criteria:**

- One variant auto-promoted after reaching confidence threshold
- Agent recommendation accuracy >90%
- Ken's orchestration time reduced to <20min/week

***

## Stakeholders

| Stakeholder | Role | Interest | Engagement Strategy |
| :-- | :-- | :-- | :-- |
| **Ken (Builder/Dogfooder)** | Solo founder, product lead | Primary user, validates every feature against real workflow | Daily testing, feedback loops, "Tyson Filter" decision-making |
| **Tyson (GTM Lead)** | Business development | Needs Agent CMDB to work invisibly so Ken ships faster | Weekly demo of time savings, impact on sprint velocity |
| **Future PlexifySOLO Users** | BID directors, BD executives, solo founders | Will use Agent CMDB as core orchestration layer | Design for accessibility (non-technical users), clear documentation |
| **Plexify AI Agents (MoltBot, NotebookBD, Ask Plexi)** | Autonomous software systems | Need reliable routing, context preservation, capability discovery | Formal MCP protocol, error handling, fallback strategies |
| **Claude Opus 4.5 (Architecture)** | Senior developer persona | Designs Agent CMDB technical architecture | Provide this PRD + access to Supabase schema, existing codebase patterns |
| **Claude Code (Implementation)** | Production code executor | Implements Agent CMDB backend + frontend | Provide CLAUDE.md, branch strategy, commit message templates |


***

## Constraints \& Dependencies

### Technical Constraints

| Constraint | Impact | Workaround |
| :-- | :-- | :-- |
| **Supabase free tier row limits** | Agent CMDB could hit limits with high session volume | Monitor usage, design data retention policy (archive sessions >90 days old) |
| **No real-time WebSocket for agent coordination yet** | Agent-to-agent communication limited to request-response | Sprint 4: Add Supabase Realtime subscriptions for live agent coordination |
| **MCP protocol still evolving[^5][^8]** | Breaking changes possible | Version MCP integrations, plan for migration path |
| **Limited observability into external AI tools (ChatGPT, Perplexity)** | Can't automatically log what happens in those sessions | Provide manual logging UI: "End session" button asks "What did you accomplish?" |

### Architectural Dependencies

| Dependency | Status | Risk | Mitigation |
| :-- | :-- | :-- | :-- |
| **Supabase backend** | Active, healthy | Supabase outage breaks Agent CMDB | Build local SQLite fallback for read-only access during outages |
| **OpenAI API (for MoltBot, Ask Plexi)** | Active, rate limits apply | API changes or rate limit hits | Abstract AI model calls behind Agent CMDB interface, support model swapping |
| **Mapbox (for Place Graph context)** | Active, token configured | Not directly used by Agent CMDB but context may reference Place Graph | Ensure Agent CMDB can handle missing context gracefully |
| **GitHub (for prompt versioning)** | Active | GitHub API rate limits | Use Supabase native versioning as primary, GitHub as backup sync |

### Regulatory \& Compliance

| Consideration | Current State | Action Required |
| :-- | :-- | :-- |
| **Data privacy (agent session logs may contain PII)** | No policy yet | Sprint 2: Add opt-in session logging, clear retention policy, GDPR-compliant deletion |
| **AI output liability (if agent gives bad advice)** | Not addressed | Sprint 3: Add disclaimer in Agent CMDB UI, log all AI outputs with timestamps for audit |
| **API key security (agents need credentials)** | Currently in .env files | Sprint 2: Use Supabase Vault for encrypted credential storage, never log API keys |


***

## Open Questions

| Question | Why It Matters | Resolution Strategy | Owner | Target Date |
| :-- | :-- | :-- | :-- | :-- |
| **Should Agent CMDB support non-Plexify agents (e.g., user's custom ChatGPT)?** | Broader applicability vs. increased complexity | Sprint 2: Focus on Plexify agents only. Sprint 4: Evaluate demand for "bring your own agent" | Ken | Sprint 2 end |
| **How to handle conflicting agent recommendations (two agents both claim capability)?** | Agent discovery needs tiebreaker logic | Implement confidence scoring + user override option. Log conflicts to improve routing algorithm. | Claude Opus 4.5 | Sprint 3 start |
| **What's the Agent CMDB data model for multi-tenant (future PlexifySOLO users)?** | Need isolation between users' agent configurations | Design now, implement later. Each user gets own namespace in `agents` table via `user_id` foreign key + RLS policies. | Claude Opus 4.5 | Sprint 2 start |
| **Should Agent CMDB version control store in Supabase or GitHub?** | Trade-off: Supabase is faster, GitHub has better diffing UI | Hybrid: Supabase for current versions, GitHub for long-term history + collaboration features. | Ken + Claude Code | Sprint 2 |
| **How to prevent prompt injection attacks via Agent CMDB templates?** | Security: malicious template could compromise agent behavior | Sprint 2: Template validation (no executable code in templates). Sprint 3: Sandboxed template rendering. | Claude Opus 4.5 | Sprint 2 |


***

## Risks

| Risk | Likelihood | Impact | Mitigation | Owner |
| :-- | :-- | :-- | :-- | :-- |
| **Over-engineering: Agent CMDB becomes more complex than the problem it solves** | Medium | High (wasted engineering time, Ken still manually manages) | Apply "Tyson Filter" ruthlessly: every feature must demo in <3 minutes. If Ken doesn't use it daily, cut it. | Ken |
| **MCP protocol adoption stalls, Agent CMDB betting on wrong standard** | Low | Medium (need to rebuild integration layer) | Design abstraction: Agent CMDB talks to agents via pluggable "transport layer" (MCP is one option, REST/GraphQL alternatives ready) | Claude Opus 4.5 |
| **Agent CMDB creates single point of failure (if down, all agents break)** | Medium | High (Ken's workflow blocked) | Build degraded mode: if Agent CMDB unavailable, agents fall back to manual configuration. Cache last-known-good configurations locally. | Claude Code |
| **Prompt versioning creates analysis paralysis (too many variants, can't decide)** | Medium | Medium (Ken spends more time testing variants than building) | Limit active variants to 3 max. Auto-expire variants after 2 weeks if no winner. Force decision. | Ken |
| **Session logging consumes excessive storage (every chat session logged)** | Low | Low (Supabase costs increase) | Implement data retention: archive sessions >90 days, delete >1 year. Compress session logs. | Claude Code |
| **Agent discovery routing becomes unpredictable ("Why did it send me to Agent X?")** | Medium | Medium (user frustration, trust loss) | Always show routing explanation: "Chose NotebookBD because your query mentioned 'NotebookBD entries' (confidence: 92%)." Allow user override. | Claude Opus 4.5 |


***

## Competitive Landscape

### Direct Competitors (Agent Orchestration Tools)

| Tool | Strengths | Weaknesses | Plexify Agent CMDB Differentiation |
| :-- | :-- | :-- | :-- |
| **LangChain** | Mature ecosystem, extensive integrations, strong developer community | Generic (not tailored to solopreneur workflows), requires significant coding, no opinionated UX | Agent CMDB is workflow-first (designed for Ken's orchestration patterns), zero-code for end users, Plexify-native |
| **Haystack by deepset** | Excellent for RAG pipelines, production-ready | Focused on search/retrieval, not general agent orchestration | Agent CMDB handles full agent lifecycle (personas, routing, versioning), not just RAG |
| **LlamaIndex** | Strong data ingestion + indexing | Limited agent-to-agent coordination | Agent CMDB's MCP integration enables true multi-agent workflows |
| **AutoGen (Microsoft)** | Multi-agent conversation framework | Research-focused, complex setup, no built-in session management | Agent CMDB prioritizes practical orchestration (handoffs, versioning, discovery) over conversation trees |

### Adjacent Tools (ITSM/CMDB)

| Tool | Lessons for Agent CMDB | What Not to Copy |
| :-- | :-- | :-- |
| **ServiceNow CMDB[^10]** | Structured CI relationships, change tracking, audit trails | Enterprise bloat, weeks to configure, over-engineered for SMB |
| **BMC Helix[^11]** | Strong integration with ITIL processes, dependency mapping | Requires ITIL expertise, not accessible to non-technical users |
| **Jira Service Management** | User-friendly UI, good for change management workflows | Not designed for AI agent metadata, would require heavy customization |

**Key Insight:** Traditional CMDBs manage hardware/software configuration items. Agent CMDB manages **intelligence configuration items** (agents, prompts, personas, routing rules). This is a new category.

### Gaps Plexify Agent CMDB Fills

1. **Solopreneur-first design:** Existing tools assume engineering teams. Agent CMDB assumes solo founders managing multiple AI tools.
2. **Prompt-as-CI:** No existing CMDB treats prompts as versionable, testable, deployable artifacts.
3. **Agent discovery service:** LangChain has "agents" but no registry or routing layer. You manually decide which agent to use.
4. **Dogfooding loop:** Agent CMDB isn't just a tool Ken uses—it's the prototype for PlexifySOLO. Competitive tools aren't building products from their own infrastructure.

***

## References

Configuration Management Database hierarchical domain model, Semantic Scholar[^12]
IT Service Management and CMDB for enhancing efficiency and compliance, IJRPR 2024[^13]
CMDB implementation in the Age of AI Copilot, International Journal Corner 2025[^14]
Block's custom AI agent Goose and Model Context Protocol, Lenny's Newsletter 2025[^5]
AI glossary: Model Context Protocol (MCP) definition, Lenny's Newsletter 2025[^9]
Configuration Management Database - Wikipedia definition[^15]
Building effective AI agents with Model Context Protocol, Red Hat Developers 2026[^6]
What is a CMDB? ServiceNow explainer[^10]
AI orchestration best practices, EPAM SolutionsHub 2025[^16]
Understanding Model Context Protocol architecture, Nebius 2025[^8]
Model Context Protocol architecture overview, Official MCP docs[^7]

Plexify AI Prompt Architect Session Introduction (agent personas, orchestration strategy)[^1]
Plexify AI Context Handoff Protocol template (session management structure)[^2]
Current Session Handoff - Place Graph Day 2 (real-world handoff example)[^3]
PlexifyAI Ecosystem Expansion 1-Week PRD Addendum (sprint context, technical architecture)[^4]

***

## Next Steps

1. **Ken reviews this PRD** with Claude Opus 4.5 for technical architecture feedback
2. **Claude Opus 4.5 designs Agent CMDB schema** (detailed Supabase tables, indexes, RLS policies)
3. **Claude Code implements Sprint 2 MVP** (Agent Registry + Prompt Library + Handoff Protocol)
4. **Ken dogfoods Agent CMDB** starting Sprint 2 Day 1, logs friction points for iteration
5. **Evaluate Sprint 2 success** against metrics: handoff time <5min, context errors <10%, Ken uses it daily

**First Build Session Prompt for Claude Opus 4.5:**

```
Context: You are the senior developer architecting the Plexify AI Agent Configuration Management Database (Agent CMDB). Review the attached PRD.

Your task: Design the complete Supabase database schema for Agent CMDB Sprint 2 MVP. Include:

1. All tables (agents, prompt_templates, agent_sessions, etc.) with complete column definitions
2. Foreign key relationships and constraints
3. Indexes for performance (query patterns: lookup by agent name, session history, template search)
4. Row Level Security (RLS) policies for multi-tenant future (user_id isolation)
5. Triggers for automatic timestamp updates (updated_at columns)
6. Sample seed data (3 agents: MoltBot, NotebookBD, Ask Plexi; 5 prompt templates)

Output format: SQL migration file ready for Supabase execution.

Reference: Existing Plexify Supabase schema from Place Graph MVP (see attached file:5 for patterns).
```


***

**Document Status:** Ready for Technical Architecture Review
**Prepared by:** Perplexity AI (with Ken's product strategy)
**Last Updated:** February 2, 2026
<span style="display:none">[^17][^18][^19][^20][^21][^22][^23][^24][^25][^26][^27][^28][^29][^30][^31][^32][^33][^34][^35][^36][^37][^38][^39][^40][^41][^42][^43][^44][^45][^46][^47][^48][^49][^50][^51][^52][^53][^54][^55][^56]</span>

<div align="center">⁂</div>

[^1]: Plexify-AI-Prompt-Architect-Session-Introduction.md

[^2]: Plexify-AI-Context-Handoff-Protocol.md

[^3]: Plexify-AI-Context-Handoff-Protocol-CURRENT-SESSION-HANDOFF-Last-Updated-January-31-2026-End-of-D.md

[^4]: PlexifyAI-Ecosystem-Expansion-1-Week-PRD-Addendum.md

[^5]: https://www.lennysnewsletter.com/p/blocks-custom-ai-agent-goose

[^6]: https://developers.redhat.com/articles/2026/01/08/building-effective-ai-agents-mcp

[^7]: https://modelcontextprotocol.io/docs/learn/architecture

[^8]: https://nebius.com/blog/posts/understanding-model-context-protocol-mcp-architecture

[^9]: https://www.lennysnewsletter.com/p/an-ai-glossary

[^10]: https://www.servicenow.com/products/it-operations-management/what-is-cmdb.html

[^11]: https://www.ijraset.com/best-journal/mastering-it-asset-intelligence-a-comparative-analysis-of-configuration-management-in-servicenow-and-bmc-helix

[^12]: https://www.semanticscholar.org/paper/e6fa6ded2e75e83dcefd3c07286421393995ea8c

[^13]: https://ijrpr.com/uploads/V6ISSUE1/IJRPR38096.pdf

[^14]: https://www.internationaljournalcorner.com/index.php/theijbm/article/view/173960

[^15]: https://en.wikipedia.org/wiki/Configuration_management_database

[^16]: https://solutionshub.epam.com/blog/post/ai-orchestration-best-practices

[^17]: Vertical AI Agents in Industry: Assessing PlexifyAEC's Potential in Construction Technology.md

[^18]: Addendum PRD prompt for Claude documents outline a strategic framework for Plexify AI, a specialized platform designed to unify five key roles in urban economic development: Business Improvement Districts (BIDs), Opportunity Zone managers, construction firms, local attractions, and real estate developers.md

[^19]: Do not  Use --- PLEXIFY AI ECOSYSTEM EXPANSION ROADMAP 9-Month Feature Build-Out Plan (Visual Summary).md

[^20]: PLEXIFY AI ECOSYSTEM EXPANSION RESEARCH.md

[^21]: http://izvestiapgups.editorum.ru/en/nauka/article/57806/view

[^22]: https://index.ieomsociety.org/index.cfm/article/view/ID/13445

[^23]: https://www.semanticscholar.org/paper/fb65456bfdbb7899aac014fab02fc10319415fc4

[^24]: https://ieeexplore.ieee.org/document/11034395/

[^25]: https://ibimapublishing.com/articles/CIBIMA/2024/917754/

[^26]: https://ieeexplore.ieee.org/document/10516161/

[^27]: http://arxiv.org/pdf/2410.20273.pdf

[^28]: https://arxiv.org/pdf/2410.20276.pdf

[^29]: https://arxiv.org/pdf/2306.01595.pdf

[^30]: https://arxiv.org/pdf/2203.14473.pdf

[^31]: https://www.shs-conferences.org/articles/shsconf/pdf/2020/05/shsconf_etltc2020_03002.pdf

[^32]: http://arxiv.org/pdf/2402.07332.pdf

[^33]: https://arxiv.org/pdf/2501.15475.pdf

[^34]: https://zenodo.org/record/2161855/files/s01211.2.0.pdf

[^35]: https://www.lennysnewsletter.com/p/the-essence-of-product-management?publication_id=10845\&post_id=139628654\&isFreemail=true\&r=4gcrc\&token=eyJ1c2VyX2lkIjo3NDgxNDk2LCJwb3N0X2lkIjoxMzk2Mjg2NTQsImlhdCI6MTcwMzE2MDUxNywiZXhwIjoxNzA1NzUyNTE3LCJpc3MiOiJwdWItMTA4NDUiLCJzdWIiOiJwb3N0LXJlYWN0aW9uIn0._7-57KL6gg0LZ05BsBDuPx4bdlpRMFdKfSfUXoWvaXw\&triedRedirect=true

[^36]: https://www.lennysnewsletter.com/p/in-defense-of-feature-team-product?publication_id=10845\&post_id=144951780\&action=share\&isFreemail=true\&r=4gcrc\&token=eyJ1c2VyX2lkIjo3NDgxNDk2LCJwb3N0X2lkIjoxNDQ5NTE3ODAsImlhdCI6MTcxNzQ5OTQzOCwiZXhwIjoxNzIwMDkxNDM4LCJpc3MiOiJwdWItMTA4NDUiLCJzdWIiOiJwb3N0LXJlYWN0aW9uIn0._tSy52rzsWGgxsh6DLKdHQaXiLaQK0u8RYRunngyys4\&triedRedirect=true

[^37]: https://www.lennysnewsletter.com/p/we-replaced-our-sales-team-with-20-ai-agents

[^38]: https://www.lennysnewsletter.com/p/chatgpt-apps-are-about-to-be-the?r=4obbfg\&shareImageVariant=overlay\&triedRedirect=true

[^39]: https://www.lennysnewsletter.com/p/how-figma-builds-product?publication_id=10845\&post_id=80853286\&isFreemail=true\&token=eyJ1c2VyX2lkIjo3NDgxNDk2LCJwb3N0X2lkIjo4MDg1MzI4NiwiaWF0IjoxNjY4NTE5MTM0LCJleHAiOjE2NzExMTExMzQsImlzcyI6InB1Yi0xMDg0NSIsInN1YiI6InBvc3QtcmVhY3Rpb24ifQ.LUXUN-dCnbEbG8T8-zVXGuGdcKlcPd8NLi3xFjiQZ3c\&triedRedirect=true

[^40]: https://www.lennysnewsletter.com/p/make-product-management-fun-again-9f6

[^41]: https://www.lennysnewsletter.com/feed

[^42]: https://www.lennysnewsletter.com/p/where-great-product-roadmap-ideas

[^43]: https://www.lennysnewsletter.com/p/community-wisdom-managing-fragmented

[^44]: https://www.lennysnewsletter.com/p/engineering-leadership-camille-fournier?publication_id=10845\&isFreemail=true\&triedRedirect=true

[^45]: https://www.lennysnewsletter.com/p/25-proven-tactics-to-accelerate-ai

[^46]: https://www.lennysnewsletter.com/p/how-linear-builds-product?075f0a22_page=1%2C2%2C2%2C1%2C1%2C1%2C2%2C2%2C3

[^47]: https://www.lennysnewsletter.com/p/community-wisdom-what-pms-need-to

[^48]: https://support.talkdesk.com/hc/en-us/articles/39096730105115-AI-Agent-Platform-Best-Practices

[^49]: https://artera.io/blog/model-context-protocol-explanation/

[^50]: https://www.redhat.com/en/topics/automation/what-is-a-configuration-management-database-cmdb

[^51]: https://onereach.ai/blog/best-practices-for-ai-agent-implementations/

[^52]: https://www.matrix42.com/en/cmdb-configuration-management-database

[^53]: https://kanerika.com/blogs/ai-agent-orchestration/

[^54]: https://otrs.com/blog/itam/cmdb/

[^55]: https://www.exabeam.com/explainers/agentic-ai/agentic-ai-frameworks-key-components-top-8-options/

[^56]: https://modelcontextprotocol.io

