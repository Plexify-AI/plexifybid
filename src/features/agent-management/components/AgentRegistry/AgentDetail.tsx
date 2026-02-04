import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Edit2, Archive, Bot, AlertTriangle } from 'lucide-react';
import { useAgents } from '../../useAgents';
import type { Agent, UpdateAgentRequest } from '../../AgentManagement.types';
import { AgentStatusBadge } from './AgentStatusBadge';
import { AgentForm } from './AgentForm';

export interface AgentDetailProps {
  /** Agent slug from route params */
  slug: string;
  /** Callback to navigate back to grid */
  onBack: () => void;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

export function AgentDetail({ slug, onBack }: AgentDetailProps) {
  const { getBySlug, update, archive } = useAgents();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  // Fetch agent on mount
  useEffect(() => {
    async function fetchAgent() {
      setLoading(true);
      setError(null);
      const data = await getBySlug(slug);
      if (data) {
        setAgent(data);
      } else {
        setError('Agent not found');
      }
      setLoading(false);
    }
    fetchAgent();
  }, [slug, getBySlug]);

  const handleSave = useCallback(
    async (data: UpdateAgentRequest) => {
      if (!agent) return;
      setSaving(true);
      const updated = await update(agent.id, data);
      if (updated) {
        setAgent(updated);
        setIsEditing(false);
      }
      setSaving(false);
    },
    [agent, update]
  );

  const handleArchive = useCallback(async () => {
    if (!agent) return;
    setSaving(true);
    const success = await archive(agent.id);
    if (success) {
      onBack();
    } else {
      setError('Failed to archive agent. It may have active sessions.');
    }
    setSaving(false);
    setShowArchiveConfirm(false);
  }, [agent, archive, onBack]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="space-y-4">
            <div className="h-6 bg-gray-200 rounded w-64 animate-pulse" />
            <div className="h-4 bg-gray-200 rounded w-full animate-pulse" />
            <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          <span>Back to Agents</span>
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">{error || 'Agent not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={16} />
          <span>Agents</span>
        </button>
        <span className="text-gray-400">/</span>
        <span className="text-gray-900 font-medium">{agent.name}</span>
      </div>

      {/* Main content */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        {isEditing ? (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Edit Agent</h2>
            <AgentForm
              agent={agent}
              onSave={handleSave}
              onCancel={() => setIsEditing(false)}
              saving={saving}
            />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Bot size={24} className="text-gray-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-xl font-semibold text-gray-900">{agent.name}</h1>
                      <AgentStatusBadge status={agent.status} />
                    </div>
                    <p className="text-sm text-gray-500 font-mono">{agent.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium
                               text-gray-700 bg-white border border-gray-300 rounded-lg
                               hover:bg-gray-50"
                  >
                    <Edit2 size={14} />
                    <span>Edit</span>
                  </button>
                  {agent.status !== 'archived' && (
                    <button
                      type="button"
                      onClick={() => setShowArchiveConfirm(true)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium
                                 text-red-700 bg-white border border-red-300 rounded-lg
                                 hover:bg-red-50"
                    >
                      <Archive size={14} />
                      <span>Archive</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              {/* Description */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Description</h3>
                <p className="text-gray-900">{agent.description || 'No description'}</p>
              </div>

              {/* Meta info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Product Line</h3>
                  <span className="inline-block px-2 py-1 text-sm rounded bg-gray-100">
                    {agent.product_line}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Type</h3>
                  <span className="text-gray-900">{agent.agent_type}</span>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Model</h3>
                  <span className="text-gray-900">{agent.model || 'Not specified'}</span>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Version</h3>
                  <span className="font-mono text-gray-900">{agent.version}</span>
                </div>
              </div>

              {/* Persona */}
              {agent.persona && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Persona / System Prompt</h3>
                  <pre className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono whitespace-pre-wrap overflow-x-auto">
                    {agent.persona}
                  </pre>
                </div>
              )}

              {/* Capabilities */}
              {agent.capabilities.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Capabilities</h3>
                  <div className="flex flex-wrap gap-2">
                    {agent.capabilities.map((cap, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 text-sm bg-blue-50 text-blue-700 rounded"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div className="flex items-center gap-6 text-sm text-gray-500 pt-4 border-t border-gray-100">
                <span>Created: {formatDate(agent.created_at)}</span>
                <span>Updated: {formatDate(agent.updated_at)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Archive confirmation modal */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Archive Agent?</h3>
                <p className="text-sm text-gray-600 mt-1">
                  This will archive <strong>{agent.name}</strong>. Archived agents are hidden
                  from the main list but can be restored later.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowArchiveConfirm(false)}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleArchive}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                {saving ? 'Archiving...' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AgentDetail;
