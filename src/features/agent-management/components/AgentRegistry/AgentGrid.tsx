import React, { useState, useCallback, useMemo } from 'react';
import { Plus, Bot } from 'lucide-react';
import { useAgents } from '../../useAgents';
import type { AgentFilters, ProductLine, AgentStatus, AgentType } from '../../AgentManagement.types';
import { FilterBar, type FilterConfig } from '../shared';
import { AgentCard } from './AgentCard';

export interface AgentGridProps {
  /** Callback when an agent card is clicked */
  onAgentClick: (slug: string) => void;
  /** Callback when "New Agent" is clicked */
  onNewAgent: () => void;
}

const FILTER_CONFIG: FilterConfig[] = [
  {
    key: 'product_line',
    label: 'Product',
    type: 'select',
    options: [
      { value: 'AEC', label: 'AEC' },
      { value: 'BID', label: 'BID' },
      { value: 'BIZ', label: 'BIZ' },
      { value: 'SOLO', label: 'SOLO' },
      { value: 'PLATFORM', label: 'PLATFORM' },
    ],
  },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'draft', label: 'Draft' },
      { value: 'archived', label: 'Archived' },
      { value: 'deprecated', label: 'Deprecated' },
    ],
  },
  {
    key: 'agent_type',
    label: 'Type',
    type: 'select',
    options: [
      { value: 'conversational', label: 'Conversational' },
      { value: 'task_executor', label: 'Task Executor' },
      { value: 'orchestrator', label: 'Orchestrator' },
      { value: 'specialist', label: 'Specialist' },
    ],
  },
];

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-gray-200 rounded-md" />
            <div className="h-5 bg-gray-200 rounded w-32" />
          </div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2" />
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-4" />
          <div className="flex gap-2">
            <div className="h-5 bg-gray-200 rounded w-12" />
            <div className="h-5 bg-gray-200 rounded w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AgentGrid({ onAgentClick, onNewAgent }: AgentGridProps) {
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  // Convert filter values to typed filters
  const filters: AgentFilters = useMemo(() => ({
    product_line: filterValues.product_line as ProductLine | undefined,
    status: filterValues.status as AgentStatus | undefined,
    agent_type: filterValues.agent_type as AgentType | undefined,
  }), [filterValues]);

  const { data: agents, loading, error } = useAgents(filters);

  const handleFilterChange = useCallback((key: string, value: string) => {
    setFilterValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilterValues({});
  }, []);

  const activeCount = useMemo(
    () => agents.filter((a) => a.status === 'active').length,
    [agents]
  );

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <p className="font-medium">Error loading agents</p>
        <p className="text-sm mt-1">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Agent Registry</h2>
          <p className="text-sm text-gray-600 mt-0.5">
            {loading ? 'Loading...' : `${agents.length} agents (${activeCount} active)`}
          </p>
        </div>
        <button
          type="button"
          onClick={onNewAgent}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-900 text-white
                     font-medium rounded-lg hover:bg-primary-800 transition-colors"
        >
          <Plus size={18} />
          <span>New Agent</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <FilterBar
          filters={FILTER_CONFIG}
          values={filterValues}
          onChange={handleFilterChange}
          onClear={handleClearFilters}
        />
      </div>

      {/* Grid */}
      {loading ? (
        <LoadingSkeleton />
      ) : agents.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <Bot size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No agents found</h3>
          <p className="text-sm text-gray-600 mb-4">
            {Object.values(filterValues).some(Boolean)
              ? 'Try adjusting your filters or create a new agent.'
              : 'Get started by creating your first agent.'}
          </p>
          <button
            type="button"
            onClick={onNewAgent}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-900 text-white
                       font-medium rounded-lg hover:bg-primary-800 transition-colors"
          >
            <Plus size={18} />
            <span>Create Agent</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onClick={() => onAgentClick(agent.slug)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default AgentGrid;
