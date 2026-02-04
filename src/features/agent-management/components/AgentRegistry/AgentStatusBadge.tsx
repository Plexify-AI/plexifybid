import React from 'react';
import type { AgentStatus } from '../../AgentManagement.types';

export interface AgentStatusBadgeProps {
  status: AgentStatus;
  /** Show text label alongside dot (default: true) */
  showLabel?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<AgentStatus, { color: string; bg: string; label: string }> = {
  active: {
    color: 'bg-green-500',
    bg: 'bg-green-50 text-green-700 border-green-200',
    label: 'Active',
  },
  draft: {
    color: 'bg-yellow-500',
    bg: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    label: 'Draft',
  },
  archived: {
    color: 'bg-gray-400',
    bg: 'bg-gray-50 text-gray-600 border-gray-200',
    label: 'Archived',
  },
  deprecated: {
    color: 'bg-red-500',
    bg: 'bg-red-50 text-red-700 border-red-200',
    label: 'Deprecated',
  },
};

export function AgentStatusBadge({
  status,
  showLabel = true,
  size = 'md',
}: AgentStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs gap-1',
    md: 'px-2 py-1 text-xs gap-1.5',
  };

  const dotSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
  };

  return (
    <span
      className={`
        inline-flex items-center rounded-full border font-medium
        ${config.bg}
        ${sizeClasses[size]}
      `}
    >
      <span className={`${dotSizes[size]} rounded-full ${config.color}`} />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}

export default AgentStatusBadge;
