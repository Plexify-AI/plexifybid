import type { IncomingMessage, ServerResponse } from 'http';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createClient } from '@supabase/supabase-js';
import { renderTemplate } from '../features/agent-management/useTemplateRenderer';
import type {
  Agent,
  PromptTemplate,
  AgentSession,
  TemplateVariable,
  SessionDecision,
  SessionBlocker,
} from '../features/agent-management/AgentManagement.types';

const execAsync = promisify(exec);

// Initialize Supabase client for server-side use
function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL || '';
  const key = process.env.VITE_SUPABASE_ANON_KEY || '';
  if (!url || !key) {
    console.warn('[agentManagementApi] Missing Supabase credentials');
  }
  return createClient(url, key);
}

// =============================================================================
// Utility Functions
// =============================================================================

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf-8');
  return raw ? (JSON.parse(raw) as T) : ({} as T);
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function parseQueryParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) return params;
  const queryString = url.slice(queryIndex + 1);
  for (const pair of queryString.split('&')) {
    const [key, value] = pair.split('=');
    if (key) params[decodeURIComponent(key)] = decodeURIComponent(value || '');
  }
  return params;
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function incrementPatchVersion(version: string): string {
  const parts = version.split('.');
  if (parts.length !== 3) return '1.0.1';
  const patch = parseInt(parts[2], 10) || 0;
  return `${parts[0]}.${parts[1]}.${patch + 1}`;
}

// =============================================================================
// AGENTS API
// =============================================================================

async function handleAgentsApi(
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
  method: string
): Promise<boolean> {
  const supabase = getSupabase();

  // GET /agents - List all agents
  if (path === '/agents' && method === 'GET') {
    const params = parseQueryParams(req.url || '');

    let query = supabase.from('agents').select('*');

    if (params.product_line) {
      query = query.eq('product_line', params.product_line);
    }
    if (params.status) {
      query = query.eq('status', params.status);
    }
    if (params.agent_type) {
      query = query.eq('agent_type', params.agent_type);
    }

    query = query.order('updated_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      return sendJson(res, 500, { error: error.message }), true;
    }

    return sendJson(res, 200, { agents: data, count: data?.length ?? 0 }), true;
  }

  // GET /agents/:slug - Get agent by slug
  const slugMatch = path.match(/^\/agents\/([a-z0-9-]+)$/);
  if (slugMatch && method === 'GET') {
    const slug = slugMatch[1];

    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return sendJson(res, 404, { error: 'Agent not found' }), true;
      }
      return sendJson(res, 500, { error: error.message }), true;
    }

    return sendJson(res, 200, { agent: data }), true;
  }

  // POST /agents - Create agent
  if (path === '/agents' && method === 'POST') {
    const body = await readJson<Partial<Agent>>(req);

    if (!body.name || !body.product_line) {
      return sendJson(res, 400, { error: 'name and product_line are required' }), true;
    }

    const slug = toSlug(body.name);

    const { data, error } = await supabase
      .from('agents')
      .insert({
        name: body.name,
        slug,
        description: body.description ?? null,
        product_line: body.product_line,
        agent_type: body.agent_type ?? 'specialist',
        model: body.model ?? null,
        persona: body.persona ?? null,
        capabilities: body.capabilities ?? [],
        status: body.status ?? 'draft',
        metadata: body.metadata ?? {},
        version: '1.0.0',
        user_id: 'ken',
      })
      .select()
      .single();

    if (error) {
      return sendJson(res, 500, { error: error.message }), true;
    }

    return sendJson(res, 201, { agent: data }), true;
  }

  // PUT /agents/:id - Update agent
  const updateMatch = path.match(/^\/agents\/([a-f0-9-]{36})$/);
  if (updateMatch && method === 'PUT') {
    const id = updateMatch[1];
    const body = await readJson<Partial<Agent>>(req);

    // Get current version to increment
    const { data: current } = await supabase
      .from('agents')
      .select('version')
      .eq('id', id)
      .single();

    const newVersion = current ? incrementPatchVersion(current.version) : '1.0.1';

    const { data, error } = await supabase
      .from('agents')
      .update({
        ...body,
        version: newVersion,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return sendJson(res, 500, { error: error.message }), true;
    }

    return sendJson(res, 200, { agent: data }), true;
  }

  // DELETE /agents/:id - Archive agent (reject if active sessions)
  const deleteMatch = path.match(/^\/agents\/([a-f0-9-]{36})$/);
  if (deleteMatch && method === 'DELETE') {
    const id = deleteMatch[1];

    // Check for active sessions
    const { data: sessionAgents } = await supabase
      .from('session_agents')
      .select('session_id')
      .eq('agent_id', id);

    if (sessionAgents && sessionAgents.length > 0) {
      const sessionIds = sessionAgents.map((sa) => sa.session_id);
      const { data: activeSessions } = await supabase
        .from('agent_sessions')
        .select('id')
        .in('id', sessionIds)
        .eq('status', 'active');

      if (activeSessions && activeSessions.length > 0) {
        return sendJson(res, 400, {
          error: 'Cannot archive agent with active sessions',
          active_session_count: activeSessions.length,
        }), true;
      }
    }

    // Soft delete by setting status to archived
    const { error } = await supabase
      .from('agents')
      .update({ status: 'archived' })
      .eq('id', id);

    if (error) {
      return sendJson(res, 500, { error: error.message }), true;
    }

    return sendJson(res, 200, { success: true }), true;
  }

  return false;
}

