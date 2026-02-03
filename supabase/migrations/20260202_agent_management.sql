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
