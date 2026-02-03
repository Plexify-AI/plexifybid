import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type {
  Agent,
  AgentFilters,
  CreateAgentRequest,
  UpdateAgentRequest,
} from './AgentManagement.types';

// Generate slug from name (kebab-case)
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Increment patch version (X.Y.Z -> X.Y.Z+1)
function incrementPatchVersion(version: string): string {
  const parts = version.split('.');
  if (parts.length !== 3) return '1.0.1';
  const patch = parseInt(parts[2], 10) || 0;
  return `${parts[0]}.${parts[1]}.${patch + 1}`;
}

interface UseAgentsState {
  data: Agent[];
  loading: boolean;
  error: Error | null;
}

interface UseAgentsReturn extends UseAgentsState {
  refetch: () => Promise<void>;
  getBySlug: (slug: string) => Promise<Agent | null>;
  create: (request: CreateAgentRequest) => Promise<Agent | null>;
  update: (id: string, request: UpdateAgentRequest) => Promise<Agent | null>;
  archive: (id: string) => Promise<boolean>;
}

export function useAgents(filters?: AgentFilters): UseAgentsReturn {
  const [state, setState] = useState<UseAgentsState>({
    data: [],
    loading: true,
    error: null,
  });

  const fetchAgents = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));

    let query = supabase.from('agents').select('*');

    if (filters?.product_line) {
      query = query.eq('product_line', filters.product_line);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.agent_type) {
      query = query.eq('agent_type', filters.agent_type);
    }

    query = query.order('updated_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      setState({ data: [], loading: false, error: new Error(error.message) });
      return;
    }

    setState({ data: data ?? [], loading: false, error: null });
  }, [filters?.product_line, filters?.status, filters?.agent_type]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const getBySlug = useCallback(async (slug: string): Promise<Agent | null> => {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      console.error('[useAgents] getBySlug error:', error.message);
      return null;
    }

    return data;
  }, []);

  const create = useCallback(async (request: CreateAgentRequest): Promise<Agent | null> => {
    const slug = toSlug(request.name);

    const { data, error } = await supabase
      .from('agents')
      .insert({
        name: request.name,
        slug,
        description: request.description ?? null,
        product_line: request.product_line,
        agent_type: request.agent_type ?? 'specialist',
        model: request.model ?? null,
        persona: request.persona ?? null,
        capabilities: request.capabilities ?? [],
        status: request.status ?? 'draft',
        metadata: request.metadata ?? {},
        version: '1.0.0',
        user_id: 'ken',
      })
      .select()
      .single();

    if (error) {
      console.error('[useAgents] create error:', error.message);
      return null;
    }

    // Refetch to update list
    await fetchAgents();
    return data;
  }, [fetchAgents]);

  const update = useCallback(async (id: string, request: UpdateAgentRequest): Promise<Agent | null> => {
    // Get current agent to increment version
    const { data: current } = await supabase
      .from('agents')
      .select('version')
      .eq('id', id)
      .single();

    const newVersion = current ? incrementPatchVersion(current.version) : '1.0.1';

    const { data, error } = await supabase
      .from('agents')
      .update({
        ...request,
        version: newVersion,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[useAgents] update error:', error.message);
      return null;
    }

    await fetchAgents();
    return data;
  }, [fetchAgents]);

  const archive = useCallback(async (id: string): Promise<boolean> => {
    // Check for active sessions before archiving
    const { data: activeSessions } = await supabase
      .from('session_agents')
      .select('session_id')
      .eq('agent_id', id);

    if (activeSessions && activeSessions.length > 0) {
      // Check if any linked session is active
      const sessionIds = activeSessions.map((sa) => sa.session_id);
      const { data: sessions } = await supabase
        .from('agent_sessions')
        .select('id')
        .in('id', sessionIds)
        .eq('status', 'active');

      if (sessions && sessions.length > 0) {
        console.error('[useAgents] Cannot archive agent with active sessions');
        return false;
      }
    }

    // Soft delete by setting status to archived
    const { error } = await supabase
      .from('agents')
      .update({ status: 'archived' })
      .eq('id', id);

    if (error) {
      console.error('[useAgents] archive error:', error.message);
      return false;
    }

    await fetchAgents();
    return true;
  }, [fetchAgents]);

  return {
    ...state,
    refetch: fetchAgents,
    getBySlug,
    create,
    update,
    archive,
  };
}

export default useAgents;