// =============================================================================
// TEMPLATES API
// =============================================================================

async function handleTemplatesApi(
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
  method: string
): Promise<boolean> {
  const supabase = getSupabase();

  // GET /templates - List all templates
  if (path === '/templates' && method === 'GET') {
    const params = parseQueryParams(req.url || '');

    let query = supabase.from('prompt_templates').select('*');

    if (params.category) {
      query = query.eq('category', params.category);
    }
    if (params.agent_id) {
      query = query.eq('agent_id', params.agent_id);
    }
    if (params.is_active !== undefined) {
      query = query.eq('is_active', params.is_active === 'true');
    }

    query = query.order('updated_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      return sendJson(res, 500, { error: error.message }), true;
    }

    return sendJson(res, 200, { templates: data, count: data?.length ?? 0 }), true;
  }

  // GET /templates/:slug - Get template by slug
  const slugMatch = path.match(/^\/templates\/([a-z0-9-]+)$/);
  if (slugMatch && method === 'GET') {
    const slug = slugMatch[1];

    const { data, error } = await supabase
      .from('prompt_templates')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return sendJson(res, 404, { error: 'Template not found' }), true;
      }
      return sendJson(res, 500, { error: error.message }), true;
    }

    return sendJson(res, 200, { template: data }), true;
  }

  // POST /templates - Create template
  if (path === '/templates' && method === 'POST') {
    const body = await readJson<Partial<PromptTemplate>>(req);

    if (!body.name || !body.category || !body.template_body) {
      return sendJson(res, 400, { error: 'name, category, and template_body are required' }), true;
    }

    const slug = toSlug(body.name);

    const { data, error } = await supabase
      .from('prompt_templates')
      .insert({
        name: body.name,
        slug,
        category: body.category,
        agent_id: body.agent_id ?? null,
        template_body: body.template_body,
        variables: body.variables ?? [],
        metadata: body.metadata ?? {},
        version: '1.0.0',
        usage_count: 0,
        is_active: true,
        user_id: 'ken',
      })
      .select()
      .single();

    if (error) {
      return sendJson(res, 500, { error: error.message }), true;
    }

    return sendJson(res, 201, { template: data }), true;
  }

  // PUT /templates/:id - Update template
  const updateMatch = path.match(/^\/templates\/([a-f0-9-]{36})$/);
  if (updateMatch && method === 'PUT') {
    const id = updateMatch[1];
    const body = await readJson<Partial<PromptTemplate>>(req);

    // Get current version to increment
    const { data: current } = await supabase
      .from('prompt_templates')
      .select('version')
      .eq('id', id)
      .single();

    const newVersion = current ? incrementPatchVersion(current.version) : '1.0.1';

    const { data, error } = await supabase
      .from('prompt_templates')
      .update({
        ...body,
        version: newVersion,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return sendJson(res, 500, { error: error.message }), true;
    }

    return sendJson(res, 200, { template: data }), true;
  }

  // POST /templates/:id/render - Render template with variables
  const renderMatch = path.match(/^\/templates\/([a-f0-9-]{36})\/render$/);
  if (renderMatch && method === 'POST') {
    const id = renderMatch[1];
    const body = await readJson<{ variables: Record<string, string | number | boolean> }>(req);

    // Fetch template
    const { data: template, error } = await supabase
      .from('prompt_templates')
      .select('template_body, variables')
      .eq('id', id)
      .single();

    if (error || !template) {
      return sendJson(res, 404, { error: 'Template not found' }), true;
    }

    // Render using pure function
    const result = renderTemplate(
      template.template_body,
      body.variables || {},
      template.variables as TemplateVariable[]
    );

    // Increment usage count
    await supabase.rpc('increment_template_usage', { template_id: id }).catch(() => {
      // Fallback if RPC doesn't exist
      supabase
        .from('prompt_templates')
        .update({ usage_count: 1 }) // Will be handled by trigger or manual increment
        .eq('id', id);
    });

    return sendJson(res, 200, { rendered: result.rendered, warnings: result.warnings }), true;
  }

  return false;
}

