import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { CopyToClipboard, DownloadMarkdown } from '../shared';

export interface HandoffDisplayProps {
  /** The handoff prompt content */
  handoffPrompt: string;
  /** Session date for filename */
  sessionDate?: string;
  /** Max characters to show before collapsing (default: 500) */
  collapseThreshold?: number;
}

export function HandoffDisplay({
  handoffPrompt,
  sessionDate,
  collapseThreshold = 500,
}: HandoffDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isLong = handoffPrompt.length > collapseThreshold;
  const displayText = isLong && !isExpanded
    ? handoffPrompt.slice(0, collapseThreshold) + '...'
    : handoffPrompt;

  const filename = sessionDate
    ? `handoff-${sessionDate}`
    : `handoff-${new Date().toISOString().split('T')[0]}`;

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 overflow-hidden">
      {/* Header with actions */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <span className="text-sm font-medium text-gray-300">Session Handoff</span>
        <div className="flex items-center gap-2">
          <CopyToClipboard
            text={handoffPrompt}
            label="Copy"
            size="sm"
            className="!bg-gray-700 !text-gray-200 !border-gray-600 hover:!bg-gray-600"
          />
          <DownloadMarkdown
            content={handoffPrompt}
            filename={filename}
            label=".md"
            size="sm"
            className="!bg-gray-700 !text-gray-200 !border-gray-600 hover:!bg-gray-600"
          />
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <pre className="text-sm font-mono text-gray-200 whitespace-pre-wrap break-words leading-relaxed">
          {displayText}
        </pre>

        {/* Expand/collapse toggle */}
        {isLong && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-3 inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
          >
            {isExpanded ? (
              <>
                <ChevronUp size={16} />
                <span>Show less</span>
              </>
            ) : (
              <>
                <ChevronDown size={16} />
                <span>Show full handoff</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default HandoffDisplay;
