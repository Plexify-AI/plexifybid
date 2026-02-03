import React, { useState, useCallback, useEffect } from 'react';
import { ArrowLeft, Clock, Calendar, Users } from 'lucide-react';
import { useSessions } from '../../useSessions';
import type { AgentSession, Agent } from '../../AgentManagement.types';
import { SessionStatusBadge } from './SessionStatusBadge';
import { SessionCompleteForm } from './SessionCompleteForm';
import { HandoffDisplay } from './HandoffDisplay';

export interface SessionDetailProps {
  /** Session ID to display */
  sessionId: string;
  /** Callback to navigate back */
  onBack: () => void;
  /** Callback when session is completed */
  onCompleted?: () => void;
}

const SESSION_TYPE_LABELS: Record<string, string> = {
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
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(startedAt: string, endedAt: string | null): string {
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const start = new Date(startedAt).getTime();
  const diffMins = Math.floor((end - start) / 60000);
  if (diffMins < 60) return `${diffMins} minutes`;
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours} hours`;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-48" />
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="h-6 bg-gray-200 rounded w-64 mb-4" />
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
    </div>
  );
}

export function SessionDetail({ sessionId, onBack, onCompleted }: SessionDetailProps) {
  const { getSession, getSessionAgents, complete, abandon } = useSessions();

  const [session, setSession] = useState<AgentSession | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [abandoning, setAbandoning] = useState(false);
  const [abandonReason, setAbandonReason] = useState('');
  const [showAbandonForm, setShowAbandonForm] = useState(false);

  // Fetch session and agents
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      const sessionData = await getSession(sessionId);
      if (!sessionData) {
        setError('Session not found');
        setLoading(false);
        return;
      }

      setSession(sessionData);
      const sessionAgents = await getSessionAgents(sessionId);
      setAgents(sessionAgents);
      setLoading(false);
    }

    fetchData();
  }, [sessionId, getSession, getSessionAgents]);

  const handleComplete = useCallback(async (data: {
    context_out: string;
    decisions_made: Array<{ decision: string; rationale: string; reversible: boolean }>;
    files_changed: string[];
    blockers: Array<{ description: string; resolved: boolean; resolution?: string }>;
    next_tasks: string[];
  }) => {
    if (!session) return;

    setCompleting(true);
    const result = await complete(session.id, data);
    setCompleting(false);

    if (result) {
      setSession(result);
      onCompleted?.();
    }
  }, [session, complete, onCompleted]);

  const handleAbandon = useCallback(async () => {
    if (!session || !abandonReason.trim()) return;

    setAbandoning(true);
    const result = await abandon(session.id, abandonReason.trim());
    setAbandoning(false);

    if (result) {
      setSession(result);
      setShowAbandonForm(false);
    }
  }, [session, abandonReason, abandon]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error || !session) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          <span>Sessions</span>
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">Error</p>
          <p className="text-sm mt-1">{error || 'Session not found'}</p>
        </div>
      </div>
    );
  }

  const sessionDate = new Date(session.started_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

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
        <span className="text-gray-900 font-medium">Session {sessionDate}</span>
      </div>

      {/* Header Card */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-xl font-semibold text-gray-900">
                  {agents.map((a) => a.name).join(', ') || 'Session'}
                </h1>
                <SessionStatusBadge status={session.status} />
              </div>
              <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600">
                {SESSION_TYPE_LABELS[session.session_type] || session.session_type}
              </span>
            </div>
          </div>

          {/* Meta info */}
          <div className="mt-4 flex flex-wrap items-center gap-6 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-gray-400" />
              <span>Started {formatDateTime(session.started_at)}</span>
            </div>
            {session.ended_at && (
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-gray-400" />
                <span>Duration: {formatDuration(session.started_at, session.ended_at)}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Users size={16} className="text-gray-400" />
              <span>{agents.length} agent{agents.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Agent list */}
          {agents.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Participating Agents
              </p>
              <div className="flex flex-wrap gap-2">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg"
                  >
                    <div className="text-sm font-medium text-gray-900">{agent.name}</div>
                    <div className="text-xs text-gray-500">{agent.agent_type}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active Session: Show complete form */}
      {session.status === 'active' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Complete Session</h2>
            <p className="text-sm text-gray-600 mt-1">
              Fill in the details below to complete this session and generate a handoff.
            </p>
          </div>
          <div className="p-6">
            <SessionCompleteForm
              session={session}
              onComplete={handleComplete}
              saving={completing}
            />
          </div>

          {/* Abandon option */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
            {!showAbandonForm ? (
              <button
                type="button"
                onClick={() => setShowAbandonForm(true)}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Abandon session instead
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">
                  Why are you abandoning this session?
                </p>
                <textarea
                  value={abandonReason}
                  onChange={(e) => setAbandonReason(e.target.value)}
                  rows={2}
                  placeholder="Reason for abandoning..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                             focus:outline-none focus:ring-2 focus:ring-red-200"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAbandon}
                    disabled={!abandonReason.trim() || abandoning}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded
                               hover:bg-red-700 disabled:opacity-50"
                  >
                    {abandoning ? 'Abandoning...' : 'Confirm Abandon'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAbandonForm(false);
                      setAbandonReason('');
                    }}
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Completed Session: Show summary + handoff */}
      {session.status === 'completed' && (
        <>
          {/* Summary */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Session Summary</h2>
            </div>
            <div className="p-6 space-y-6">
              {/* Context Out */}
              {session.context_out && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">What Was Accomplished</h3>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{session.context_out}</p>
                </div>
              )}

              {/* Decisions Made */}
              {session.decisions_made && session.decisions_made.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Decisions Made</h3>
                  <ul className="space-y-2">
                    {session.decisions_made.map((d, i) => (
                      <li key={i} className="text-sm text-gray-600 pl-4 border-l-2 border-gray-200">
                        <span className="font-medium">{d.decision}</span>
                        <br />
                        <span className="text-gray-500">Rationale: {d.rationale}</span>
                        <span className="ml-2 text-xs text-gray-400">
                          ({d.reversible ? 'Reversible' : 'Not reversible'})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Files Changed */}
              {session.files_changed && session.files_changed.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Files Changed</h3>
                  <ul className="text-sm text-gray-600 font-mono space-y-1">
                    {session.files_changed.map((f, i) => (
                      <li key={i}>• {f}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Blockers */}
              {session.blockers && session.blockers.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Blockers Encountered</h3>
                  <ul className="space-y-2">
                    {session.blockers.map((b, i) => (
                      <li key={i} className="text-sm text-gray-600">
                        <span className={b.resolved ? 'line-through text-gray-400' : ''}>
                          • {b.description}
                        </span>
                        {b.resolved && b.resolution && (
                          <span className="ml-2 text-green-600">✓ {b.resolution}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Next Tasks */}
              {session.next_tasks && session.next_tasks.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Next Tasks</h3>
                  <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                    {session.next_tasks.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </div>

          {/* Handoff Prompt */}
          {session.handoff_prompt && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Generated Handoff</h2>
              <HandoffDisplay
                handoffPrompt={session.handoff_prompt}
                sessionDate={session.started_at.split('T')[0]}
                collapseThreshold={1000}
              />
            </div>
          )}
        </>
      )}

      {/* Abandoned Session: Show summary + reason */}
      {session.status === 'abandoned' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Session Abandoned</h2>
          </div>
          <div className="p-6">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-1">Reason for Abandonment</p>
              <p className="text-sm text-gray-600">
                {session.abandon_reason || 'No reason provided'}
              </p>
            </div>

            {session.ended_at && (
              <p className="mt-4 text-sm text-gray-500">
                Abandoned on {formatDateTime(session.ended_at)}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SessionDetail;
