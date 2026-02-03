import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Plus, Play, Eye, Calendar } from 'lucide-react';
import { useSessions } from '../../useSessions';
import { useAgents } from '../../useAgents';
import type { SessionFilters, SessionStatus, SessionType, AgentSession, Agent } from '../../AgentManagement.types';
import { FilterBar, type FilterConfig } from '../shared';
import { SessionStatusBadge } from './SessionStatusBadge';
import { HandoffDisplay } from './HandoffDisplay';

export interface SessionListProps {
  /** Callback when session row is clicked */
  onSessionClick: (id: string) => void;
  /** Callback when "Start Session" is clicked */
  onStartSession: () => void;
}

const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  development: 'Development',
  strategy: 'Strategy',
  research: 'Research',
  review: 'Review',
  debug: 'Debug',
  custom: 'Custom',
};

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return 'In progress';
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  const diffMins = Math.floor((end - start) / 60000);
  if (diffMins < 60) return `${diffMins}m`;
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-5 bg-gray-200 rounded w-32" />
              <div className="h-5 bg-gray-200 rounded w-20" />
            </div>
            <div className="h-5 bg-gray-200 rounded w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SessionList({ onSessionClick, onStartSession }: SessionListProps) {
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [handoffModal, setHandoffModal] = useState<{ session: AgentSession; agents: Agent[] } | null>(null);
  const [sessionAgentsMap, setSessionAgentsMap] = useState<Record<string, Agent[]>>({});

  const { data: agents } = useAgents();

  // Build filter config with agent options
  const filterConfig: FilterConfig[] = useMemo(() => [
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'completed', label: 'Completed' },
        { value: 'abandoned', label: 'Abandoned' },
      ],
    },
    {
      key: 'session_type',
      label: 'Type',
      type: 'select',
      options: [
        { value: 'development', label: 'Development' },
        { value: 'strategy', label: 'Strategy' },
        { value: 'research', label: 'Research' },
        { value: 'review', label: 'Review' },
        { value: 'debug', label: 'Debug' },
        { value: 'custom', label: 'Custom' },
      ],
    },
    {
      key: 'agent_id',
      label: 'Agent',
      type: 'select',
      options: agents.map((a) => ({ value: a.id, label: a.name })),
    },
    {
      key: 'from',
      label: 'From',
      type: 'date',
    },
    {
      key: 'to',
      label: 'To',
      type: 'date',
    },
  ], [agents]);

  // Convert filter values to typed filters
  const filters: SessionFilters = useMemo(() => ({
    status: filterValues.status as SessionStatus | undefined,
    session_type: filterValues.session_type as SessionType | undefined,
    agent_id: filterValues.agent_id || undefined,
    from: filterValues.from || undefined,
    to: filterValues.to || undefined,
  }), [filterValues]);

  const { data: sessions, loading, error, getSessionAgents } = useSessions(filters);

  // Fetch agents for each session
  useEffect(() => {
    async function fetchAgentsForSessions() {
      const map: Record<string, Agent[]> = {};
      for (const session of sessions) {
        if (!sessionAgentsMap[session.id]) {
          const sessionAgents = await getSessionAgents(session.id);
          map[session.id] = sessionAgents;
        }
      }
      if (Object.keys(map).length > 0) {
        setSessionAgentsMap((prev) => ({ ...prev, ...map }));
      }
    }
    if (sessions.length > 0) {
      fetchAgentsForSessions();
    }
  }, [sessions, getSessionAgents, sessionAgentsMap]);

  const handleFilterChange = useCallback((key: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilterValues({});
  }, []);

  const handleViewHandoff = useCallback(async (session: AgentSession) => {
    const sessionAgents = sessionAgentsMap[session.id] || await getSessionAgents(session.id);
    setHandoffModal({ session, agents: sessionAgents });
  }, [getSessionAgents, sessionAgentsMap]);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <p className="font-medium">Error loading sessions</p>
        <p className="text-sm mt-1">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Session Tracker</h2>
          <p className="text-sm text-gray-600 mt-0.5">
            {loading ? 'Loading...' : `${sessions.length} sessions`}
          </p>
        </div>
        <button
          type="button"
          onClick={onStartSession}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-900 text-white
                     font-medium rounded-lg hover:bg-primary-800 transition-colors"
        >
          <Plus size={18} />
          <span>Start Session</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <FilterBar
          filters={filterConfig}
          values={filterValues}
          onChange={handleFilterChange}
          onClear={handleClearFilters}
        />
      </div>

      {/* Session List */}
      {loading ? (
        <LoadingSkeleton />
      ) : sessions.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No sessions found</h3>
          <p className="text-sm text-gray-600 mb-4">
            {Object.values(filterValues).some(Boolean)
              ? 'Try adjusting your filters.'
              : 'Start your first session to track your work.'}
          </p>
          <button
            type="button"
            onClick={onStartSession}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-900 text-white
                       font-medium rounded-lg hover:bg-primary-800 transition-colors"
          >
            <Play size={18} />
            <span>Start Session</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => {
            const sessionAgents = sessionAgentsMap[session.id] || [];
            return (
              <div
                key={session.id}
                className="bg-white rounded-lg border border-gray-200 hover:border-gray-300
                           transition-colors"
              >
                <button
                  type="button"
                  onClick={() => onSessionClick(session.id)}
                  className="w-full text-left p-4 focus:outline-none focus:ring-2 focus:ring-primary-200 rounded-lg"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Agent names */}
                      <div className="font-medium text-gray-900 truncate">
                        {sessionAgents.length > 0
                          ? sessionAgents.map((a) => a.name).join(', ')
                          : 'Loading...'}
                      </div>
                      {/* Type badge */}
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600 whitespace-nowrap">
                        {SESSION_TYPE_LABELS[session.session_type]}
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Duration */}
                      <span className="text-sm text-gray-500 whitespace-nowrap hidden sm:block">
                        {formatDuration(session.started_at, session.ended_at)}
                      </span>
                      {/* Timestamps */}
                      <div className="text-sm text-gray-500 whitespace-nowrap">
                        {formatDateTime(session.started_at)}
                      </div>
                      {/* Status */}
                      <SessionStatusBadge status={session.status} size="sm" />
                    </div>
                  </div>
                </button>

                {/* Quick action for completed sessions */}
                {session.status === 'completed' && session.handoff_prompt && (
                  <div className="px-4 pb-3 pt-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewHandoff(session);
                      }}
                      className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium
                                 text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                    >
                      <Eye size={12} />
                      <span>View Handoff</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Handoff Modal */}
      {handoffModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Session Handoff</h3>
                <p className="text-sm text-gray-600">
                  {handoffModal.agents.map((a) => a.name).join(', ')} •{' '}
                  {formatDateTime(handoffModal.session.started_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHandoffModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-auto">
              <HandoffDisplay
                handoffPrompt={handoffModal.session.handoff_prompt || ''}
                sessionDate={handoffModal.session.started_at.split('T')[0]}
                collapseThreshold={2000}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SessionList;
