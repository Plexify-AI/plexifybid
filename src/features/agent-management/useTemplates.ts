import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type {
  PromptTemplate,
  TemplateFilters,
  CreateTemplateRequest,
  UpdateTemplateRequest,
} from './AgentManagement.types';
import { renderTemplateSimple } from './useTemplateRenderer';

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

interface UseTemplatesState {
  data: PromptTemplate[];
  loading: boolean;
  error: Error | null;
}

interface UseTemplatesReturn extends UseTemplatesState {
  refetch: () => Promise<void>;
  getBySlug: (slug: string) => Promise<PromptTemplate | null>;
  create: (request: CreateTemplateRequest) => Promise<PromptTemplate | null>;
  update: (id: string, request: UpdateTemplateRequest) => Promise<PromptTemplate | null>;
  render: (id: string, variables: Record<string, string | number | boolean>) => Promise<string | null>;
  incrementUsage: (id: string) => Promise<void>;
}

export function useTemplates(filters?: TemplateFilters): UseTemplatesReturn {
  const [state, setState] = useState<UseTemplatesState>({
    data: [],
    loading: true,
    error: null,
  });

  const fetchTemplates = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));

    let query = supabase.from('prompt_templates').select('*');

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }
    if (filters?.agent_id) {
      query = query.eq('agent_id', filters.agent_id);
    }
    if (filters?.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }

    query = query.order('updated_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      setState({ data: [], loading: false, error: new Error(error.message) });
      return;
    }

    setState({ data: data ?? [], loading: false, error: null });
  }, [filters?.category, filters?.agent_id, filters?.is_active]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const getBySlug = useCallback(async (slug: string): Promise<PromptTemplate | null> => {
    const { data, error } = await supabase
      .from('prompt_templates')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      console.error('[useTemplates] getBySlug error:', error.message);
      return null;
    }

    return data;
  }, []);

  const create = useCallback(async (request: CreateTemplateRequest): Promise<PromptTemplate | null> => {
    const slug = toSlug(request.name);

    const { data, error } = await supabase
      .from('prompt_templates')
      .insert({
        name: request.name,
        slug,
        category: request.category,
        agent_id: request.agent_id ?? null,
        template_body: request.template_body,
        variables: request.variables ?? [],
        metadata: request.metadata ?? {},
        version: '1.0.0',
        usage_count: 0,
        is_active: true,
        user_id: 'ken',
      })
      .select()
      .single();

    if (error) {
      console.error('[useTemplates] create error:', error.message);
      return null;
    }

    await fetchTemplates();
    return data;
  }, [fetchTemplates]);

  const update = useCallback(async (id: string, request: UpdateTemplateRequest): Promise<PromptTemplate | null> => {
    // Get current template to increment version
    const { data: current } = await supabase
      .from('prompt_templates')
      .select('version')
      .eq('id', id)
      .single();

    const newVersion = current ? incrementPatchVersion(current.version) : '1.0.1';

    const { data, error } = await supabase
      .from('prompt_templates')
      .update({
        ...request,
        version: newVersion,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[useTemplates] update error:', error.message);
      return null;
    }

    await fetchTemplates();
    return data;
  }, [fetchTemplates]);

  const render = useCallback(async (
    id: string,
    variables: Record<string, string | number | boolean>
  ): Promise<string | null> => {
    // Fetch the template
    const { data: template, error } = await supabase
      .from('prompt_templates')
      .select('template_body, variables')
      .eq('id', id)
      .single();

    if (error || !template) {
      console.error('[useTemplates] render error:', error?.message ?? 'Template not found');
      return null;
    }

    // Use extracted pure function for rendering
    return renderTemplateSimple(template.template_body, variables, template.variables);
  }, []);

  const incrementUsage = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase.rpc('increment_template_usage', { template_id: id });

    // Fallback if RPC doesn't exist - do a read + update
    if (error) {
      const { data: current } = await supabase
        .from('prompt_templates')
        .select('usage_count')
        .eq('id', id)
        .single();

      if (current) {
        await supabase
          .from('prompt_templates')
          .update({ usage_count: (current.usage_count ?? 0) + 1 })
          .eq('id', id);
      }
    }
  }, []);

  return {
    ...state,
    refetch: fetchTemplates,
    getBySlug,
    create,
    update,
    render,
    incrementUsage,
  };
}

export default useTemplates;
