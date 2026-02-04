import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type {
  Agent,
  AgentSession,
  SessionFilters,
  StartSessionRequest,
  CompleteSessionRequest,
  SessionAgentRole,
} from './AgentManagement.types';

interface UseSessionsState {
  data: AgentSession[];
  loading: boolean;
  error: Error | null;
}

interface SessionWithAgents extends AgentSession {
  agents?: Agent[];
}

interface UseSessionsReturn extends UseSessionsState {
  refetch: () => Promise<void>;
  getById: (id: string) => Promise<SessionWithAgents | null>;
  getActiveSession: () => Promise<AgentSession | null>;
  start: (request: StartSessionRequest) => Promise<{ session: AgentSession; context_in?: string } | null>;
  update: (id: string, updates: Partial<AgentSession>) => Promise<AgentSession | null>;
  complete: (id: string, request: CompleteSessionRequest) => Promise<{ session: AgentSession; handoff_prompt: string } | null>;
  abandon: (id: string, reason?: string) => Promise<AgentSession | null>;
  getSessionAgents: (sessionId: string) => Promise<Agent[]>;
}

export function useSessions(filters?: SessionFilters): UseSessionsReturn {
  const [state, setState] = useState<UseSessionsState>({
    data: [],
    loading: true,
    error: null,
  });

  const fetchSessions = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));

    let query = supabase.from('agent_sessions').select('*');

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.session_type) {
      query = query.eq('session_type', filters.session_type);
    }
    if (filters?.from) {
      query = query.gte('started_at', filters.from);
    }
    if (filters?.to) {
      query = query.lte('started_at', filters.to);
    }

    query = query.order('started_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      setState({ data: [], loading: false, error: new Error(error.message) });
      return;
    }

    // If filtering by agent_id, we need to join through session_agents
    let sessions = data ?? [];
    if (filters?.agent_id && sessions.length > 0) {
      const { data: sessionAgents } = await supabase
        .from('session_agents')
        .select('session_id')
        .eq('agent_id', filters.agent_id);

      const validSessionIds = new Set((sessionAgents ?? []).map((sa) => sa.session_id));
      sessions = sessions.filter((s) => validSessionIds.has(s.id));
    }

    setState({ data: sessions, loading: false, error: null });
  }, [filters?.status, filters?.session_type, filters?.from, filters?.to, filters?.agent_id]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const getSessionAgents = useCallback(async (sessionId: string): Promise<Agent[]> => {
    const { data: sessionAgents } = await supabase
      .from('session_agents')
      .select('agent_id')
      .eq('session_id', sessionId);

    if (!sessionAgents || sessionAgents.length === 0) return [];

    const agentIds = sessionAgents.map((sa) => sa.agent_id);
    const { data: agents } = await supabase
      .from('agents')
      .select('*')
      .in('id', agentIds);

    return agents ?? [];
  }, []);

  const getById = useCallback(async (id: string): Promise<SessionWithAgents | null> => {
    const { data, error } = await supabase
      .from('agent_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[useSessions] getById error:', error.message);
      return null;
    }

    const agents = await getSessionAgents(id);
    return { ...data, agents };
  }, [getSessionAgents]);

  const getActiveSession = useCallback(async (): Promise<AgentSession | null> => {
    const { data, error } = await supabase
      .from('agent_sessions')
      .select('*')
      .eq('status', 'active')
      .eq('user_id', 'ken')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // No active session is not an error
      if (error.code === 'PGRST116') return null;
      console.error('[useSessions] getActiveSession error:', error.message);
      return null;
    }

    return data;
  }, []);

  const start = useCallback(async (request: StartSessionRequest): Promise<{ session: AgentSession; context_in?: string } | null> => {
    // Check for existing active session
    const existingActive = await getActiveSession();
    if (existingActive) {
      console.error('[useSessions] Cannot start session - active session already exists');
      return null;
    }

    // Find the most recent completed session for these agents to get context_in
    let context_in: string | undefined;
    if (request.agent_ids.length > 0) {
      // Get session_ids for these agents
      const { data: sessionAgents } = await supabase
        .from('session_agents')
        .select('session_id')
        .in('agent_id', request.agent_ids);

      if (sessionAgents && sessionAgents.length > 0) {
        const sessionIds = sessionAgents.map((sa) => sa.session_id);
        const { data: completedSessions } = await supabase
          .from('agent_sessions')
          .select('handoff_prompt')
          .in('id', sessionIds)
          .eq('status', 'completed')
          .order('ended_at', { ascending: false })
          .limit(1);

        if (completedSessions && completedSessions.length > 0) {
          context_in = completedSessions[0].handoff_prompt ?? undefined;
        }
      }
    }

    // Create the session
    const { data: session, error } = await supabase
      .from('agent_sessions')
      .insert({
        session_type: request.session_type,
        status: 'active',
        context_in: context_in ?? null,
        user_id: 'ken',
        decisions_made: [],
        files_changed: [],
        blockers: [],
        next_tasks: [],
      })
      .select()
      .single();

    if (error) {
      console.error('[useSessions] start error:', error.message);
      return null;
    }

    // Link agents to session
    const sessionAgentInserts = request.agent_ids.map((agentId, index) => ({
      session_id: session.id,
      agent_id: agentId,
      role: (request.roles?.[index] ?? 'primary') as SessionAgentRole,
    }));

    const { error: linkError } = await supabase
      .from('session_agents')
      .insert(sessionAgentInserts);

    if (linkError) {
      console.error('[useSessions] link agents error:', linkError.message);
      // Rollback session creation
      await supabase.from('agent_sessions').delete().eq('id', session.id);
      return null;
    }

    await fetchSessions();
    return { session, context_in };
  }, [getActiveSession, fetchSessions]);

  const update = useCallback(async (id: string, updates: Partial<AgentSession>): Promise<AgentSession | null> => {
    const { data, error } = await supabase
      .from('agent_sessions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[useSessions] update error:', error.message);
      return null;
    }

    await fetchSessions();
    return data;
  }, [fetchSessions]);

  const complete = useCallback(async (
    id: string,
    request: CompleteSessionRequest
  ): Promise<{ session: AgentSession; handoff_prompt: string } | null> => {
    // Validate: at least one next task required
    if (!request.next_tasks || request.next_tasks.length === 0) {
      console.error('[useSessions] complete error: at least one next task required');
      return null;
    }

    // Get the handoff template
    const { data: handoffTemplate } = await supabase
      .from('prompt_templates')
      .select('template_body, variables')
      .eq('slug', 'session-handoff-protocol')
      .single();

    // Get current session for timestamps
    const { data: currentSession } = await supabase
      .from('agent_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (!currentSession) {
      console.error('[useSessions] complete error: session not found');
      return null;
    }

    // Generate handoff prompt
    let handoff_prompt = '';
    if (handoffTemplate) {
      // Format decisions
      const decisionsFormatted = request.decisions_made.length > 0
        ? request.decisions_made.map((d) =>
            `- **${d.decision}**\n  - Rationale: ${d.rationale}\n  - Reversible: ${d.reversible ? 'Yes' : 'No'}`
          ).join('\n')
        : 'No decisions recorded.';

      // Format files
      const filesFormatted = request.files_changed.length > 0
        ? request.files_changed.map((f) => `- ${f}`).join('\n')
        : 'No files changed.';

      // Format blockers
      const blockersFormatted = request.blockers.length > 0
        ? request.blockers.map((b) =>
            `- ${b.description} (${b.resolved ? 'Resolved: ' + b.resolution : 'Unresolved'})`
          ).join('\n')
        : 'No blockers.';

      // Simple template rendering
      handoff_prompt = handoffTemplate.template_body
        .replace(/\{\{session_date\}\}/g, new Date().toISOString().split('T')[0])
        .replace(/\{\{sprint_name\}\}/g, 'Sprint 2')
        .replace(/\{\{branch_name\}\}/g, 'feature/agent-management')
        .replace(/\{\{session_type\}\}/g, currentSession.session_type)
        .replace(/\{\{started_at\}\}/g, currentSession.started_at)
        .replace(/\{\{ended_at\}\}/g, new Date().toISOString())
        .replace(/\{\{context_out\}\}/g, request.context_out ?? '')
        .replace(/\{\{decisions_formatted\}\}/g, decisionsFormatted)
        .replace(/\{\{files_formatted\}\}/g, filesFormatted)
        .replace(/\{\{blockers_formatted\}\}/g, blockersFormatted)
        .replace(/\{\{current_status\}\}/g, request.context_out ?? 'Session completed.')
        .replace(/\{\{first_task\}\}/g, request.next_tasks[0] ?? '')
        .replace(/\{\{remaining_tasks\}\}/g, request.next_tasks.slice(1).join(', ') || 'None');
    } else {
      // Fallback simple handoff
      handoff_prompt = `# Session Handoff\n\n## Next Tasks\n${request.next_tasks.map((t) => `- ${t}`).join('\n')}`;
    }

    // Update session
    const { data: session, error } = await supabase
      .from('agent_sessions')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
        context_out: request.context_out ?? null,
        handoff_prompt,
        decisions_made: request.decisions_made,
        files_changed: request.files_changed,
        blockers: request.blockers,
        next_tasks: request.next_tasks,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[useSessions] complete error:', error.message);
      return null;
    }

    await fetchSessions();
    return { session, handoff_prompt };
  }, [fetchSessions]);

  const abandon = useCallback(async (id: string, reason?: string): Promise<AgentSession | null> => {
    const { data, error } = await supabase
      .from('agent_sessions')
      .update({
        status: 'abandoned',
        ended_at: new Date().toISOString(),
        abandon_reason: reason ?? null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[useSessions] abandon error:', error.message);
      return null;
    }

    await fetchSessions();
    return data;
  }, [fetchSessions]);

  return {
    ...state,
    refetch: fetchSessions,
    getById,
    getActiveSession,
    start,
    update,
    complete,
    abandon,
    getSessionAgents,
  };
}

export default useSessions;
