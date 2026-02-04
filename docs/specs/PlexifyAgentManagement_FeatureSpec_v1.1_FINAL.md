# Plexify Agent Management — Feature Specification v1.1 (Consolidated)

**Author:** Ken D'Amato + Claude Opus (Sr. Dev Partner)  
**Date:** February 2, 2026  
**Sprint:** 2 (Post-Place Graph MVP)  
**Repository:** github.com/Plexify-AI/plexifybid  
**Branch:** `feature/agent-management`  
**PRD Constitution Compliance:** Phase 1 + Phase 2 + Phase 3 Tasks + Claude Code Handoff  
**Research Input:** Perplexity AI Agent CMDB PRD v1.0 (Feb 2, 2026)  
**Status:** All clarifications resolved. Ready for implementation.

---

## Executive Summary

Plexify Agent Management is a new feature within the PlexifyBID monorepo that provides a centralized registry, prompt template library, and session tracking system for all AI agents across the Plexify Suite. It replaces the current manual context handoff workflow (~15 min/session) with a structured, queryable system that makes agent configurations observable, prompt versions trackable, and session handoffs automatic.

This feature anchors the **Solopreneur Bill of Rights**: "The right to operate with the intelligence infrastructure of a large organization, despite being a team of one." Agent Management IS that infrastructure.

**Key Insight (from Perplexity research, preserved for marketing):** Traditional CMDBs manage hardware/software configuration items. Plexify Agent Management manages **intelligence configuration items** — agents, prompts, personas, routing rules. This is a new category.

**What this is NOT:** A standalone product, an enterprise CMDB, or a competitor to LangChain/AutoGen. It is a *feature* at `src/features/agent-management/` that serves Ken's daily workflow now and becomes a user-facing capability in PlexifySOLO later.

---

# STEP 1: FEATURE REFRAMING

## From "Agent CMDB" to "Agent Management"