// =============================================================================
// SESSIONS API
// =============================================================================

async function handleSessionsApi(
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
  method: string
): Promise<boolean> {
  const supabase = getSupabase();

  // GET /sessions - List all sessions
  if (path === '/sessions' && method === 'GET') {
    const params = parseQueryParams(req.url || '');

    let query = supabase.from('agent_sessions').select('*');

    if (params.status) {
      query = query.eq('status', params.status);
    }
    if (params.session_type) {
      query = query.eq('session_type', params.session_type);
    }
    if (params.from) {
      query = query.gte('started_at', params.from);
    }
    if (params.to) {
      query = query.lte('started_at', params.to);
    }

    query = query.order('started_at', { ascending: false });

    let { data: sessions, error } = await query;

    if (error) {
      return sendJson(res, 500, { error: error.message }), true;
    }

    // Filter by agent_id if specified
    if (params.agent_id && sessions && sessions.length > 0) {
      const { data: sessionAgents } = await supabase
        .from('session_agents')
        .select('session_id')
        .eq('agent_id', params.agent_id);

      const validSessionIds = new Set((sessionAgents ?? []).map((sa) => sa.session_id));
      sessions = sessions.filter((s) => validSessionIds.has(s.id));
    }

    return sendJson(res, 200, { sessions, count: sessions?.length ?? 0 }), true;
  }

  // GET /sessions/:id - Get session detail with agents
  const detailMatch = path.match(/^\/sessions\/([a-f0-9-]{36})$/);
  if (detailMatch && method === 'GET') {
    const id = detailMatch[1];

    const { data: session, error } = await supabase
      .from('agent_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return sendJson(res, 404, { error: 'Session not found' }), true;
      }
      return sendJson(res, 500, { error: error.message }), true;
    }

    // Get linked agents
    const { data: sessionAgents } = await supabase
      .from('session_agents')
      .select('agent_id')
      .eq('session_id', id);

    let agents: Agent[] = [];
    if (sessionAgents && sessionAgents.length > 0) {
      const agentIds = sessionAgents.map((sa) => sa.agent_id);
      const { data: agentData } = await supabase
        .from('agents')
        .select('*')
        .in('id', agentIds);
      agents = agentData ?? [];
    }

    return sendJson(res, 200, { session, agents }), true;
  }

  // POST /sessions - Start new session
  if (path === '/sessions' && method === 'POST') {
    const body = await readJson<{
      session_type: string;
      agent_ids: string[];
      roles?: string[];
    }>(req);

    if (!body.session_type || !body.agent_ids || body.agent_ids.length === 0) {
      return sendJson(res, 400, { error: 'session_type and agent_ids are required' }), true;
    }

    // Check for existing active session
    const { data: existingActive } = await supabase
      .from('agent_sessions')
      .select('id')
      .eq('status', 'active')
      .eq('user_id', 'ken')
      .limit(1);

    if (existingActive && existingActive.length > 0) {
      return sendJson(res, 400, {
        error: 'Cannot start new session - active session already exists',
        active_session_id: existingActive[0].id,
      }), true;
    }

    // Find most recent completed session's handoff for context_in
    let context_in: string | null = null;
    const { data: sessionAgentHistory } = await supabase
      .from('session_agents')
      .select('session_id')
      .in('agent_id', body.agent_ids);

    if (sessionAgentHistory && sessionAgentHistory.length > 0) {
      const sessionIds = sessionAgentHistory.map((sa) => sa.session_id);
      const { data: completedSessions } = await supabase
        .from('agent_sessions')
        .select('handoff_prompt')
        .in('id', sessionIds)
        .eq('status', 'completed')
        .order('ended_at', { ascending: false })
        .limit(1);

      if (completedSessions && completedSessions.length > 0) {
        context_in = completedSessions[0].handoff_prompt;
      }
    }

    // Create session
    const { data: session, error } = await supabase
      .from('agent_sessions')
      .insert({
        session_type: body.session_type,
        status: 'active',
        context_in,
        user_id: 'ken',
        decisions_made: [],
        files_changed: [],
        blockers: [],
        next_tasks: [],
      })
      .select()
      .single();

    if (error) {
      return sendJson(res, 500, { error: error.message }), true;
    }

    // Link agents to session
    const sessionAgentInserts = body.agent_ids.map((agentId, index) => ({
      session_id: session.id,
      agent_id: agentId,
      role: body.roles?.[index] ?? 'primary',
    }));

    const { error: linkError } = await supabase
      .from('session_agents')
      .insert(sessionAgentInserts);

    if (linkError) {
      // Rollback session
      await supabase.from('agent_sessions').delete().eq('id', session.id);
      return sendJson(res, 500, { error: linkError.message }), true;
    }

    return sendJson(res, 201, { session, context_in }), true;
  }

  // PUT /sessions/:id - Update session during
  const updateMatch = path.match(/^\/sessions\/([a-f0-9-]{36})$/);
  if (updateMatch && method === 'PUT') {
    const id = updateMatch[1];
    const body = await readJson<Partial<AgentSession>>(req);

    const { data, error } = await supabase
      .from('agent_sessions')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return sendJson(res, 500, { error: error.message }), true;
    }

    return sendJson(res, 200, { session: data }), true;
  }

  // POST /sessions/:id/complete - Complete session
  const completeMatch = path.match(/^\/sessions\/([a-f0-9-]{36})\/complete$/);
  if (completeMatch && method === 'POST') {
    const id = completeMatch[1];
    const body = await readJson<{
      decisions_made: SessionDecision[];
      files_changed: string[];
      blockers: SessionBlocker[];
      next_tasks: string[];
      context_out?: string;
    }>(req);

    // Validate: at least one next task required
    if (!body.next_tasks || body.next_tasks.length === 0) {
      return sendJson(res, 400, { error: 'At least one next_task is required' }), true;
    }

    // Get current session
    const { data: currentSession, error: sessionError } = await supabase
      .from('agent_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (sessionError || !currentSession) {
      return sendJson(res, 404, { error: 'Session not found' }), true;
    }

    if (currentSession.status !== 'active') {
      return sendJson(res, 400, { error: 'Session is not active' }), true;
    }

    // Get handoff template
    const { data: handoffTemplate } = await supabase
      .from('prompt_templates')
      .select('template_body, variables')
      .eq('slug', 'session-handoff-protocol')
      .single();

    // Generate handoff prompt
    let handoff_prompt = '';
    if (handoffTemplate) {
      const decisionsFormatted = body.decisions_made.length > 0
        ? body.decisions_made.map((d) =>
            `- **${d.decision}**\n  - Rationale: ${d.rationale}\n  - Reversible: ${d.reversible ? 'Yes' : 'No'}`
          ).join('\n')
        : 'No decisions recorded.';

      const filesFormatted = body.files_changed.length > 0
        ? body.files_changed.map((f) => `- ${f}`).join('\n')
        : 'No files changed.';

      const blockersFormatted = body.blockers.length > 0
        ? body.blockers.map((b) =>
            `- ${b.description} (${b.resolved ? 'Resolved: ' + b.resolution : 'Unresolved'})`
          ).join('\n')
        : 'No blockers.';

      const result = renderTemplate(
        handoffTemplate.template_body,
        {
          session_date: new Date().toISOString().split('T')[0],
          sprint_name: 'Sprint 2',
          branch_name: 'feature/agent-management',
          session_type: currentSession.session_type,
          started_at: currentSession.started_at,
          ended_at: new Date().toISOString(),
          context_out: body.context_out ?? '',
          decisions_formatted: decisionsFormatted,
          files_formatted: filesFormatted,
          blockers_formatted: blockersFormatted,
          current_status: body.context_out ?? 'Session completed.',
          first_task: body.next_tasks[0] ?? '',
          remaining_tasks: body.next_tasks.slice(1).join(', ') || 'None',
        },
        handoffTemplate.variables as TemplateVariable[]
      );
      handoff_prompt = result.rendered;
    } else {
      handoff_prompt = `# Session Handoff\n\n## Next Tasks\n${body.next_tasks.map((t) => `- ${t}`).join('\n')}`;
    }

    // Update session
    const { data: session, error } = await supabase
      .from('agent_sessions')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
        context_out: body.context_out ?? null,
        handoff_prompt,
        decisions_made: body.decisions_made,
        files_changed: body.files_changed,
        blockers: body.blockers,
        next_tasks: body.next_tasks,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return sendJson(res, 500, { error: error.message }), true;
    }

    return sendJson(res, 200, { session, handoff_prompt }), true;
  }

  // POST /sessions/:id/abandon - Abandon session
  const abandonMatch = path.match(/^\/sessions\/([a-f0-9-]{36})\/abandon$/);
  if (abandonMatch && method === 'POST') {
    const id = abandonMatch[1];
    const body = await readJson<{ reason?: string }>(req);

    const { data, error } = await supabase
      .from('agent_sessions')
      .update({
        status: 'abandoned',
        ended_at: new Date().toISOString(),
        abandon_reason: body.reason ?? null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return sendJson(res, 500, { error: error.message }), true;
    }

    return sendJson(res, 200, { session: data }), true;
  }

  return false;
}

