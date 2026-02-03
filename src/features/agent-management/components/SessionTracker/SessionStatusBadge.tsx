import React from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import type { SessionStatus } from '../../AgentManagement.types';

export interface SessionStatusBadgeProps {
  status: SessionStatus;
  /** Show text label (default: true) */
  showLabel?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<
  SessionStatus,
  { bg: string; icon: React.ReactNode; label: string; animate?: boolean }
> = {
  active: {
    bg: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: <Loader2 size={12} className="animate-spin" />,
    label: 'Active',
    animate: true,
  },
  completed: {
    bg: 'bg-green-50 text-green-700 border-green-200',
    icon: <Check size={12} />,
    label: 'Completed',
  },
  abandoned: {
    bg: 'bg-gray-50 text-gray-600 border-gray-200',
    icon: <X size={12} />,
    label: 'Abandoned',
  },
};

export function SessionStatusBadge({
  status,
  showLabel = true,
  size = 'md',
}: SessionStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs gap-1',
    md: 'px-2 py-1 text-xs gap-1.5',
  };

  return (
    <span
      className={`
        inline-flex items-center rounded-full border font-medium
        ${config.bg}
        ${sizeClasses[size]}
      `}
    >
      {config.icon}
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}

export default SessionStatusBadge;
