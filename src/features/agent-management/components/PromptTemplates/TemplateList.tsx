import React, { useState, useCallback, useMemo } from 'react';
import { Plus, FileText, Clock, Play, Link as LinkIcon } from 'lucide-react';
import type { PromptTemplate, TemplateCategory, TemplateFilters } from '../../AgentManagement.types';
import { useTemplates } from '../../useTemplates';
import { useAgents } from '../../useAgents';
import { FilterBar, type FilterConfig } from '../shared';
import { TemplateRenderModal } from './TemplateRenderModal';

export interface TemplateListProps {
  /** Callback when "New Template" is clicked */
  onNew?: () => void;
  /** Callback when a template is selected for editing */
  onEdit?: (template: PromptTemplate) => void;
}

const CATEGORY_OPTIONS: Array<{ value: TemplateCategory; label: string }> = [
  { value: 'handoff', label: 'Handoff' },
  { value: 'session_init', label: 'Session Init' },
  { value: 'task_assignment', label: 'Task Assignment' },
  { value: 'code_review', label: 'Code Review' },
  { value: 'research', label: 'Research' },
  { value: 'reporting', label: 'Reporting' },
  { value: 'system', label: 'System' },
  { value: 'custom', label: 'Custom' },
];

const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  handoff: 'bg-purple-100 text-purple-700',
  session_init: 'bg-blue-100 text-blue-700',
  task_assignment: 'bg-orange-100 text-orange-700',
  code_review: 'bg-green-100 text-green-700',
  research: 'bg-teal-100 text-teal-700',
  reporting: 'bg-indigo-100 text-indigo-700',
  system: 'bg-gray-100 text-gray-700',
  custom: 'bg-yellow-100 text-yellow-700',
};

const FILTER_CONFIGS: FilterConfig[] = [
  {
    key: 'category',
    label: 'Category',
    type: 'select',
    options: CATEGORY_OPTIONS.map((c) => ({ value: c.value, label: c.label })),
    placeholder: 'All Categories',
  },
  {
    key: 'is_active',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'true', label: 'Active' },
      { value: 'false', label: 'Inactive' },
    ],
    placeholder: 'All',
  },
];

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function TemplateList({ onNew, onEdit }: TemplateListProps) {
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [renderModalTemplate, setRenderModalTemplate] = useState<PromptTemplate | null>(null);

  // Build filters from filter values
  const filters: TemplateFilters = useMemo(() => {
    const f: TemplateFilters = {};
    if (filterValues.category) {
      f.category = filterValues.category as TemplateCategory;
    }
    if (filterValues.is_active) {
      f.is_active = filterValues.is_active === 'true';
    }
    return f;
  }, [filterValues]);

  const { data: templates, loading, error, incrementUsage } = useTemplates(filters);
  const { data: agents } = useAgents();

  // Create agent lookup map
  const agentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const agent of agents) {
      map.set(agent.id, agent.name);
    }
    return map;
  }, [agents]);

  const handleFilterChange = useCallback((key: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilterValues({});
  }, []);

  const handleUseTemplate = useCallback((template: PromptTemplate) => {
    setRenderModalTemplate(template);
  }, []);

  const handleCloseRenderModal = useCallback(() => {
    setRenderModalTemplate(null);
  }, []);

  const handleCopyFromModal = useCallback(async () => {
    if (renderModalTemplate) {
      await incrementUsage(renderModalTemplate.id);
    }
  }, [renderModalTemplate, incrementUsage]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-9 w-64 bg-gray-200 rounded animate-pulse" />
          <div className="h-9 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="h-5 w-3/4 bg-gray-200 rounded animate-pulse mb-3" />
              <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse mb-4" />
              <div className="flex gap-2">
                <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
                <div className="h-6 w-20 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <FileText size={32} className="text-red-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Error loading templates</h3>
        <p className="text-sm text-gray-600 text-center max-w-md">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with filters and new button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <FilterBar
          filters={FILTER_CONFIGS}
          values={filterValues}
          onChange={handleFilterChange}
          onClear={handleClearFilters}
        />
        {onNew && (
          <button
            type="button"
            onClick={onNew}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white
                       bg-primary-600 rounded-md hover:bg-primary-700 transition-colors whitespace-nowrap"
          >
            <Plus size={16} />
            New Template
          </button>
        )}
      </div>

      {/* Empty state */}
      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 border border-dashed border-gray-300 rounded-lg">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <FileText size={32} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No templates found</h3>
          <p className="text-sm text-gray-600 text-center max-w-md mb-4">
            {Object.keys(filterValues).length > 0
              ? 'Try adjusting your filters or create a new template.'
              : 'Create your first prompt template to get started.'}
          </p>
          {onNew && (
            <button
              type="button"
              onClick={onNew}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white
                         bg-primary-600 rounded-md hover:bg-primary-700 transition-colors"
            >
              <Plus size={16} />
              New Template
            </button>
          )}
        </div>
      ) : (
        /* Template grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              agentName={template.agent_id ? agentMap.get(template.agent_id) : undefined}
              onEdit={onEdit}
              onUse={handleUseTemplate}
            />
          ))}
        </div>
      )}

      {/* Render modal */}
      {renderModalTemplate && (
        <TemplateRenderModal
          template={renderModalTemplate}
          isOpen={true}
          onClose={handleCloseRenderModal}
          onCopy={handleCopyFromModal}
        />
      )}
    </div>
  );
}

// Template card component
interface TemplateCardProps {
  template: PromptTemplate;
  agentName?: string;
  onEdit?: (template: PromptTemplate) => void;
  onUse: (template: PromptTemplate) => void;
}

function TemplateCard({ template, agentName, onEdit, onUse }: TemplateCardProps) {
  return (
    <div
      className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md
                 hover:border-gray-300 transition-all duration-200 p-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <button
          type="button"
          onClick={() => onEdit?.(template)}
          className="flex items-center gap-2 min-w-0 text-left hover:text-primary-600 transition-colors"
        >
          <div className="p-1.5 bg-gray-100 rounded-md flex-shrink-0">
            <FileText size={18} className="text-gray-600" />
          </div>
          <h3 className="font-semibold text-gray-900 truncate">{template.name}</h3>
        </button>
        {!template.is_active && (
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-500">
            Inactive
          </span>
        )}
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span
          className={`px-2 py-0.5 text-xs font-medium rounded ${
            CATEGORY_COLORS[template.category] || CATEGORY_COLORS.custom
          }`}
        >
          {template.category}
        </span>
        {template.variables.length > 0 && (
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600">
            {template.variables.length} var{template.variables.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Agent link */}
      {agentName && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
          <LinkIcon size={12} />
          <span>Bound to {agentName}</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Play size={12} />
            {template.usage_count} uses
          </span>
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {formatRelativeTime(template.updated_at)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onUse(template)}
          className="px-2.5 py-1 text-xs font-medium text-primary-700 bg-primary-50
                     rounded hover:bg-primary-100 transition-colors"
        >
          Use
        </button>
      </div>
    </div>
  );
}

export default TemplateList;
