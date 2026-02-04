import React, { useState, useCallback, useMemo } from 'react';
import { ArrowLeft, Play, ChevronDown, ChevronUp } from 'lucide-react';
import { useAgents } from '../../useAgents';
import { useSessions } from '../../useSessions';
import type { SessionType, SessionAgentRole } from '../../AgentManagement.types';

export interface SessionStartFormProps {
  /** Callback to navigate back */
  onBack: () => void;
  /** Callback when session is started successfully */
  onSessionStarted: (sessionId: string) => void;
}

const SESSION_TYPES: { value: SessionType; label: string; description: string }[] = [
  { value: 'development', label: 'Development', description: 'Writing code, implementing features' },
  { value: 'strategy', label: 'Strategy', description: 'Planning, architecture, decision-making' },
  { value: 'research', label: 'Research', description: 'Investigation, documentation, learning' },
  { value: 'review', label: 'Review', description: 'Code review, PR analysis, feedback' },
  { value: 'debug', label: 'Debug', description: 'Bug hunting, troubleshooting, fixes' },
  { value: 'custom', label: 'Custom', description: 'Other workflow types' },
];

interface SelectedAgent {
  id: string;
  name: string;
  role: SessionAgentRole;
}

export function SessionStartForm({ onBack, onSessionStarted }: SessionStartFormProps) {
  const { data: agents, loading: agentsLoading } = useAgents({ status: 'active' });
  const { start, getActiveSession } = useSessions();

  const [selectedAgents, setSelectedAgents] = useState<SelectedAgent[]>([]);
  const [sessionType, setSessionType] = useState<SessionType>('development');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previousContext, setPreviousContext] = useState<string | null>(null);
  const [showPreviousContext, setShowPreviousContext] = useState(false);

  // Check for active session
  const [hasActiveSession, setHasActiveSession] = useState(false);
  React.useEffect(() => {
    getActiveSession().then((session) => setHasActiveSession(!!session));
  }, [getActiveSession]);

  const handleAgentToggle = useCallback((agent: { id: string; name: string }) => {
    setSelectedAgents((prev) => {
      const existing = prev.find((a) => a.id === agent.id);
      if (existing) {
        return prev.filter((a) => a.id !== agent.id);
      }
      return [...prev, { id: agent.id, name: agent.name, role: 'primary' as SessionAgentRole }];
    });
    setError(null);
  }, []);

  const handleRoleChange = useCallback((agentId: string, role: SessionAgentRole) => {
    setSelectedAgents((prev) =>
      prev.map((a) => (a.id === agentId ? { ...a, role } : a))
    );
  }, []);

  const handleStartSession = useCallback(async () => {
    if (selectedAgents.length === 0) {
      setError('Please select at least one agent');
      return;
    }

    setStarting(true);
    setError(null);

    const result = await start({
      session_type: sessionType,
      agent_ids: selectedAgents.map((a) => a.id),
      roles: selectedAgents.map((a) => a.role),
    });

    if (result) {
      // Store previous context if available
      if (result.context_in) {
        setPreviousContext(result.context_in);
      }
      onSessionStarted(result.session.id);
    } else {
      setError('Failed to start session. You may have an active session already.');
    }

    setStarting(false);
  }, [selectedAgents, sessionType, start, onSessionStarted]);

  const isValid = useMemo(() => selectedAgents.length > 0, [selectedAgents]);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          <span>Sessions</span>
        </button>
        <span className="text-gray-400">/</span>
        <span className="text-gray-900 font-medium">Start New Session</span>
      </div>

      {/* Warning for active session */}
      {hasActiveSession && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
          <p className="font-medium">Active Session Detected</p>
          <p className="text-sm mt-1">
            You have an active session. Complete or abandon it before starting a new one.
          </p>
        </div>
      )}

      {/* Main form */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Start New Session</h2>
          <p className="text-sm text-gray-600 mt-1">
            Select the agent(s) you'll be working with and the type of session.
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Agent Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Agent(s) <span className="text-red-500">*</span>
            </label>
            {agentsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {agents.map((agent) => {
                  const selected = selectedAgents.find((a) => a.id === agent.id);
                  return (
                    <div
                      key={agent.id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer
                        ${selected
                          ? 'border-primary-300 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                        }`}
                      onClick={() => handleAgentToggle(agent)}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={!!selected}
                          onChange={() => handleAgentToggle(agent)}
                          className="h-4 w-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                        />
                        <div>
                          <div className="font-medium text-gray-900">{agent.name}</div>
                          <div className="text-sm text-gray-500">{agent.agent_type}</div>
                        </div>
                      </div>
                      {selected && (
                        <select
                          value={selected.role}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleRoleChange(agent.id, e.target.value as SessionAgentRole);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm border border-gray-300 rounded px-2 py-1"
                        >
                          <option value="primary">Primary</option>
                          <option value="supporting">Supporting</option>
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Session Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Session Type
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {SESSION_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setSessionType(type.value)}
                  className={`p-3 rounded-lg border text-left transition-colors
                    ${sessionType === type.value
                      ? 'border-primary-300 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <div className="font-medium text-gray-900">{type.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{type.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Previous Context (shows after selection) */}
          {previousContext && (
            <div>
              <button
                type="button"
                onClick={() => setShowPreviousContext(!showPreviousContext)}
                className="flex items-center gap-2 text-sm font-medium text-gray-700"
              >
                {showPreviousContext ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                Previous Context Available
              </button>
              {showPreviousContext && (
                <div className="mt-2 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <pre className="text-sm font-mono text-gray-700 whitespace-pre-wrap">
                    {previousContext}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={starting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300
                       rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStartSession}
            disabled={!isValid || starting || hasActiveSession}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white
                       bg-primary-900 rounded-lg hover:bg-primary-800 disabled:opacity-50"
          >
            <Play size={16} />
            <span>{starting ? 'Starting...' : 'Start Session'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default SessionStartForm;
