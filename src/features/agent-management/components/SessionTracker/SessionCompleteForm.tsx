import React, { useState, useCallback, useMemo } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import type { AgentSession, SessionDecision, SessionBlocker } from '../../AgentManagement.types';
import { JsonArrayEditor } from '../shared';
import { renderTemplate } from '../../useTemplateRenderer';

export interface SessionCompleteFormProps {
  /** The active session to complete */
  session: AgentSession;
  /** Callback when session is completed */
  onComplete: (data: {
    context_out: string;
    decisions_made: SessionDecision[];
    files_changed: string[];
    blockers: SessionBlocker[];
    next_tasks: string[];
  }) => Promise<void>;
  /** Whether completion is in progress */
  saving?: boolean;
}

// Simplified handoff template for live preview
const HANDOFF_PREVIEW_TEMPLATE = `# Session Handoff Preview

## What Was Accomplished
{{context_out}}

## Decisions Made
{{decisions_formatted}}

## Files Changed
{{files_formatted}}

## Blockers
{{blockers_formatted}}

## Next Session Should Start With
FIRST TASK: {{first_task}}
THEN: {{remaining_tasks}}`;

export function SessionCompleteForm({ session, onComplete, saving = false }: SessionCompleteFormProps) {
  const [contextOut, setContextOut] = useState('');
  const [decisions, setDecisions] = useState<SessionDecision[]>([]);
  const [filesText, setFilesText] = useState('');
  const [blockers, setBlockers] = useState<SessionBlocker[]>([]);
  const [nextTasks, setNextTasks] = useState<string[]>(['']);
  const [showPreview, setShowPreview] = useState(false);

  const filesChanged = useMemo(() =>
    filesText.split('\n').map((f) => f.trim()).filter((f) => f.length > 0),
    [filesText]
  );

  const isValid = useMemo(() =>
    nextTasks.filter((t) => t.trim()).length > 0,
    [nextTasks]
  );

  const handleSubmit = useCallback(async () => {
    if (!isValid) return;

    await onComplete({
      context_out: contextOut,
      decisions_made: decisions,
      files_changed: filesChanged,
      blockers,
      next_tasks: nextTasks.filter((t) => t.trim()),
    });
  }, [contextOut, decisions, filesChanged, blockers, nextTasks, isValid, onComplete]);

  // Generate live preview
  const handoffPreview = useMemo(() => {
    const decisionsFormatted = decisions.length > 0
      ? decisions.map((d) =>
          `- **${d.decision}**\n  - Rationale: ${d.rationale}\n  - Reversible: ${d.reversible ? 'Yes' : 'No'}`
        ).join('\n')
      : 'No decisions recorded.';

    const filesFormatted = filesChanged.length > 0
      ? filesChanged.map((f) => `- ${f}`).join('\n')
      : 'No files changed.';

    const blockersFormatted = blockers.length > 0
      ? blockers.map((b) =>
          `- ${b.description} (${b.resolved ? 'Resolved: ' + b.resolution : 'Unresolved'})`
        ).join('\n')
      : 'No blockers.';

    const validTasks = nextTasks.filter((t) => t.trim());

    const result = renderTemplate(
      HANDOFF_PREVIEW_TEMPLATE,
      {
        context_out: contextOut || '(Not specified)',
        decisions_formatted: decisionsFormatted,
        files_formatted: filesFormatted,
        blockers_formatted: blockersFormatted,
        first_task: validTasks[0] || '(No tasks)',
        remaining_tasks: validTasks.slice(1).join(', ') || 'None',
      },
      []
    );

    return result.rendered;
  }, [contextOut, decisions, filesChanged, blockers, nextTasks]);

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-blue-600 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">Complete Your Session</p>
            <p className="text-sm text-blue-700 mt-1">
              Fill in the details below to generate a handoff prompt for your next session.
              At least one next task is required.
            </p>
          </div>
        </div>
      </div>

      {/* Context Out */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          What was accomplished?
        </label>
        <textarea
          value={contextOut}
          onChange={(e) => setContextOut(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary-200 resize-y"
          placeholder="Summarize what you completed in this session..."
        />
      </div>

      {/* Decisions Made */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Decisions Made
        </label>
        <JsonArrayEditor
          value={decisions}
          onChange={setDecisions}
          createItem={() => ({ decision: '', rationale: '', reversible: true })}
          addLabel="Add Decision"
          emptyMessage="No decisions recorded"
          renderItem={(item, _index, handlers) => (
            <div className="space-y-2">
              <input
                type="text"
                value={item.decision}
                onChange={(e) => handlers.update({ ...item, decision: e.target.value })}
                placeholder="Decision"
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
              <input
                type="text"
                value={item.rationale}
                onChange={(e) => handlers.update({ ...item, rationale: e.target.value })}
                placeholder="Rationale"
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
              <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={item.reversible}
                  onChange={(e) => handlers.update({ ...item, reversible: e.target.checked })}
                  className="rounded border-gray-300"
                />
                Reversible
              </label>
            </div>
          )}
        />
      </div>

      {/* Files Changed */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Files Changed
          <span className="font-normal text-gray-500 ml-2">(one per line)</span>
        </label>
        <textarea
          value={filesText}
          onChange={(e) => setFilesText(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono
                     focus:outline-none focus:ring-2 focus:ring-primary-200 resize-y"
          placeholder="src/features/example/Component.tsx&#10;src/server/api.ts"
        />
      </div>

      {/* Blockers */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Blockers Encountered
        </label>
        <JsonArrayEditor
          value={blockers}
          onChange={setBlockers}
          createItem={() => ({ description: '', resolved: false, resolution: '' })}
          addLabel="Add Blocker"
          emptyMessage="No blockers"
          renderItem={(item, _index, handlers) => (
            <div className="space-y-2">
              <input
                type="text"
                value={item.description}
                onChange={(e) => handlers.update({ ...item, description: e.target.value })}
                placeholder="Blocker description"
                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={item.resolved}
                    onChange={(e) => handlers.update({ ...item, resolved: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  Resolved
                </label>
                {item.resolved && (
                  <input
                    type="text"
                    value={item.resolution || ''}
                    onChange={(e) => handlers.update({ ...item, resolution: e.target.value })}
                    placeholder="Resolution"
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm
                               focus:outline-none focus:ring-2 focus:ring-primary-200"
                  />
                )}
              </div>
            </div>
          )}
        />
      </div>

      {/* Next Tasks */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Next Tasks <span className="text-red-500">*</span>
          <span className="font-normal text-gray-500 ml-2">(at least 1 required)</span>
        </label>
        <JsonArrayEditor
          value={nextTasks}
          onChange={setNextTasks}
          createItem={() => ''}
          addLabel="Add Task"
          emptyMessage="Add at least one task for the next session"
          minItems={1}
          renderItem={(item, index, handlers) => (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-500 w-6">{index + 1}.</span>
              <input
                type="text"
                value={item}
                onChange={(e) => handlers.update(e.target.value)}
                placeholder={index === 0 ? 'First task for next session' : 'Additional task'}
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
            </div>
          )}
        />
        {!isValid && (
          <p className="mt-1 text-xs text-red-600">At least one task is required</p>
        )}
      </div>

      {/* Live Preview Toggle */}
      <div className="border-t border-gray-200 pt-4">
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="text-sm font-medium text-primary-700 hover:text-primary-800"
        >
          {showPreview ? 'Hide' : 'Show'} Handoff Preview
        </button>
        {showPreview && (
          <div className="mt-3 p-4 bg-gray-900 rounded-lg">
            <pre className="text-sm font-mono text-gray-200 whitespace-pre-wrap">
              {handoffPreview}
            </pre>
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid || saving}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white
                     bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CheckCircle size={16} />
          <span>{saving ? 'Completing...' : 'Complete Session'}</span>
        </button>
      </div>
    </div>
  );
}

export default SessionCompleteForm;