// =============================================================================
// UTILITY API
// =============================================================================

async function handleUtilsApi(
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
  method: string
): Promise<boolean> {
  // GET /utils/git-diff - Get changed files from git
  if (path === '/utils/git-diff' && method === 'GET') {
    try {
      const { stdout } = await execAsync('git diff --name-only HEAD~1', {
        cwd: process.cwd(),
        timeout: 5000,
      });

      const files = stdout
        .split('\n')
        .map((f) => f.trim())
        .filter((f) => f.length > 0);

      return sendJson(res, 200, { files }), true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      // Check for common git errors
      if (errorMessage.includes('not a git repository')) {
        return sendJson(res, 400, {
          error: 'Not a git repository',
          files: [],
        }), true;
      }

      if (errorMessage.includes('unknown revision')) {
        // No commits yet or HEAD~1 doesn't exist
        return sendJson(res, 200, {
          files: [],
          warning: 'No previous commit to compare against',
        }), true;
      }

      return sendJson(res, 500, {
        error: errorMessage,
        files: [],
      }), true;
    }
  }

  return false;
}

// =============================================================================
// Main Middleware
// =============================================================================

export function agentManagementMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url || '';
    const basePrefix = '/api/agent-management';

    if (!url.startsWith(basePrefix)) {
      return next();
    }

    const path = url.slice(basePrefix.length).split('?')[0] || '/';
    const method = req.method || 'GET';

    try {
      // Route to appropriate handler
      if (path.startsWith('/agents')) {
        const handled = await handleAgentsApi(req, res, path, method);
        if (handled) return;
      }

      if (path.startsWith('/templates')) {
        const handled = await handleTemplatesApi(req, res, path, method);
        if (handled) return;
      }

      if (path.startsWith('/sessions')) {
        const handled = await handleSessionsApi(req, res, path, method);
        if (handled) return;
      }

      if (path.startsWith('/utils')) {
        const handled = await handleUtilsApi(req, res, path, method);
        if (handled) return;
      }

      // No matching route
      return sendJson(res, 404, { error: 'Not found' });
    } catch (err) {
      console.error('[agentManagementApi] Error:', err);
      return sendJson(res, 500, {
        error: err instanceof Error ? err.message : 'Internal server error',
      });
    }
  };
}
