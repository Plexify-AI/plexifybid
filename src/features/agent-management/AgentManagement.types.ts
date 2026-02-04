// =============================================================================
// Plexify Agent Management — TypeScript Types
// Sprint 2 MVP
// =============================================================================

// -----------------------------------------------------------------------------
// Union Types (enums as string unions for flexibility)
// -----------------------------------------------------------------------------

export type ProductLine = 'AEC' | 'BID' | 'BIZ' | 'SOLO' | 'PLATFORM';

export type AgentType = 'conversational' | 'task_executor' | 'orchestrator' | 'specialist';

export type AgentStatus = 'active' | 'draft' | 'archived' | 'deprecated';

export type SessionType = 'development' | 'strategy' | 'research' | 'review' | 'debug' | 'custom';

export type SessionStatus = 'active' | 'completed' | 'abandoned';

export type TemplateCategory =
  | 'handoff'
  | 'session_init'
  | 'task_assignment'
  | 'code_review'
  | 'research'
  | 'reporting'
  | 'system'
  | 'custom';

export type SessionAgentRole = 'primary' | 'supporting';

export type TemplateVariableType = 'string' | 'text' | 'number' | 'boolean' | 'date' | 'json';

// -----------------------------------------------------------------------------
// Template Variable Definition
// -----------------------------------------------------------------------------

export interface TemplateVariable {
  name: string;
  type: TemplateVariableType;
  default_value: string;
  required: boolean;
  description: string;
}

// -----------------------------------------------------------------------------
// Session Structured Data Types
// -----------------------------------------------------------------------------

export interface SessionDecision {
  decision: string;
  rationale: string;
  reversible: boolean;
}

export interface SessionBlocker {
  description: string;
  resolved: boolean;
  resolution?: string;
}

// -----------------------------------------------------------------------------
// Core Entity Interfaces
// -----------------------------------------------------------------------------

export interface Agent {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  product_line: ProductLine;
  agent_type: AgentType;
  model: string | null;
  persona: string | null;
  capabilities: string[];
  status: AgentStatus;
  version: string;
  metadata: Record<string, unknown>;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  slug: string;
  category: TemplateCategory;
  agent_id: string | null;
  template_body: string;
  variables: TemplateVariable[];
  version: string;
  usage_count: number;
  is_active: boolean;
  metadata: Record<string, unknown>;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface AgentSession {
  id: string;
  session_type: SessionType;
  status: SessionStatus;
  started_at: string;
  ended_at: string | null;
  context_in: string | null;
  context_out: string | null;
  handoff_prompt: string | null;
  decisions_made: SessionDecision[];
  files_changed: string[];
  blockers: SessionBlocker[];
  next_tasks: string[];
  abandon_reason: string | null;
  metadata: Record<string, unknown>;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface SessionAgent {
  agent_id: string;
  session_id: string;
  role: SessionAgentRole;
}

// -----------------------------------------------------------------------------
// API Request/Response Types
// -----------------------------------------------------------------------------

export interface CreateAgentRequest {
  name: string;
  description?: string;
  product_line: ProductLine;
  agent_type?: AgentType;
  model?: string;
  persona?: string;
  capabilities?: string[];
  status?: AgentStatus;
  metadata?: Record<string, unknown>;
}

export interface UpdateAgentRequest {
  name?: string;
  description?: string;
  product_line?: ProductLine;
  agent_type?: AgentType;
  model?: string;
  persona?: string;
  capabilities?: string[];
  status?: AgentStatus;
  metadata?: Record<string, unknown>;
}

export interface CreateTemplateRequest {
  name: string;
  category: TemplateCategory;
  agent_id?: string;
  template_body: string;
  variables?: TemplateVariable[];
  metadata?: Record<string, unknown>;
}

export interface UpdateTemplateRequest {
  name?: string;
  category?: TemplateCategory;
  agent_id?: string | null;
  template_body?: string;
  variables?: TemplateVariable[];
  is_active?: boolean;
  metadata?: Record<string, unknown>;
}

export interface RenderTemplateRequest {
  variables: Record<string, string | number | boolean>;
}

export interface StartSessionRequest {
  session_type: SessionType;
  agent_ids: string[];
  roles?: SessionAgentRole[];
}

export interface CompleteSessionRequest {
  decisions_made: SessionDecision[];
  files_changed: string[];
  blockers: SessionBlocker[];
  next_tasks: string[];
  context_out?: string;
}

export interface AbandonSessionRequest {
  reason?: string;
}

// -----------------------------------------------------------------------------
// API Response Types
// -----------------------------------------------------------------------------

export interface AgentsResponse {
  agents: Agent[];
  count: number;
}

export interface AgentResponse {
  agent: Agent;
}

export interface TemplatesResponse {
  templates: PromptTemplate[];
  count: number;
}

export interface TemplateResponse {
  template: PromptTemplate;
}

export interface RenderTemplateResponse {
  rendered: string;
}

export interface SessionsResponse {
  sessions: AgentSession[];
  count: number;
}

export interface SessionResponse {
  session: AgentSession;
  agents?: Agent[];
}

export interface SessionCompleteResponse {
  session: AgentSession;
  handoff_prompt: string;
}

export interface GitDiffResponse {
  files: string[];
  error?: string;
}

// -----------------------------------------------------------------------------
// Filter Types for List Queries
// -----------------------------------------------------------------------------

export interface AgentFilters {
  product_line?: ProductLine;
  status?: AgentStatus;
  agent_type?: AgentType;
}

export interface TemplateFilters {
  category?: TemplateCategory;
  agent_id?: string;
  is_active?: boolean;
}

export interface SessionFilters {
  status?: SessionStatus;
  agent_id?: string;
  session_type?: SessionType;
  from?: string; // ISO date string
  to?: string;   // ISO date string
}

// -----------------------------------------------------------------------------
// Supabase Database Types (for typed client)
// -----------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      agents: {
        Row: Agent;
        Insert: Omit<Agent, 'id' | 'slug' | 'created_at' | 'updated_at'> & {
          id?: string;
          slug?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Agent, 'id' | 'created_at'>>;
      };
      prompt_templates: {
        Row: PromptTemplate;
        Insert: Omit<PromptTemplate, 'id' | 'slug' | 'usage_count' | 'created_at' | 'updated_at'> & {
          id?: string;
          slug?: string;
          usage_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<PromptTemplate, 'id' | 'created_at'>>;
      };
      agent_sessions: {
        Row: AgentSession;
        Insert: Omit<AgentSession, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<AgentSession, 'id' | 'created_at'>>;
      };
      session_agents: {
        Row: SessionAgent;
        Insert: SessionAgent;
        Update: Partial<SessionAgent>;
      };
    };
  };
}