| Aspect | Perplexity PRD (Research Input) | This Spec (Build-Ready) |
|--------|--------------------------------|------------------------|
| Name | Agent Configuration Management Database | **Plexify Agent Management** |
| Scope | Standalone product concept, 6 features across 3 sprints | Feature within PlexifyBID monorepo, 3 MVP features in Sprint 2 |
| Location | Unspecified | `src/features/agent-management/` |
| Route | Unspecified | `/agents` |
| Audience | Generic AI developers | Ken (dogfood), then PlexifySOLO users |
| SQL Schemas | `semver` type (doesn't exist natively in PG), single `agent_id` on sessions, `users(id)` FK assumed | `text` version field, many-to-many session_agents junction, `user_id text` (no FK until auth exists) |
| Architecture | Greenfield with MCP assumptions baked into Sprint 2 | Integrated with existing Supabase + Express patterns; MCP deferred to Sprint 3+ |

### Why "Agent Management" and Not "Agent CMDB"

"CMDB" is IT operations jargon that won't resonate with BID directors, BD executives, or solo founders. The *architectural pattern* parallels a CMDB — a system of record for configuration items — but the ServiceNow parallel ends at the concept level. The UI says "Agent Management." The README and future PlexifySOLO marketing can use the "intelligence configuration items" framing.

### Sidebar Navigation Placement

Current PlexifyBID sidebar:
```
Dashboard
NotebookBD
Place Graph
Library
Alerts
Settings
```

Recommended:
```
Dashboard
NotebookBD
Place Graph
Agent Management  ← NEW
Library
Alerts
Settings
```

**Rationale:** Agent Management bookends every working session. Ken opens it to review agent configs and start a session, works in NotebookBD/Place Graph, then returns to complete the session and generate the handoff. Placing it after workspace features and before reference/system features mirrors this daily flow.

### Relationship to Existing Features

| Existing Feature | Relationship to Agent Management |
|-----------------|----------------------------------|
| **NotebookBD** | Consumer. NotebookBD's RAG agent and structured output generators (Board Brief, Assessment Trends, OZRF Section) are registered as agents in the registry. NotebookBD can call Agent Management's API to load agent configs at runtime. |
| **Place Graph** | Future consumer. PlexiCoS hooks (Sprint 3+) will coordinate with registered agents. |
| **Ask Plexi** | Registered agent. The conversational AI engine is an intelligence CI with its own system prompt, model config, and capabilities. |
| **Plexi Agents** | Registered agents. Each automated workflow agent (analytics, reports, CRM sync) gets a registry entry. |
| **Express Tool Registry** | Input. The existing centralized tool registry pattern defines *what tools exist*. Agent Management adds *which agents can use which tools*, plus persistence, UI, and session tracking. Agent Management is a superset. |
| **Prompt Manager (planned)** | Subsumed. The Prompt Template Library replaces the standalone Prompt Manager Claude Skill that was originally slated for Sprint 2. |

---

# STEP 2: SPRINT 2 MVP SCOPE

## The Tyson Filter (Adapted for Dogfooding)

**"Does this eliminate Ken's 15-minute context reconstruction problem?"**

If the answer isn't a clear yes, it's Sprint 3+.

### Feature Scoping Matrix

| # | Feature | Perplexity Sprint | This Spec | Rationale |
|---|---------|------------------|-----------|-----------|
| 1 | **Agent Registry** | Sprint 2 | ✅ Sprint 2 | Core system of record. Without it, nothing else works. |
| 2 | **Prompt Template Library** | Sprint 2 | ✅ Sprint 2 | Directly addresses prompt version chaos and reuse. |
| 3 | **Handoff Protocol Engine** | Sprint 2 | ✅ Sprint 2 | Directly eliminates the 15-minute context reconstruction problem. |
| 4 | Agent Discovery & Routing | Sprint 3 | ❌ Sprint 3+ | Requires MCP architecture ADR. Protocol still evolving. |
| 5 | Prompt A/B Testing | Sprint 2 (partial) | ❌ Sprint 3+ | Perplexity tried to add "manual A/B" to Sprint 2. Scope creep. Cut. |
| 6 | MCP Server Integration | Sprint 3 | ❌ Sprint 3+ | Needs protocol stability and OpenClaw integration readiness. |

### What Got Cut vs. Perplexity PRD

The Perplexity PRD squeezed "manual A/B testing capability (track 2 prompt variants, compare outcomes)" into Sprint 2 deliverables. That's premature optimization. Operating Principle 10: "Ship, Learn, Loop, Repeat." You can't A/B test prompts until you have prompts registered and sessions tracked. Sprint 2 builds the foundation. Sprint 3 adds analysis.

### Three Tyrannies Mapping

| Tyranny | How Sprint 2 MVP Addresses It |
|---------|-------------------------------|
| **Execution** | Agent Registry eliminates manual agent configuration scattered across markdown files, `.env` variables, and memory. One place to define, update, and version all agents. |
| **Ambiguity** | Prompt Template Library removes guesswork from "what prompt should I use?" Handoff Protocol Engine removes ambiguity from "where did I leave off?" |
| **Bandwidth** | Handoff generation saves ~15 min/session x ~4 sessions/day = ~1 hour/day returned to building. |

### Bloom-Maslow Mapping

| Feature | Maslow Layer (Friction Removed) | Bloom Level (Capability Unlocked) |
|---------|-------------------------------|-----------------------------------|
| Agent Registry | Physiological — "Can I even find my agent configs?" | Remember — "I know what agents exist and what they do" |
| Prompt Template Library | Safety — "Will my prompts produce reliable results?" | Understand — "I know how to structure prompts for each agent" |
| Handoff Protocol Engine | Belonging — "Do my sessions connect into a continuous flow?" | Apply — "I can resume work in <3 minutes instead of 15" |

### PlexiCoS Sprint Sequencing

PlexiCoS (Chief of Staff agent) uses Cloudflare Workers via Moltworker architecture. The scope is split:

| Deliverable | Sprint | Rationale |
|-------------|--------|-----------|
| PlexiCoS registry entry (configuration item) | **Sprint 2** | Seed data in Agent Management. Registry is runtime-agnostic. Status = `draft`. |
| PlexiCoS Cloudflare Workers deployment | **Sprint 3** | Complex infrastructure: paid Cloudflare tier, Docker, Wrangler CLI, zero-trust auth. |
| PlexiCoS ↔ Agent Management API integration | **Sprint 3** | Runtime config loading from Supabase via MCP or REST. |
| PlexiCoS ↔ other agents MCP routing | **Sprint 3+** | Depends on Agent Discovery & Routing feature. |

**Why this split works:** The Agent Management registry stores *intelligence configuration items* independent of where the agent runs. Sprint 2 answers "What agents exist?" Sprint 3 answers "How does PlexiCoS run on Cloudflare?"

---

# STEP 3: PHASE 1 SPECIFICATION — THE "WHAT & WHY"

## 3.1 Overview

Plexify Agent Management provides a centralized registry for AI agents, a versioned library for prompt templates, and an automated session handoff engine within the PlexifyBID application. It replaces fragmented, manual AI agent configuration with an observable, queryable system that compounds intelligence over time. The feature serves Ken's immediate dogfooding needs and establishes the foundation for PlexifySOLO's user-facing agent management capabilities.

## 3.2 User Scenarios

### Scenario 1: Register a New Agent

```
GIVEN Ken has a new AI workflow to formalize (e.g., an OZ compliance checker)
WHEN  he navigates to /agents and clicks "New Agent"
THEN  he sees a form with fields: name, description, product line, model, 
      persona/system prompt, capabilities (tag input), and status
AND   upon saving, the agent appears in the registry with a unique slug 
      (auto-generated from name, editable) and version "1.0.0"
AND   the agent is immediately queryable via the Express API
```

### Scenario 2: Edit an Existing Agent's Persona

```
GIVEN the "PlexiCoS" agent is registered with a system prompt
WHEN  Ken navigates to /agents/plexicos and edits the persona field
THEN  the version auto-increments the PATCH segment (1.0.0 -> 1.0.1)
AND   the previous version's persona text is preserved in the version history
AND   a timestamp and change summary are recorded
```

### Scenario 3: Create a Prompt Template

```
GIVEN Ken wants to standardize how he starts Claude Code sessions
WHEN  he navigates to /agents/templates and clicks "New Template"
THEN  he sees an editor with:
      - Name, slug, and category dropdown
      - Template body textarea with {{variable}} syntax
      - Variable definition panel (name, type, default value, required flag)
      - Live preview pane rendering the template with default values
AND   upon saving, the template is versioned and available for use
      in handoff generation and manual prompt construction
```

### Scenario 4: Render a Template with Variables

```
GIVEN a "claude-code-session-init" template exists with variables 
      {{branch_name}}, {{sprint_day}}, {{last_commit}}, {{first_task}}
WHEN  Ken clicks "Use Template" and fills in the variable values
THEN  the live preview renders the complete prompt with his values injected
AND   a "Copy to Clipboard" button copies the rendered text
AND   a usage event is logged (template_id, timestamp)
```

### Scenario 5: Start a Work Session

```
GIVEN Ken is beginning a development session with Claude Code
WHEN  he navigates to /agents/sessions and clicks "Start Session"
THEN  he selects which agent(s) this session involves (multi-select)
AND   selects a session type (development, strategy, research, review)
AND   the system loads the latest handoff from the most recent completed 
      session for the selected agent(s)
AND   presents a rendered "Start With" prompt ready to copy-paste
AND   creates a new session record with status "active"
```

### Scenario 6: Complete a Session and Generate Handoff

```
GIVEN Ken has finished a development session
WHEN  he navigates to the active session and clicks "Complete Session"
THEN  he sees a structured form to capture:
      - Decisions made (text + rationale + reversibility toggle per decision)
      - Files changed (with optional "Detect from git" button)
      - Blockers encountered (text + resolved/unresolved toggle per blocker)
      - Next tasks (ordered text list, minimum 1 required)
AND   the Handoff Protocol Engine renders a "Next Session Should Start With" 
      prompt using the designated handoff template
AND   the rendered prompt is displayed for review with "Copy to Clipboard"
AND   the session status changes to "completed" with an ended_at timestamp
AND   this handoff is automatically loaded when the next session starts 
      for the same agent
```

### Scenario 7: Browse Agent Registry (Dashboard)

```
GIVEN Ken wants an overview of all agents across the Plexify platform
WHEN  he navigates to /agents
THEN  he sees a filterable card grid of all registered agents
AND   can filter by: product line (AEC, BID, BIZ, SOLO, PLATFORM), 
      status (active, draft, archived, deprecated), model
AND   each card shows: name, description (truncated), product line badge, 
      status indicator, model, last updated timestamp
AND   a summary bar shows: total agents, active count, counts by product line
AND   clicking a card opens its detail/edit view
```

### Scenario 8: View Session History

```
GIVEN Ken wants to review his recent work sessions
WHEN  he navigates to /agents/sessions
THEN  he sees a reverse-chronological list of sessions with:
      - Agent name(s), session type badge, start/end times, status
      - Quick-access "View Handoff" button for completed sessions
AND   can filter by agent, date range, session type, and status
AND   clicking a session opens full details: decisions, files, 
      blockers, next tasks, and the generated handoff prompt
```

### Scenario 9: Abandon a Stale Session

```
GIVEN Ken started a session yesterday but never completed it
WHEN  he navigates to /agents/sessions and sees the stale active session
AND   clicks "Abandon Session"
THEN  a confirmation modal appears asking for an optional reason
AND   upon confirmation, the session status changes to "abandoned"
AND   ended_at is set to the current timestamp
AND   the session no longer blocks starting new sessions
```

## 3.3 Functional Requirements

### Agent Registry

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | System SHALL provide CRUD operations for agent definitions | Must |
| FR-002 | Each agent SHALL have a unique slug (auto-generated from name via kebab-case, editable before first save) | Must |
| FR-003 | Agent persona field SHALL support multi-line text (system prompts), rendered as monospace in the UI | Must |
| FR-004 | Agent capabilities SHALL be stored as a JSON array of string tags | Must |
| FR-005 | Agent status SHALL be one of: `active`, `draft`, `archived`, `deprecated` | Must |
| FR-006 | Agent product_line SHALL be one of: `AEC`, `BID`, `BIZ`, `SOLO`, `PLATFORM` | Must |
| FR-007 | Agent version SHALL be a text string following semver format (X.Y.Z). PATCH auto-increments on save. MINOR/MAJOR bumps are manual. | Must |
| FR-008 | System SHALL prevent deletion of agents with active sessions (status = `active`) | Must |
| FR-009 | Archiving an agent SHALL soft-delete (set status to `archived`), not hard-delete rows | Must |
| FR-010 | System SHALL display agent count by product line and status on the registry overview page | Should |
| FR-011 | Agent type SHALL be one of: `conversational`, `task_executor`, `orchestrator`, `specialist` | Should |
| FR-012 | Agent metadata JSONB field SHALL store extensible key-value pairs (model temperature, max_tokens, context_window, etc.) | Must |

### Prompt Template Library

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-013 | System SHALL provide CRUD operations for prompt templates | Must |
| FR-014 | Template body SHALL support `{{variable_name}}` syntax for variable injection | Must |
| FR-015 | Each template SHALL define its variables as a JSON schema: array of `{name, type, default_value, required, description}` | Must |
| FR-016 | Supported variable types: `string`, `text` (multiline), `number`, `boolean`, `date`, `json` | Must |
| FR-017 | System SHALL provide a live preview pane that renders the template with default/sample variable values | Must |
| FR-018 | Templates SHALL be categorizable: `handoff`, `session_init`, `task_assignment`, `code_review`, `research`, `reporting`, `system`, `custom` | Must |
| FR-019 | Templates MAY be linked to a specific agent (agent_id FK, nullable) or be agent-agnostic | Must |
| FR-020 | Template version SHALL auto-increment PATCH on each save | Should |
| FR-021 | System SHALL provide a "Render Template" function accepting variable values and returning rendered text | Must |
| FR-022 | Rendered output SHALL include a "Copy to Clipboard" action with visual confirmation | Must |
| FR-023 | System SHALL track usage_count per template (incremented on each render) | Should |
| FR-024 | System SHALL ship with 5 seed templates: session-init, task-assignment, code-review, research, handoff | Must |

### Handoff Protocol Engine

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-025 | System SHALL provide CRUD operations for agent sessions | Must |
| FR-026 | A session SHALL reference one or more agents via a junction table (many-to-many) | Must |
| FR-027 | Session status SHALL be one of: `active`, `completed`, `abandoned` | Must |
| FR-028 | Only ONE session per user may be `active` at a time (enforced at API level) | Must |
| FR-029 | Session type SHALL be one of: `development`, `strategy`, `research`, `review`, `debug`, `custom` | Must |
| FR-030 | Completing a session SHALL require at minimum one "next task" entry | Must |
| FR-031 | Completing a session SHALL auto-generate a handoff prompt by rendering the designated handoff template with session data as variables | Must |
| FR-032 | The default handoff template SHALL match the structure of Ken's current Context Handoff Protocol: branch, PR, status, decisions (with rationale + reversibility), blockers, files changed, next tasks, first task | Must |
| FR-033 | Generated handoff prompts SHALL be stored on the session record (handoff_prompt column) | Must |
| FR-034 | Starting a new session for an agent SHALL auto-load the most recent completed session's handoff as the "context in" | Must |
| FR-035 | Session decisions_made SHALL be stored as a JSONB array of `{decision, rationale, reversible}` objects | Must |
| FR-036 | Session blockers SHALL be stored as a JSONB array of `{description, resolved, resolution}` objects | Must |
| FR-037 | System SHALL display a session timeline per agent (reverse-chronological, with handoff links) | Should |
| FR-038 | SessionCompleteForm SHALL provide an optional "Detect from git" action that runs `git diff --name-only` and populates the files_changed field | Should |
| FR-039 | Git detection SHALL fail gracefully with a user-friendly message if not in a git repository or if the command errors | Must |
| FR-040 | System SHALL provide an "Abandon Session" action for active sessions, setting status to `abandoned` and recording ended_at | Must |
| FR-041 | Abandon action SHALL display a confirmation modal with an optional reason field | Should |

## 3.4 Key Entities (Conceptual Data Model)

```
+------------------+       +--------------------+       +-------------------+
|     agents        |       |  prompt_templates   |       |  agent_sessions    |
+------------------+       +--------------------+       +-------------------+
| id (uuid PK)      |<--+  | id (uuid PK)        |       | id (uuid PK)       |
| name (text)        |   |  | name (text)          |       | session_type (text) |
| slug (text UNIQUE) |   |  | slug (text UNIQUE)   |       | status (text)       |
| description (text) |   +--| agent_id (uuid FK?)  |       | started_at (tstz)   |
| product_line (text)|   |  | category (text)      |       | ended_at (tstz?)    |
| agent_type (text)  |   |  | template_body (text) |       | context_in (text?)  |
| model (text)       |   |  | variables (jsonb)    |       | context_out (text?) |
| persona (text)     |   |  | version (text)       |       | handoff_prompt (t?) |
| capabilities (jsonb|   |  | usage_count (int)    |       | decisions_made (j)  |
| status (text)      |   |  | is_active (bool)     |       | files_changed (jsonb|
| version (text)     |   |  | metadata (jsonb)     |       | blockers (jsonb)    |
| metadata (jsonb)   |   |  | created_at (tstz)    |       | next_tasks (jsonb)  |
| user_id (text)     |   |  | updated_at (tstz)    |       | abandon_reason (t?) |
| created_at (tstz)  |   |  +--------------------+       | metadata (jsonb)    |
| updated_at (tstz)  |   |                                | user_id (text)      |
+------------------+   |                                | created_at (tstz)   |
                       |  +------------------------+      | updated_at (tstz)   |
                       |  |   session_agents        |      +-------------------+
                       |  |   (junction table)      |            ^
                       |  +------------------------+            |
                       +--| agent_id (uuid FK)      |            |
                          | session_id (uuid FK)    |------------+
                          | role (text)             |
                          | PK: (agent_id,session_id|
                          +------------------------+
```

### Differences from Perplexity Schema

| Perplexity Proposed | This Spec | Reason |
|---------------------|-----------|--------|
| `version semver` type | `version TEXT` | `semver` is not a native PostgreSQL type |
| `users(id)` FK on sessions + templates | `user_id TEXT DEFAULT 'ken'` | No auth/users table exists yet. Ken is sole user. Multi-tenant FK deferred to Sprint 3+ |
| Single `agent_id` on sessions | `session_agents` junction table | Supports multi-agent sessions per Scenario 5 |
| `parent_session_id` self-FK | Removed | Session chaining is implicit via agent + chronological order |
| `author_id` FK on templates | Removed | Same as user_id reasoning — sole user, no auth |
| `avg_effectiveness_score` on templates | Removed | Sprint 3+ A/B testing scope |
| `performance_metrics` on agents | Removed | Sprint 3+ observability scope |
| No `context_in` column | Added | Stores what was loaded at session start (previous handoff) |
| No `session_type` column | Added | Enables filtering by development, strategy, research, etc. |
| No `slug` fields | Added to agents + templates | URL-friendly routes |
| No `agent_type` | Added | conversational, task_executor, orchestrator, specialist |
| No `abandon_reason` | Added | Captures why a session was abandoned |

## 3.5 Success Metrics

| Metric | Baseline (Current) | Sprint 2 Target | How Measured |
|--------|-------------------|-----------------|--------------|
| Context reconstruction time per session | ~15 min | <3 min | Self-reported timer on first 10 sessions |
| Agent configurations in one place | 0% (scattered) | 100% of active agents registered | Registry count vs. known agent list |
| Prompt template reuse rate | 0% (written from scratch) | >=50% of sessions use a template | Template render count / total sessions |
| Session handoff completion rate | ~50% (manual doc, often skipped) | >=80% of sessions generate a handoff | Completed sessions / started sessions |
| Time from session end to handoff ready | ~10 min (manual writing) | <2 min (structured form + auto-render) | Timestamp delta |

**North Star Metric:** Agent Orchestration Overhead Ratio = time managing agents / time building product. Current: ~15%. Sprint 2 Target: <8%.

## 3.6 Out of Scope — Sprint 2 Does NOT Include

| Item | Why Deferred | Target |
|------|-------------|--------|
| Agent Discovery & Routing Service | Requires MCP architecture ADR. No agent-to-agent communication needed until PlexiCoS integration. | Sprint 3+ |
| Prompt A/B Testing Framework | Optimization before foundation is premature. Need usage data first. | Sprint 3+ |
| MCP Server Integration Layer | Protocol still evolving. OpenClaw integration not stable. | Sprint 3+ |
| Multi-tenant isolation (RLS policies, user_id FK) | Ken is sole user. Auth system doesn't exist yet. | Sprint 3+ |
| Agent performance metrics collection | No observability infrastructure yet. | Sprint 3+ |
| Git-backed prompt versioning | Supabase native versioning sufficient for MVP. | Sprint 4+ |
| Real-time WebSocket agent coordination | Request-response sufficient for MVP. | Sprint 4+ |
| API key management via Supabase Vault | Currently in .env files, works for sole user. | Sprint 3+ |
| **PlexiCoS Cloudflare Workers deployment** | Complex infrastructure (paid tier, Docker, Wrangler, zero-trust). Orthogonal to handoff problem. | **Sprint 3** |
| **Mobile-responsive Agent Management UI** | Desktop-only workflow for Ken's dogfooding. | Sprint 4+ |

---

# STEP 4: PHASE 2 SPECIFICATION — THE "HOW"

## 4.1 Architecture Decision Records

### ADR-001: Agent Registry Storage — Supabase vs. Local JSON

**Status:** Accepted  
**Date:** February 2, 2026

**Context:** Two options for persistent storage: (a) Supabase PostgreSQL, consistent with Place Graph and NotebookBD, or (b) local JSON files in the repo (faster, no DB dependency, works offline).

**Decision:** **Supabase PostgreSQL.**

| Factor | Supabase | Local JSON |
|--------|----------|------------|
| Consistency with codebase | Matches Place Graph hooks | Introduces new data pattern |
| Queryability | SQL filtering, sorting, joins | Full-file load + client-side filter |
| Multi-tenant future | RLS policies ready when needed | Requires migration later |
| Offline access | Requires network | Always available |
| Session tracking | Relational joins across tables | Complex with flat files |

**Consequences:** Supabase dependency. If Supabase is down, Agent Management is unavailable. Acceptable — Place Graph and NotebookBD have the same dependency. Local cache fallback is Sprint 3+ if needed.

---

### ADR-002: Template Variable Injection — Simple Replace vs. Templating Engine

**Status:** Accepted  
**Date:** February 2, 2026

**Context:** Templates use `{{variable_name}}` syntax. Options: (a) regex-based string replacement, or (b) Handlebars/Mustache engine with conditionals and loops.

**Decision:** **Simple string replacement for Sprint 2.** Regex: `/\{\{(\w+)\}\}/g` with a lookup map.

| Factor | Simple Replace | Templating Engine |
|--------|---------------|-------------------|
| Implementation time | ~30 min | ~4 hours |
| Covers Sprint 2 cases | All 5 seed templates are flat injection | Overkill |
| Conditionals / loops | Not supported | Supported |
| Migration risk | Low — `{{var}}` is Handlebars-compatible subset | N/A |

**Consequences:** No conditional logic in Sprint 2 templates. 

**Future Upgrade Path:** When Sprint 3+ templates require conditional logic (`{{#if}}`, `{{#each}}`), migrate to Handlebars.js. The existing `{{variable}}` syntax is fully Handlebars-compatible, so all Sprint 2 templates will work without modification.

---

### ADR-003: Session Handoff Storage — DB Column vs. Markdown File

**Status:** Accepted  
**Date:** February 2, 2026

**Context:** Where does the generated handoff prompt live? Options: (a) `handoff_prompt TEXT` column on `agent_sessions`, (b) markdown file in the repo, or (c) both.

**Decision:** **(a) Supabase column as primary, with "Copy to Clipboard" + "Download .md" buttons in the UI.**

| Factor | DB Column | Markdown File | Both |
|--------|-----------|--------------|------|
| Queryable | Load via API on next session start | Requires file system | Redundant query paths |
| Portable | Copy-paste to any AI tool | Upload file | Both work |
| Implementation | One column | File generation + path management | Most complex |
| Version history | Each session = one handoff (implicit) | Git commits | Redundant |

**Consequences:** Handoff lives in the database. UI provides "Copy to Clipboard" (primary) and "Download .md" (secondary) for portability to ChatGPT, Perplexity, Kimi, etc.

---

## 4.2 Data Models — Supabase Migration SQL

```sql
-- ============================================================
-- Plexify Agent Management — Sprint 2 MVP Schema
-- Migration: 20260202_agent_management.sql
-- ============================================================

-- Enable UUID generation (should already exist from Place Graph)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================
-- TABLE: agents
-- =========================
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  product_line TEXT NOT NULL CHECK (product_line IN ('AEC','BID','BIZ','SOLO','PLATFORM')),
  agent_type TEXT NOT NULL DEFAULT 'specialist'
    CHECK (agent_type IN ('conversational','task_executor','orchestrator','specialist')),
  model TEXT,
  persona TEXT,
  capabilities JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('active','draft','archived','deprecated')),
  version TEXT NOT NULL DEFAULT '1.0.0',
  metadata JSONB DEFAULT '{}',
  user_id TEXT DEFAULT 'ken',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agents_product_line ON agents(product_line);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_slug ON agents(slug);

-- =========================
-- TABLE: prompt_templates
-- =========================
CREATE TABLE IF NOT EXISTS prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN (
    'handoff','session_init','task_assignment','code_review',
    'research','reporting','system','custom'
  )),
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  template_body TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]',
  version TEXT NOT NULL DEFAULT '1.0.0',
  usage_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  user_id TEXT DEFAULT 'ken',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_templates_category ON prompt_templates(category);
CREATE INDEX idx_templates_agent_id ON prompt_templates(agent_id);
CREATE INDEX idx_templates_slug ON prompt_templates(slug);

-- =========================
-- TABLE: agent_sessions
-- =========================
CREATE TABLE IF NOT EXISTS agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_type TEXT NOT NULL CHECK (session_type IN (
    'development','strategy','research','review','debug','custom'
  )),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','completed','abandoned')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  context_in TEXT,
  context_out TEXT,
  handoff_prompt TEXT,
  decisions_made JSONB DEFAULT '[]',
  files_changed JSONB DEFAULT '[]',
  blockers JSONB DEFAULT '[]',
  next_tasks JSONB DEFAULT '[]',
  abandon_reason TEXT,
  metadata JSONB DEFAULT '{}',
  user_id TEXT DEFAULT 'ken',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_status ON agent_sessions(status);
CREATE INDEX idx_sessions_started_at ON agent_sessions(started_at DESC);

-- =========================
-- TABLE: session_agents (junction)
-- =========================
CREATE TABLE IF NOT EXISTS session_agents (
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'primary'
    CHECK (role IN ('primary','supporting')),
  PRIMARY KEY (agent_id, session_id)
);

CREATE INDEX idx_session_agents_session ON session_agents(session_id);
CREATE INDEX idx_session_agents_agent ON session_agents(agent_id);

-- =========================
-- TRIGGER: auto-update updated_at
-- =========================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER templates_updated_at
  BEFORE UPDATE ON prompt_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON agent_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================
-- SEED DATA: Initial Agents (5)
-- =========================
INSERT INTO agents (name, slug, description, product_line, agent_type, model, persona, capabilities, status, version) VALUES
(
  'Ask Plexi',
  'ask-plexi',
  'Conversational AI engine for natural language querying across all integrated platforms. Executive-grade tone, multi-source data synthesis.',
  'PLATFORM',
  'conversational',
  'claude-sonnet-4',
  'You are Ask Plexi, the intelligence engine for the Plexify platform. You answer questions about projects, BIDs, Opportunity Zones, stakeholders, and construction business development with an executive-grade conversational tone. Always cite sources. Never hallucinate. When uncertain, say so.',
  '["natural_language_query", "multi_source_synthesis", "executive_briefing"]',
  'active',
  '1.0.0'
),
(
  'PlexiCoS',
  'plexicos',
  'AI Chief of Staff running on Cloudflare Workers via Moltworker. Orchestrates cross-agent workflows, generates briefings, routes requests, manages long-running automation with enterprise-grade security.',
  'PLATFORM',
  'orchestrator',
  'claude-sonnet-4',
  'You are PlexiCoS, the AI Chief of Staff for the Plexify platform. You run on Cloudflare Workers infrastructure for enterprise-grade security and sandboxed execution. Your responsibilities:

1. Route incoming requests to the appropriate specialist agent
2. Generate morning briefings summarizing overnight activity and priorities
3. Coordinate multi-agent workflows for complex tasks
4. Maintain session continuity across agent handoffs
5. Flag blockers and escalate decisions requiring human input

Be concise, action-oriented, and proactive. When routing, explain your reasoning. When briefing, prioritize by impact.',
  '["request_routing", "briefing_generation", "task_prioritization", "cross_agent_coordination", "workflow_orchestration", "cloudflare_workers", "moltworker"]',
  'draft',
  '0.1.0'
),
(
  'NotebookBD RAG Agent',
  'notebookbd-rag',
  'RAG-powered document analysis agent for NotebookBD. Processes uploaded sources, generates citations, produces structured outputs.',
  'BID',
  'specialist',
  'gpt-4o',
  'You are the NotebookBD RAG Agent. You analyze uploaded documents about Business Improvement Districts and produce structured intelligence outputs. Always cite specific sources with page numbers. Support Board Brief, Assessment Trends, and OZRF Section output formats.',
  '["document_rag", "citation_generation", "structured_output", "bid_analysis"]',
  'active',
  '1.0.0'
),
(
  'Place Graph Analyst',
  'place-graph-analyst',
  'Ecosystem mapping and spatial analysis agent for BID boundaries, OZ tracts, and development sites.',
  'BID',
  'specialist',
  'claude-sonnet-4',
  'You are the Place Graph Analyst. You help users understand spatial relationships between Business Improvement Districts, Opportunity Zone census tracts, and development sites. Provide geographic context, identify patterns, and surface opportunities based on proximity and overlap.',
  '["spatial_analysis", "ecosystem_mapping", "opportunity_identification", "bid_oz_correlation"]',
  'draft',
  '0.1.0'
),
(
  'Handoff Protocol Agent',
  'handoff-protocol',
  'Meta-agent for generating session handoff prompts from structured session data.',
  'SOLO',
  'task_executor',
  'claude-sonnet-4',
  'You generate session handoff prompts. Given structured data about a completed work session (decisions, files changed, blockers, next tasks), produce a clear, copy-paste-ready prompt that another AI tool can consume to resume the work with full context. Follow the Plexify Context Handoff Protocol format.',
  '["handoff_generation", "context_synthesis", "session_continuity"]',
  'active',
  '1.0.0'
);

-- =========================
-- SEED DATA: Core Templates (5)
-- =========================
INSERT INTO prompt_templates (name, slug, category, template_body, variables, version) VALUES
(
  'Session Init — Claude Code',
  'session-init-claude-code',
  'session_init',
  E'I''m continuing {{project_name}} development. Key context:\n\n- Repo: {{repo_url}}\n- Current branch: {{branch_name}}\n- Sprint: {{sprint_name}}, Day {{sprint_day}}\n- Last commit: {{last_commit}}\n\nPrevious session summary:\n{{previous_handoff}}\n\nCurrent status: {{current_status}}\n\nFIRST TASK: {{first_task}}',
  '[{"name":"project_name","type":"string","default_value":"PlexifyBID","required":true,"description":"Active project name"},{"name":"repo_url","type":"string","default_value":"github.com/Plexify-AI/plexifybid","required":true,"description":"Repository URL"},{"name":"branch_name","type":"string","default_value":"","required":true,"description":"Current git branch"},{"name":"sprint_name","type":"string","default_value":"","required":true,"description":"Sprint name"},{"name":"sprint_day","type":"number","default_value":"1","required":true,"description":"Day within sprint"},{"name":"last_commit","type":"string","default_value":"","required":false,"description":"Last commit SHA"},{"name":"previous_handoff","type":"text","default_value":"No previous session.","required":false,"description":"Previous session handoff"},{"name":"current_status","type":"text","default_value":"","required":true,"description":"Current state"},{"name":"first_task","type":"string","default_value":"","required":true,"description":"First task"}]',
  '1.0.0'
),
(
  'Task Assignment — Code Implementation',
  'task-assignment-code',
  'task_assignment',
  E'## Task: {{task_name}}\n\n**Branch:** {{branch_name}}\n**Goal:** {{goal}}\n\n**What to implement:**\n{{implementation_steps}}\n\n**Acceptance criteria:**\n{{acceptance_criteria}}\n\n**Commit message:** `{{commit_type}}({{commit_scope}}): {{commit_description}}`\n\nAfter push, reply with commit SHA.',
  '[{"name":"task_name","type":"string","default_value":"","required":true,"description":"Task name"},{"name":"branch_name","type":"string","default_value":"","required":true,"description":"Target branch"},{"name":"goal","type":"string","default_value":"","required":true,"description":"One-sentence goal"},{"name":"implementation_steps","type":"text","default_value":"","required":true,"description":"Steps to implement"},{"name":"acceptance_criteria","type":"text","default_value":"","required":true,"description":"Success criteria"},{"name":"commit_type","type":"string","default_value":"feat","required":true,"description":"Commit type"},{"name":"commit_scope","type":"string","default_value":"","required":true,"description":"Commit scope"},{"name":"commit_description","type":"string","default_value":"","required":true,"description":"Commit description"}]',
  '1.0.0'
),
(
  'Code Review — PR Analysis',
  'code-review-pr',
  'code_review',
  E'Review PR #{{pr_number}} on branch `{{branch_name}}`.\n\n**Focus areas:**\n- Security: {{security_focus}}\n- Performance: {{performance_focus}}\n- Code style: Airbnb guide + Plexify naming conventions\n- AEC domain: Variable names reflect domain language\n\n**Files changed:**\n{{files_changed}}\n\nProvide feedback as: MUST FIX / SHOULD FIX / NICE TO HAVE.',
  '[{"name":"pr_number","type":"number","default_value":"","required":true,"description":"PR number"},{"name":"branch_name","type":"string","default_value":"","required":true,"description":"PR branch"},{"name":"security_focus","type":"string","default_value":"Input validation, auth checks, no hardcoded secrets","required":false,"description":"Security priorities"},{"name":"performance_focus","type":"string","default_value":"Query efficiency, bundle size, render performance","required":false,"description":"Performance priorities"},{"name":"files_changed","type":"text","default_value":"","required":true,"description":"Files in the PR"}]',
  '1.0.0'
),
(
  'Research — Topic Investigation',
  'research-topic',
  'research',
  E'Research topic: {{topic}}\n\n**Context:** {{context}}\n**Questions:**\n{{questions}}\n\n**Output format:**\n- Executive summary (3-5 sentences)\n- Key findings table (Finding | Source | Confidence | Relevance to Plexify)\n- Recommended actions for {{product_line}}\n- Sources with URLs\n\nPrioritize sources from: {{preferred_sources}}',
  '[{"name":"topic","type":"string","default_value":"","required":true,"description":"Research topic"},{"name":"context","type":"text","default_value":"","required":true,"description":"Why this matters"},{"name":"questions","type":"text","default_value":"","required":true,"description":"Questions to answer"},{"name":"product_line","type":"string","default_value":"PlexifyBID","required":true,"description":"Product this serves"},{"name":"preferred_sources","type":"string","default_value":"Brookings, ICSC, IDA, IRS.gov, Census.gov","required":false,"description":"Preferred sources"}]',
  '1.0.0'
),
(
  'Session Handoff — Context Protocol',
  'session-handoff-protocol',
  'handoff',
  E'# Context Handoff - {{session_date}}\n\n## Session Summary\n**Sprint:** {{sprint_name}}\n**Branch:** {{branch_name}}\n**Type:** {{session_type}}\n**Duration:** {{started_at}} to {{ended_at}}\n\n## What Was Accomplished\n{{context_out}}\n\n## Decisions Made\n{{decisions_formatted}}\n\n## Files Changed\n{{files_formatted}}\n\n## Blockers\n{{blockers_formatted}}\n\n## Next Session Should Start With\n```\nContext reload:\n- Branch: {{branch_name}}\n- Status: {{current_status}}\n- FIRST TASK: {{first_task}}\n- THEN: {{remaining_tasks}}\n```',
  '[{"name":"session_date","type":"date","default_value":"","required":true,"description":"Session date"},{"name":"sprint_name","type":"string","default_value":"","required":true,"description":"Current sprint"},{"name":"branch_name","type":"string","default_value":"","required":true,"description":"Active branch"},{"name":"session_type","type":"string","default_value":"development","required":true,"description":"Session type"},{"name":"started_at","type":"string","default_value":"","required":true,"description":"Start time"},{"name":"ended_at","type":"string","default_value":"","required":true,"description":"End time"},{"name":"context_out","type":"text","default_value":"","required":true,"description":"Accomplishments"},{"name":"decisions_formatted","type":"text","default_value":"No decisions recorded.","required":false,"description":"Decisions list"},{"name":"files_formatted","type":"text","default_value":"No files changed.","required":false,"description":"Files list"},{"name":"blockers_formatted","type":"text","default_value":"No blockers.","required":false,"description":"Blockers list"},{"name":"current_status","type":"text","default_value":"","required":true,"description":"Current state"},{"name":"first_task","type":"string","default_value":"","required":true,"description":"Next first task"},{"name":"remaining_tasks","type":"text","default_value":"","required":false,"description":"Remaining tasks"}]',
  '1.0.0'
);
```

## 4.3 API Contracts — Express Endpoints

Base path: `/api/agent-management`

### Agents API

| Method | Endpoint | Description | Request Body / Params | Response |
|--------|----------|-------------|----------------------|----------|
| GET | `/agents` | List all agents | QP: `product_line`, `status`, `agent_type` | `{ agents: Agent[], count }` |
| GET | `/agents/:slug` | Get agent by slug | — | `{ agent: Agent }` |
| POST | `/agents` | Create agent | `{ name, description, product_line, agent_type, model, persona, capabilities, status, metadata }` | `{ agent: Agent }` (201) |
| PUT | `/agents/:id` | Update agent | Partial agent fields | `{ agent: Agent }` |
| DELETE | `/agents/:id` | Archive (soft-delete) | — | `{ success: true }` |

### Templates API

| Method | Endpoint | Description | Request Body / Params | Response |
|--------|----------|-------------|----------------------|----------|
| GET | `/templates` | List templates | QP: `category`, `agent_id`, `is_active` | `{ templates: Template[], count }` |
| GET | `/templates/:slug` | Get by slug | — | `{ template: Template }` |
| POST | `/templates` | Create | `{ name, category, agent_id?, template_body, variables }` | `{ template: Template }` (201) |
| PUT | `/templates/:id` | Update | Partial fields | `{ template: Template }` |
| POST | `/templates/:id/render` | Render with values | `{ variables: { key: value } }` | `{ rendered: string }` |

### Sessions API

| Method | Endpoint | Description | Request Body / Params | Response |
|--------|----------|-------------|----------------------|----------|
| GET | `/sessions` | List sessions | QP: `status`, `agent_id`, `session_type`, `from`, `to` | `{ sessions: Session[], count }` |
| GET | `/sessions/:id` | Get detail | — | `{ session: Session, agents: Agent[] }` |
| POST | `/sessions` | Start session | `{ session_type, agent_ids[], roles[]? }` | `{ session: Session, context_in? }` (201) |
| PUT | `/sessions/:id` | Update during | `{ context_out?, metadata? }` | `{ session: Session }` |
| POST | `/sessions/:id/complete` | Complete | `{ decisions_made, files_changed, blockers, next_tasks }` | `{ session, handoff_prompt }` |
| POST | `/sessions/:id/abandon` | Abandon | `{ reason? }` | `{ session: Session }` |

### Utility API

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| GET | `/utils/git-diff` | Get changed files from git | `{ files: string[], error?: string }` |

### Template Render Logic (Server-Side)

```javascript
function renderTemplate(templateBody, variables, variableSchema) {
  let rendered = templateBody;
  for (const varDef of variableSchema) {
    const value = variables[varDef.name] ?? varDef.default_value ?? '';
    const placeholder = new RegExp(`\\{\\{${varDef.name}\\}\\}`, 'g');
    rendered = rendered.replace(placeholder, String(value));
  }
  return rendered;
}
```

## 4.4 UI Component Hierarchy

```
src/features/agent-management/
  AgentManagement.tsx              -- Main page (route: /agents)
  AgentManagement.types.ts         -- TypeScript interfaces
  useAgents.ts                     -- Agents CRUD hook
  useTemplates.ts                  -- Templates CRUD hook
  useSessions.ts                   -- Sessions CRUD hook
  useTemplateRenderer.ts           -- Variable injection logic
  useGitDiff.ts                    -- Git diff detection hook
  components/
    AgentRegistry/
      AgentGrid.tsx                -- Filterable card grid
      AgentCard.tsx                -- Agent summary card
      AgentDetail.tsx              -- Agent view/edit
      AgentForm.tsx                -- Create/edit form
      AgentStatusBadge.tsx         -- Status indicator
    TemplateLibrary/
      TemplateList.tsx             -- Filterable list
      TemplateEditor.tsx           -- Create/edit with live preview
      TemplatePreview.tsx          -- Live rendered preview
      VariableEditor.tsx           -- Variable schema editor
      TemplateRenderModal.tsx      -- "Use Template" modal
    SessionTracker/
      SessionList.tsx              -- Session history
      SessionStartForm.tsx         -- Start: select agents + type
      SessionCompleteForm.tsx      -- Complete: decisions, files, blockers, tasks
      SessionDetail.tsx            -- Full session view
      HandoffDisplay.tsx           -- Rendered handoff + copy button
      SessionStatusBadge.tsx       -- Status indicator
      AbandonSessionModal.tsx      -- Abandon confirmation with reason
      GitDiffButton.tsx            -- "Detect from git" button
    shared/
      CopyToClipboard.tsx          -- Copy button with confirmation
      DownloadMarkdown.tsx         -- Download .md button
      JsonArrayEditor.tsx          -- JSONB array field editor
      FilterBar.tsx                -- Reusable filter controls
  README.md                        -- Feature docs (intelligence CI framing)
```

### React Router Additions

```javascript
<Route path="/agents" element={<AgentManagement />}>
  <Route index element={<AgentGrid />} />
  <Route path=":slug" element={<AgentDetail />} />
  <Route path="templates" element={<TemplateList />} />
  <Route path="templates/:slug" element={<TemplateEditor />} />
  <Route path="sessions" element={<SessionList />} />
  <Route path="sessions/:id" element={<SessionDetail />} />
  <Route path="sessions/new" element={<SessionStartForm />} />
</Route>
```

### Tab Navigation (within /agents page)

1. **Registry** (`/agents`) — Agent card grid
2. **Templates** (`/agents/templates`) — Prompt template library
3. **Sessions** (`/agents/sessions`) — Session tracker + handoff history

## 4.5 Testing Strategy

| Layer | What to Test | Approach | Target |
|-------|-------------|----------|--------|
| Template renderer | Variable injection, missing vars, defaults, special chars | Unit tests (pure function) | 95% |
| Session state machine | active->completed, active->abandoned, validation rules | Unit tests | 90% |
| Data hooks | CRUD operations, error handling, loading states | Unit tests, mocked Supabase | 80% |
| API endpoints | CRUD, validation, error responses, state transitions | Integration tests | 70% |
| UI components | Form validation, copy behavior, required fields | Component tests (RTL) | 60% |

**Priority:** Template renderer > State machine > Hooks > API > UI

---

# STEP 5: CLAUDE CODE IMPLEMENTATION PROMPT

## Branch and PR

- **Branch:** `feature/agent-management` (from `develop`)
- **PR Title:** `feat: Plexify Agent Management — Sprint 2 MVP`
- **Commit format:** `feat(agent-mgmt): description` / `test(agent-mgmt): description`

## Implementation Order — Phased Tasks

### Phase A: Database Foundation

**Task A1: Supabase migration + TypeScript types**
- Create `supabase/migrations/20260202_agent_management.sql` (full SQL from Section 4.2)
- Create `src/features/agent-management/AgentManagement.types.ts`
- Define interfaces: `Agent`, `PromptTemplate`, `AgentSession`, `SessionAgent`
- Define union types: `AgentStatus`, `ProductLine`, `AgentType`, `SessionType`, `SessionStatus`, `TemplateCategory`
- Define: `TemplateVariable` interface for variables JSONB
- PlexiCoS seed data with status = 'draft'
- Verify migration runs cleanly, 5 agents + 5 templates seeded
- Commit: `feat(agent-mgmt): add Supabase schema and TypeScript types`

### Phase B: Data Layer

**Task B1: Supabase data hooks**
- Create `useAgents.ts`, `useTemplates.ts`, `useSessions.ts`
- Match pattern from `useBIDs.ts` / `useOZTracts.ts`
- Each: `{ data, loading, error, refetch }` + CRUD functions
- Commit: `feat(agent-mgmt): add Supabase data fetching hooks`

**Task B2: Template renderer**
- Create `useTemplateRenderer.ts`
- Implement `renderTemplate()` per ADR-002
- Validation: warn on missing required variables, fallback to defaults
- Unit tests (95% coverage target)
- Commit: `feat(agent-mgmt): add template renderer with tests`

**Task B3: Git diff hook**
- Create `useGitDiff.ts`
- Calls `/api/agent-management/utils/git-diff` endpoint
- Returns `{ files, loading, error, detect }`
- Graceful error handling for non-git environments
- Commit: `feat(agent-mgmt): add git diff detection hook`

### Phase C: API Layer

**Task C1: Express routes**
- Create `src/server/routes/agentManagement.ts` (or match existing pattern)
- All endpoints from Section 4.3
- Special: `POST /sessions/:id/complete` auto-renders handoff template
- Special: `POST /sessions` auto-loads previous handoff as context_in
- Special: `POST /sessions/:id/abandon` sets status, ended_at, and optional reason
- Special: `DELETE /agents/:id` checks active sessions, rejects if found, else archives
- Special: `GET /utils/git-diff` runs `git diff --name-only HEAD~1` (or configurable)
- Input validation + error handling + proper status codes
- Commit: `feat(agent-mgmt): add Express API routes`

### Phase D: UI Components

**Task D1: Agent Registry UI**
- `AgentGrid.tsx`, `AgentCard.tsx`, `AgentDetail.tsx`, `AgentForm.tsx`, `AgentStatusBadge.tsx`
- Grid with product_line/status/type filters
- Cards: name, truncated description, badges, status dot, model, updated_at
- Detail: full edit, persona as monospace textarea
- Commit: `feat(agent-mgmt): add agent registry UI`

**Task D2: Template Library UI**
- `TemplateList.tsx`, `TemplateEditor.tsx`, `TemplatePreview.tsx`, `VariableEditor.tsx`, `TemplateRenderModal.tsx`
- Editor: split pane (left=body, right=live preview)
- Variable editor: add/remove/edit definitions
- Render modal: fill values, preview, copy to clipboard
- Commit: `feat(agent-mgmt): add template library UI`

**Task D3: Session Tracker UI**
- `SessionList.tsx`, `SessionStartForm.tsx`, `SessionCompleteForm.tsx`, `SessionDetail.tsx`, `HandoffDisplay.tsx`, `SessionStatusBadge.tsx`
- Start form: multi-select agents, type, shows previous handoff
- Complete form: structured decisions/files/blockers/tasks inputs
- Handoff display: styled container, Copy + Download .md buttons
- Commit: `feat(agent-mgmt): add session tracker UI`

**Task D3a: Git diff detection in SessionCompleteForm**
- Add `GitDiffButton.tsx` component
- "Detect from git" button next to files_changed field
- Populates field on success, shows friendly error on failure
- Commit: `feat(agent-mgmt): add git diff detection to session form`

**Task D3b: Abandon session workflow**
- Add `AbandonSessionModal.tsx` component
- "Abandon" button on SessionDetail for active sessions
- Confirmation modal with optional reason textarea
- Commit: `feat(agent-mgmt): add abandon session workflow`

**Task D4: Shared components**
- `CopyToClipboard.tsx` (copy + "Copied!" confirmation 2s)
- `DownloadMarkdown.tsx` (download handoff as .md file)
- `JsonArrayEditor.tsx` (add/remove/edit JSONB array items)
- `FilterBar.tsx` (reusable dropdowns + search)
- Commit: `feat(agent-mgmt): add shared UI components`

### Phase E: Integration

**Task E1:** Add `/agents` route tree to `App.tsx`
**Task E2:** Add "Agent Management" to sidebar navigation
**Task E3:** Wire up `AgentManagement.tsx` with tab navigation + outlet
- Commits: `feat(agent-mgmt): integrate routes, sidebar nav, main page`

### Phase F: Polish

**Task F1:** Session lifecycle integration tests (90% coverage on state transitions)
**Task F2:** Loading states, error states, empty states across all views
- Commits: `test(agent-mgmt): session lifecycle tests` + `feat(agent-mgmt): loading/error/empty states`

## First Claude Code Command

```
Branch: feature/agent-management (from develop)

Read the attached spec file: PlexifyAgentManagement_FeatureSpec_v1.1_FINAL.md

Start with Task A1: Create Supabase migration and TypeScript types.

Files to create:
1. supabase/migrations/20260202_agent_management.sql (from Section 4.2)
2. src/features/agent-management/AgentManagement.types.ts

Key points:
- PlexiCoS replaces MoltBot as the orchestrator agent (status = 'draft')
- 5 seed agents total: Ask Plexi, PlexiCoS, NotebookBD RAG, Place Graph Analyst, Handoff Protocol Agent
- 5 seed templates: session-init, task-assignment, code-review, research, handoff
- agent_sessions table includes abandon_reason column

Commit: feat(agent-mgmt): add Supabase schema and TypeScript types

After verifying migration runs cleanly, proceed to Task B1 (data hooks).
```

---

# APPENDIX A: Competitive Context

Preserved from Perplexity research for positioning. Does NOT drive architecture.

| Tool | What Plexify Takes | What Plexify Skips |
|------|-------------------|-------------------|
| **LangChain** | Agent abstraction patterns | Framework complexity, heavy coding requirement |
| **Haystack** | RAG pipeline patterns (already in NotebookBD) | Limited to search/retrieval |
| **AutoGen** | Multi-agent conversation concept | Research-focused, no session management |
| **ServiceNow CMDB** | CI relationship model, change tracking concept | Enterprise bloat, ITIL overhead |
| **BMC Helix** | Dependency mapping patterns | Requires ITIL expertise |

**Plexify differentiators:**
1. Solopreneur-first — existing tools assume engineering teams
2. Prompt-as-CI — no CMDB treats prompts as versionable, deployable artifacts
3. Dogfooding loop — this IS the PlexifySOLO prototype
4. Workflow-first — built around actual daily orchestration patterns

---

# APPENDIX B: Top Risks for Sprint 2

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Over-engineering exceeds problem complexity | Medium | High | Tyson Filter: every feature demos in <3 min. If not used daily by Day 3, cut. |
| Supabase down = Agent Management down | Medium | Medium | Same dependency as Place Graph + NotebookBD. Local cache Sprint 3+. |
| Session completion form adds its own overhead | Medium | High | Form must take <2 min. If longer, simplify. |

---

# APPENDIX C: Sprint 3+ Deferred Roadmap

| Feature | Sprint | Dependency |
|---------|--------|-----------|
| **PlexiCoS Cloudflare Workers deployment** | **Sprint 3** | Paid Cloudflare tier, Moltworker setup |
| Agent Discovery & Routing | Sprint 3 | MCP ADR, PlexiCoS integration |
| Prompt A/B Testing | Sprint 3 | Usage data from Sprint 2 |
| MCP Server Integration | Sprint 3 | OpenClaw stability |
| Multi-tenant RLS policies | Sprint 3 | Auth system |
| Agent performance metrics | Sprint 3 | Session data + API instrumentation |
| Mobile-responsive Agent Management UI | Sprint 4 | Desktop MVP validated |
| Git-backed prompt versioning | Sprint 4 | GitHub API |
| Agent recommendation engine | Sprint 4 | Routing data from Sprint 3 |
| PlexifySOLO agent marketplace | Sprint 5+ | Full multi-tenant, onboarding |

### PlexiCoS Sprint 3 Work Breakdown (Preview)

| Task | Est. Days | Dependencies |
|------|-----------|--------------|
| Cloudflare account + Workers tier setup | 0.5 | Credit card |
| Clone + configure Moltworker repo | 1 | Cloudflare account |
| Wrangler CLI secrets configuration | 0.5 | API keys ready |
| Deploy to Cloudflare Workers | 1 | Moltworker configured |
| Zero trust auth configuration | 1 | Deployed worker |
| R2 storage setup | 0.5 | Deployed worker |
| Agent Management API integration | 2 | Sprint 2 complete |
| MCP endpoint scaffolding | 1 | API integration |
| Admin UI / health monitoring | 1 | All above |
| **Total** | **8.5 days** | |

---

**END OF SPECIFICATION v1.1 (Consolidated)**

*PRD Constitution v2.1 compliance:*
*Phase 1 (What & Why): Sections 3.1-3.6*
*Phase 2 (How): Sections 4.1-4.5*
*Phase 3 (Tasks): Step 5, Phases A-F*
*Phase 4 (Document & Handoff): This document IS the handoff.*

*All clarifications resolved. Ready for Claude Code implementation.*
