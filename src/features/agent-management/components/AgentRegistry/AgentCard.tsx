import React from 'react';
import { Bot, Clock } from 'lucide-react';
import type { Agent } from '../../AgentManagement.types';
import { AgentStatusBadge } from './AgentStatusBadge';

export interface AgentCardProps {
  agent: Agent;
  onClick: () => void;
}

const PRODUCT_LINE_COLORS: Record<string, string> = {
  AEC: 'bg-blue-100 text-blue-700',
  BID: 'bg-purple-100 text-purple-700',
  BIZ: 'bg-orange-100 text-orange-700',
  SOLO: 'bg-teal-100 text-teal-700',
  PLATFORM: 'bg-gray-100 text-gray-700',
};

function truncateText(text: string | null, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

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

export function AgentCard({ agent, onClick }: AgentCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white rounded-lg border border-gray-200 shadow-sm
                 hover:shadow-md hover:border-gray-300 transition-all duration-200
                 p-4 focus:outline-none focus:ring-2 focus:ring-primary-200"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 bg-gray-100 rounded-md">
            <Bot size={18} className="text-gray-600" />
          </div>
          <h3 className="font-semibold text-gray-900 truncate">{agent.name}</h3>
        </div>
        <AgentStatusBadge status={agent.status} size="sm" />
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 mb-3 line-clamp-2 min-h-[2.5rem]">
        {truncateText(agent.description, 100) || 'No description'}
      </p>

      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span
          className={`px-2 py-0.5 text-xs font-medium rounded ${
            PRODUCT_LINE_COLORS[agent.product_line] || PRODUCT_LINE_COLORS.PLATFORM
          }`}
        >
          {agent.product_line}
        </span>
        <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600">
          {agent.agent_type}
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
        <span className="truncate">{agent.model || 'No model'}</span>
        <span className="flex items-center gap-1 whitespace-nowrap">
          <Clock size={12} />
          {formatRelativeTime(agent.updated_at)}
        </span>
      </div>
    </button>
  );
}

export default AgentCard;
